import { db } from "../db";
import { episodeEntities, episodes, shows } from "../db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

// Chosen against the real distribution of episodes.viewRatio (144 episodes with
// a ratio, trailing 6 months, checked 2026-10-12): ratio >= 1.3 clears the bar
// for 36 episodes (~25%) — a "meaningfully above baseline" cut that isn't so
// strict it excludes almost everything, and not so loose it includes noise.
export const SIGNIFICANT_OUTPERFORMANCE_THRESHOLD = 1.3;

export type ProvenDraw = {
  guestName: string;
  excerpt: string | null;
  showName: string;
  episodeId: number;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
  viewRatio: number | null;
};

export type GlobalProvenDraw = ProvenDraw & { topic: string };

export async function getProvenDraws(topic: string, limit = 3): Promise<ProvenDraw[]> {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);

  const topicEpisodeRows = await db
    .select({ episodeId: episodeEntities.episodeId })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(
      and(eq(episodeEntities.type, "topic"), eq(episodeEntities.value, topic), gte(episodes.publishedAt, sixMonthsAgo))
    );

  const episodeIds = Array.from(new Set(topicEpisodeRows.map((r) => r.episodeId)));
  if (episodeIds.length === 0) return [];

  const guestRows = await db
    .select({
      value: episodeEntities.value,
      excerpt: episodeEntities.excerpt,
      showName: shows.name,
      episodeId: episodes.id,
      episodeTitle: episodes.title,
      episodeUrl: episodes.url,
      publishedAt: episodes.publishedAt,
      viewRatio: episodes.viewRatio,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "guest"), inArray(episodeEntities.episodeId, episodeIds)));

  return guestRows
    .sort((a, b) => (b.viewRatio ?? -1) - (a.viewRatio ?? -1))
    .slice(0, limit)
    .map((r) => ({
      guestName: r.value,
      excerpt: r.excerpt,
      showName: r.showName,
      episodeId: r.episodeId,
      episodeTitle: r.episodeTitle,
      episodeUrl: r.episodeUrl,
      publishedAt: r.publishedAt.toISOString(),
      viewRatio: r.viewRatio,
    }));
}

// Headline "New Guest Leads" signal: guests whose episode in a trending topic
// significantly outperformed that show's own trailing-6-month average view count
// (viewRatio >= SIGNIFICANT_OUTPERFORMANCE_THRESHOLD), across ANY trending topic —
// not scoped to a single topic like getProvenDraws(). One row per distinct guest
// (their single best-performing qualifying appearance), ranked by viewRatio desc.
export async function getGlobalProvenDraws(
  trendingTopicTags: string[],
  limit = 6,
  minViewRatio = SIGNIFICANT_OUTPERFORMANCE_THRESHOLD
): Promise<GlobalProvenDraw[]> {
  if (trendingTopicTags.length === 0) return [];
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);

  const topicEpisodeRows = await db
    .select({ episodeId: episodeEntities.episodeId, topic: episodeEntities.value })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(
      and(
        eq(episodeEntities.type, "topic"),
        inArray(episodeEntities.value, trendingTopicTags),
        gte(episodes.publishedAt, sixMonthsAgo)
      )
    );

  if (topicEpisodeRows.length === 0) return [];
  const topicByEpisodeId = new Map<number, string>();
  for (const r of topicEpisodeRows) {
    if (!topicByEpisodeId.has(r.episodeId)) topicByEpisodeId.set(r.episodeId, r.topic);
  }
  const episodeIds = Array.from(topicByEpisodeId.keys());

  const guestRows = await db
    .select({
      value: episodeEntities.value,
      normalizedValue: episodeEntities.normalizedValue,
      excerpt: episodeEntities.excerpt,
      showName: shows.name,
      episodeId: episodes.id,
      episodeTitle: episodes.title,
      episodeUrl: episodes.url,
      publishedAt: episodes.publishedAt,
      viewRatio: episodes.viewRatio,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "guest"), inArray(episodeEntities.episodeId, episodeIds)))
    .orderBy(shows.name);

  const qualifying = guestRows.filter((r) => (r.viewRatio ?? -1) >= minViewRatio);

  const bestByGuest = new Map<string, (typeof qualifying)[number]>();
  for (const r of qualifying) {
    const existing = bestByGuest.get(r.normalizedValue);
    if (!existing || (r.viewRatio ?? -1) > (existing.viewRatio ?? -1)) {
      bestByGuest.set(r.normalizedValue, r);
    }
  }

  return Array.from(bestByGuest.values())
    .sort((a, b) => (b.viewRatio ?? -1) - (a.viewRatio ?? -1))
    .slice(0, limit)
    .map((r) => ({
      guestName: r.value,
      excerpt: r.excerpt,
      showName: r.showName,
      episodeId: r.episodeId,
      episodeTitle: r.episodeTitle,
      episodeUrl: r.episodeUrl,
      publishedAt: r.publishedAt.toISOString(),
      viewRatio: r.viewRatio,
      topic: topicByEpisodeId.get(r.episodeId) ?? "",
    }));
}
