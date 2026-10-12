import { db } from "../db";
import { episodes } from "../db/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export async function recomputeViewRatios(showId: number): Promise<void> {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS);

  const rows = await db
    .select({ id: episodes.id, viewCount: episodes.viewCount })
    .from(episodes)
    .where(
      and(
        eq(episodes.showId, showId),
        isNotNull(episodes.viewCount),
        gte(episodes.publishedAt, sixMonthsAgo)
      )
    );

  if (rows.length === 0) return;

  const avg = rows.reduce((sum, r) => sum + (r.viewCount ?? 0), 0) / rows.length;
  if (avg <= 0) return;

  for (const row of rows) {
    const ratio = (row.viewCount ?? 0) / avg;
    await db.update(episodes).set({ viewRatio: ratio }).where(eq(episodes.id, row.id));
  }
}
