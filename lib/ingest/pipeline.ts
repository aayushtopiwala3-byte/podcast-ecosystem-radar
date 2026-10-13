import { db } from "../db";
import { shows, episodes, episodeEntities, pipelineRuns } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { fetchRecentVideos, fetchTranscriptText } from "./youtube";
import { fetchRecentRssItems } from "./rss";
import { extractEntities } from "../gemini/extract";
import { normalize, normalizeGuestName } from "./normalize";
import { mapLimit } from "./concurrency";
import { fetchViewCounts } from "../youtube/stats";
import { recomputeViewRatios } from "../scoring/virality";
import { PINNED_MODEL, type ChatUsage } from "../ai/gemini-flash";

const EPISODE_CONCURRENCY = 4;
const SHOW_CONCURRENCY = 10;

type ShowOutcome = {
  showId: number;
  showName: string;
  platform: string;
  status: "success" | "partial" | "failed" | "no_new_episodes";
  newEpisodes: number;
  transcriptCount: number;
  descriptionOnlyCount: number;
  error: string | null;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type AiUsageTotals = { calls: number; totalTokens: number; costUsd: number };

export async function runPipeline(): Promise<{
  runId: number;
  status: "success" | "partial" | "failed";
  outcomes: ShowOutcome[];
  aiUsage: AiUsageTotals;
}> {
  const [run] = await db
    .insert(pipelineRuns)
    .values({ status: "running", details: {} })
    .returning();

  const activeShows = await db.select().from(shows).where(eq(shows.active, true));

  const aiUsages: ChatUsage[] = [];
  const outcomes = await mapLimit(activeShows, SHOW_CONCURRENCY, (show) => processShow(show, aiUsages));

  const anySuccess = outcomes.some((o) => o.status === "success" || o.status === "no_new_episodes");
  const anyFailed = outcomes.some((o) => o.status === "failed");
  const overallStatus: "success" | "partial" | "failed" = !anySuccess
    ? "failed"
    : anyFailed
    ? "partial"
    : "success";

  const aiUsage: AiUsageTotals = {
    calls: aiUsages.length,
    totalTokens: aiUsages.reduce((sum, u) => sum + u.totalTokens, 0),
    costUsd: aiUsages.reduce((sum, u) => sum + u.costUsd, 0),
  };

  await db
    .update(pipelineRuns)
    .set({
      finishedAt: new Date(),
      status: overallStatus,
      details: { outcomes, aiUsage, model: PINNED_MODEL },
    })
    .where(eq(pipelineRuns.id, run.id));

  return { runId: run.id, status: overallStatus, outcomes, aiUsage };
}

type Show = typeof shows.$inferSelect;

async function processShow(show: Show, aiUsages: ChatUsage[]): Promise<ShowOutcome> {
  const outcome: ShowOutcome = {
    showId: show.id,
    showName: show.name,
    platform: show.platform,
    status: "success",
    newEpisodes: 0,
    transcriptCount: 0,
    descriptionOnlyCount: 0,
    error: null,
  };

  try {
    const since = show.lastFetchedAt
      ? new Date(show.lastFetchedAt)
      : new Date(Date.now() - THIRTY_DAYS_MS);

    if (show.platform === "youtube") {
      if (!show.youtubeChannelId) {
        outcome.status = "failed";
        outcome.error = "No youtube_channel_id set for this show";
        return outcome;
      }

      const videos = await fetchRecentVideos(show.youtubeChannelId, since.toISOString());
      const viewCounts = await fetchViewCounts(videos.map((v) => v.videoId));

      await mapLimit(videos, EPISODE_CONCURRENCY, async (video) => {
        const existing = await db
          .select({ id: episodes.id })
          .from(episodes)
          .where(eq(episodes.url, video.url));
        if (existing.length > 0) return;

        const transcript = await fetchTranscriptText(video.videoId);
        const sourceType = transcript ? "youtube_transcript" : "youtube_description_only";
        const rawText = transcript ?? `${video.title}\n\n${video.description}`;

        if (transcript) outcome.transcriptCount++;
        else outcome.descriptionOnlyCount++;

        const [episode] = await db
          .insert(episodes)
          .values({
            showId: show.id,
            title: video.title,
            url: video.url,
            publishedAt: new Date(video.publishedAt),
            sourceType,
            rawText,
            viewCount: viewCounts[video.videoId] ?? null,
          })
          .returning();

        outcome.newEpisodes++;
        const usage = await extractAndStore(episode.id, video.title, rawText);
        if (usage) aiUsages.push(usage);
      });

      await recomputeViewRatios(show.id);
    } else if (show.platform === "rss") {
      if (!show.rssUrl) {
        outcome.status = "failed";
        outcome.error = "No rss_url set for this show";
        return outcome;
      }

      const items = await fetchRecentRssItems(show.rssUrl, since);

      await mapLimit(items, EPISODE_CONCURRENCY, async (item) => {
        const existing = await db
          .select({ id: episodes.id })
          .from(episodes)
          .where(eq(episodes.url, item.link));
        if (existing.length > 0) return;

        const rawText = `${item.title}\n\n${item.description}`;
        outcome.descriptionOnlyCount++;

        const [episode] = await db
          .insert(episodes)
          .values({
            showId: show.id,
            title: item.title,
            url: item.link,
            publishedAt: new Date(item.publishedAt),
            sourceType: "rss_description",
            rawText,
          })
          .returning();

        outcome.newEpisodes++;
        const usage = await extractAndStore(episode.id, item.title, rawText);
        if (usage) aiUsages.push(usage);
      });
    }

    if (outcome.newEpisodes === 0) outcome.status = "no_new_episodes";

    await db.update(shows).set({ lastFetchedAt: new Date() }).where(eq(shows.id, show.id));
  } catch (err: any) {
    outcome.status = "failed";
    outcome.error = err?.message ?? String(err);
  }

  return outcome;
}

export async function extractAndStore(
  episodeId: number,
  title: string,
  rawText: string,
  options: { replaceExisting?: boolean } = {}
): Promise<ChatUsage | null> {
  try {
    const { result: extraction, usage } = await extractEntities(title, rawText);

    const rows: (typeof episodeEntities.$inferInsert)[] = [];

    for (const g of extraction.guests) {
      if (!g.name?.trim()) continue;
      rows.push({
        episodeId,
        type: "guest",
        value: g.name.trim(),
        normalizedValue: normalizeGuestName(g.name),
        mentionType: null,
        excerpt: g.excerpt ?? null,
        confidence: g.confidence,
      });
    }

    for (const t of extraction.topics) {
      if (!t.topic?.trim()) continue;
      rows.push({
        episodeId,
        type: "topic",
        value: t.topic.trim(),
        normalizedValue: normalize(t.topic),
        mentionType: null,
        excerpt: t.excerpt ?? null,
        confidence: t.confidence,
      });
    }

    for (const s of extraction.sponsors) {
      if (!s.brand?.trim()) continue;
      rows.push({
        episodeId,
        type: "sponsor",
        value: s.brand.trim(),
        normalizedValue: normalize(s.brand),
        mentionType: s.mention_type,
        excerpt: s.excerpt ?? null,
        confidence: s.confidence,
      });
    }

    if (options.replaceExisting) {
      await db.delete(episodeEntities).where(eq(episodeEntities.episodeId, episodeId));
    }

    if (rows.length > 0) {
      await db.insert(episodeEntities).values(rows);
    }

    return usage;
  } catch (err) {
    // Extraction failure for a single episode should not fail the whole show run;
    // the episode row still exists as evidence that ingestion happened.
    console.error(`Gemini extraction failed for episode ${episodeId}:`, err);
    return null;
  }
}
