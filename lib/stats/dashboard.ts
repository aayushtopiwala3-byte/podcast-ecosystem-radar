import { db } from "../db";
import { episodes, episodeEntities, shows, pipelineRuns, weeklyBriefs } from "../db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export type WeeklyEpisodeSeries = {
  weeks: string[]; // week start labels
  totals: number[];
  highlighted: { showName: string; counts: number[] }[];
};

export async function getWeeklyEpisodeSeries(): Promise<WeeklyEpisodeSeries> {
  const allEpisodes = await db
    .select({
      publishedAt: episodes.publishedAt,
      showId: episodes.showId,
      showName: shows.name,
    })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id));

  const now = new Date();
  const weekBuckets: { label: string; start: Date; end: Date }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    weekBuckets.push({
      label: start.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      start,
      end,
    });
  }

  const totals = weekBuckets.map(
    (b) => allEpisodes.filter((e) => e.publishedAt >= b.start && e.publishedAt < b.end).length
  );

  const showCounts = new Map<string, number>();
  for (const e of allEpisodes) showCounts.set(e.showName, (showCounts.get(e.showName) ?? 0) + 1);
  const topShows = Array.from(showCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  const highlighted = topShows.map((showName) => ({
    showName,
    counts: weekBuckets.map(
      (b) =>
        allEpisodes.filter((e) => e.showName === showName && e.publishedAt >= b.start && e.publishedAt < b.end)
          .length
    ),
  }));

  return { weeks: weekBuckets.map((b) => b.label), totals, highlighted };
}

export async function getEntityMixThisWeek() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ type: episodeEntities.type, count: sql<number>`count(*)` })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(gte(episodes.publishedAt, sevenDaysAgo))
    .groupBy(episodeEntities.type);

  const map: Record<string, number> = { guest: 0, topic: 0, sponsor: 0 };
  for (const r of rows) map[r.type] = Number(r.count);
  return map;
}

export type EntityMixDetailRow = {
  value: string;
  excerpt: string | null;
  showName: string;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
};

export async function getEntityMixDetail(): Promise<Record<"guest" | "topic" | "sponsor", EntityMixDetailRow[]>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      type: episodeEntities.type,
      value: episodeEntities.value,
      excerpt: episodeEntities.excerpt,
      showName: shows.name,
      episodeTitle: episodes.title,
      episodeUrl: episodes.url,
      publishedAt: episodes.publishedAt,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(gte(episodes.publishedAt, sevenDaysAgo))
    .orderBy(desc(episodes.publishedAt));

  const detail: Record<"guest" | "topic" | "sponsor", EntityMixDetailRow[]> = { guest: [], topic: [], sponsor: [] };
  for (const r of rows) {
    if (r.type !== "guest" && r.type !== "topic" && r.type !== "sponsor") continue;
    detail[r.type].push({
      value: r.value,
      excerpt: r.excerpt,
      showName: r.showName,
      episodeTitle: r.episodeTitle,
      episodeUrl: r.episodeUrl,
      publishedAt: r.publishedAt.toISOString(),
    });
  }
  return detail;
}

export async function getSponsorMentionSplit() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ mentionType: episodeEntities.mentionType, count: sql<number>`count(*)` })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(gte(episodes.publishedAt, thirtyDaysAgo))
    .groupBy(episodeEntities.mentionType);

  let adRead = 0;
  let mention = 0;
  for (const r of rows) {
    if (r.mentionType === "ad_read") adRead = Number(r.count);
    else if (r.mentionType === "mention") mention = Number(r.count);
  }
  return { adRead, mention };
}

export async function getSponsorMentionDetail(): Promise<Record<"adRead" | "mention", EntityMixDetailRow[]>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      mentionType: episodeEntities.mentionType,
      value: episodeEntities.value,
      excerpt: episodeEntities.excerpt,
      showName: shows.name,
      episodeTitle: episodes.title,
      episodeUrl: episodes.url,
      publishedAt: episodes.publishedAt,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "sponsor"), gte(episodes.publishedAt, thirtyDaysAgo)))
    .orderBy(desc(episodes.publishedAt));

  const detail: Record<"adRead" | "mention", EntityMixDetailRow[]> = { adRead: [], mention: [] };
  for (const r of rows) {
    const key = r.mentionType === "ad_read" ? "adRead" : r.mentionType === "mention" ? "mention" : null;
    if (!key) continue;
    detail[key].push({
      value: r.value,
      excerpt: r.excerpt,
      showName: r.showName,
      episodeTitle: r.episodeTitle,
      episodeUrl: r.episodeUrl,
      publishedAt: r.publishedAt.toISOString(),
    });
  }
  return detail;
}

export async function getEpisodesPerShow() {
  const rows = await db
    .select({ showName: shows.name, count: sql<number>`count(${episodes.id})` })
    .from(shows)
    .leftJoin(episodes, eq(episodes.showId, shows.id))
    .groupBy(shows.id, shows.name);

  return rows.map((r) => ({ showName: r.showName, count: Number(r.count) })).sort((a, b) => b.count - a.count);
}

export async function getLatestPipelineRun() {
  const rows = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
  return rows[0] ?? null;
}

export async function getPipelineRunHistory(limit = 10) {
  return db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(limit);
}

export async function getAllShowsWithStatus() {
  const allShows = await db.select().from(shows).orderBy(shows.name);
  const latestRun = await getLatestPipelineRun();
  const outcomes: any[] = (latestRun?.details as any)?.outcomes ?? [];

  return allShows.map((show) => {
    const outcome = outcomes.find((o) => o.showId === show.id);
    return {
      ...show,
      lastRunStatus: outcome?.status ?? (show.lastFetchedAt ? "unknown" : "never_run"),
      lastRunError: outcome?.error ?? null,
      lastRunNewEpisodes: outcome?.newEpisodes ?? null,
    };
  });
}

export async function getStatCardCounts() {
  const briefs = await db.select().from(weeklyBriefs).orderBy(desc(weeklyBriefs.generatedAt)).limit(2);
  const latest = briefs[0];
  const previous = briefs[1];

  const latestPayload = latest?.payload as any;
  const prevPayload = previous?.payload as any;

  // Headline guest count is now proven draws (guests whose episode in a trending
  // topic significantly outperformed that show's own baseline), not exact repeat
  // appearances — the repeat-appearance check still runs and is surfaced honestly
  // in the expanded view via guestSignals.repeatAppearanceCount. Older briefs that
  // predate guestSignals fall back to 0.
  const guestCount = latestPayload?.guestSignals?.provenDraws?.length ?? 0;
  const topicCount = latestPayload?.trendingTopics?.length ?? 0;
  const sponsorCount =
    (latestPayload?.sponsorSignals?.tier1?.length ?? 0) + (latestPayload?.sponsorSignals?.tier2?.length ?? 0);

  const prevGuestCount = prevPayload?.guestSignals?.provenDraws?.length ?? 0;
  const prevTopicCount = prevPayload?.trendingTopics?.length ?? 0;
  const prevSponsorCount =
    (prevPayload?.sponsorSignals?.tier1?.length ?? 0) + (prevPayload?.sponsorSignals?.tier2?.length ?? 0);

  function pctChange(curr: number, prev: number) {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 100);
  }

  return {
    guestCount,
    topicCount,
    sponsorCount,
    guestChange: pctChange(guestCount, prevGuestCount),
    topicChange: pctChange(topicCount, prevTopicCount),
    sponsorChange: pctChange(sponsorCount, prevSponsorCount),
    latestBrief: latest ?? null,
  };
}
