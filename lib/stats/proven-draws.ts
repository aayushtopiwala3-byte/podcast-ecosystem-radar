import { db } from "../db";
import { episodeEntities, episodes, shows } from "../db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

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
