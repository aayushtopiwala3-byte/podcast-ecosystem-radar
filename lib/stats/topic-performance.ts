import { db } from "../db";
import { episodeEntities, episodes, shows } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export type TopicPerformance = {
  tag: string;
  showCount: number;
  episodeCount: number;
  avgViewRatio: number; // 0 if no episodes in this topic have a view ratio yet
  totalViewRatio: number;
  noSignalCount: number;
};

export type RankedTopic = TopicPerformance & { blendScore: number };

export async function getTopicPerformance(): Promise<TopicPerformance[]> {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);

  const rows = await db
    .select({
      value: episodeEntities.value,
      showId: shows.id,
      episodeId: episodes.id,
      viewRatio: episodes.viewRatio,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "topic"), gte(episodes.publishedAt, sixMonthsAgo)));

  const groups = new Map<
    string,
    { showIds: Set<number>; episodeIds: Set<number>; ratios: number[]; noSignalCount: number }
  >();

  for (const row of rows) {
    if (!groups.has(row.value)) {
      groups.set(row.value, { showIds: new Set(), episodeIds: new Set(), ratios: [], noSignalCount: 0 });
    }
    const g = groups.get(row.value)!;
    g.showIds.add(row.showId);
    g.episodeIds.add(row.episodeId);
    if (row.viewRatio != null) g.ratios.push(row.viewRatio);
    else g.noSignalCount++;
  }

  return Array.from(groups.entries())
    .map(([tag, g]) => {
      const totalViewRatio = g.ratios.reduce((a, b) => a + b, 0);
      const avgViewRatio = g.ratios.length > 0 ? totalViewRatio / g.ratios.length : 0;
      return {
        tag,
        showCount: g.showIds.size,
        episodeCount: g.episodeIds.size,
        avgViewRatio,
        totalViewRatio,
        noSignalCount: g.noSignalCount,
      };
    })
    .sort((a, b) => b.showCount - a.showCount);
}

export async function getTopTopics(n = 5): Promise<RankedTopic[]> {
  const all = await getTopicPerformance();
  if (all.length === 0) return [];

  const maxShowCount = Math.max(...all.map((t) => t.showCount)) || 1;
  const maxAvgViewRatio = Math.max(...all.map((t) => t.avgViewRatio)) || 1;

  return all
    .map((t) => ({
      ...t,
      blendScore: 0.5 * (t.showCount / maxShowCount) + 0.5 * (t.avgViewRatio / maxAvgViewRatio),
    }))
    .sort((a, b) => b.blendScore - a.blendScore)
    .slice(0, n);
}
