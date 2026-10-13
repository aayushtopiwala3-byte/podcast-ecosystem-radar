import crypto from "crypto";
import { db } from "../db";
import { episodeEntities, episodes, shows, topicLifecycle } from "../db/schema";
import { eq, and, gte } from "drizzle-orm";
import { generateCounterAngles, type CounterAngle } from "../gemini/counter-angles";
import type { ChatUsage } from "../ai/gemini-flash";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type Classification = "insufficient_data" | "emerging" | "peaking" | "evergreen" | "fading" | "mixed";

export type BucketStats = { spread: number; avgRatio: number | null };

export type ClassifyResult = {
  classification: Classification;
  spreadTrend: number;
  performanceTrend: number | null;
};

// Rules, not AI — deterministic and defensible (spec 2.1). Checks run in order; insufficient
// data is checked first since it must be visible rather than hidden behind a guessed verdict.
export function classifyLifecycle(input: {
  totalRatioCount: number;
  b1: BucketStats;
  b2: BucketStats;
  b3: BucketStats;
}): ClassifyResult {
  const { totalRatioCount, b1, b2, b3 } = input;
  const spreadTrend = b3.spread - b1.spread;
  const performanceTrend = b1.avgRatio != null && b3.avgRatio != null ? b3.avgRatio - b1.avgRatio : null;

  if (totalRatioCount < 3) {
    return { classification: "insufficient_data", spreadTrend, performanceTrend };
  }

  if (b3.spread >= 2 && b3.spread <= 3 && spreadTrend > 0 && b3.avgRatio != null && b3.avgRatio >= 1.1) {
    return { classification: "emerging", spreadTrend, performanceTrend };
  }

  if (b3.spread >= 4 && performanceTrend != null && performanceTrend <= 0) {
    return { classification: "peaking", spreadTrend, performanceTrend };
  }

  if (
    Math.abs(spreadTrend) <= 1 &&
    b1.avgRatio != null &&
    b1.avgRatio >= 1.0 &&
    b2.avgRatio != null &&
    b2.avgRatio >= 1.0 &&
    b3.avgRatio != null &&
    b3.avgRatio >= 1.0
  ) {
    return { classification: "evergreen", spreadTrend, performanceTrend };
  }

  if (performanceTrend != null && performanceTrend < -0.2 && spreadTrend <= 0) {
    return { classification: "fading", spreadTrend, performanceTrend };
  }

  return { classification: "mixed", spreadTrend, performanceTrend };
}

export function lifecycleCopy(classification: Classification): string {
  switch (classification) {
    case "insufficient_data":
      return "Not enough performance data to classify.";
    case "emerging":
      return "Cover now — you're early.";
    case "peaking":
      return "Saturated — counter-program instead.";
    case "evergreen":
      return "Safe any time.";
    case "fading":
      return "Skip.";
    case "mixed":
      return "Mixed signal — no clear trend.";
  }
}

function inputHashOf(episodeIds: number[]): string {
  const sorted = [...episodeIds].sort((a, b) => a - b);
  return crypto.createHash("sha256").update(sorted.join(",")).digest("hex");
}

function bucketStats(rows: { showId: number; viewRatio: number | null }[]): BucketStats {
  const showIds = new Set(rows.map((r) => r.showId));
  const ratios = rows.map((r) => r.viewRatio).filter((v): v is number => v != null);
  return { spread: showIds.size, avgRatio: ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null };
}

export async function computeTopicLifecycles(): Promise<{ computed: number; usage: ChatUsage[] }> {
  const now = new Date();
  const since = new Date(now.getTime() - NINETY_DAYS_MS);

  const rows = await db
    .select({
      normalizedTopic: episodeEntities.normalizedValue,
      displayName: episodeEntities.value,
      episodeId: episodes.id,
      episodeTitle: episodes.title,
      showId: shows.id,
      showName: shows.name,
      publishedAt: episodes.publishedAt,
      viewRatio: episodes.viewRatio,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "topic"), gte(episodes.publishedAt, since)));

  type Row = (typeof rows)[number];
  const groups = new Map<string, { displayName: string; rows: Row[] }>();
  for (const row of rows) {
    if (!groups.has(row.normalizedTopic)) groups.set(row.normalizedTopic, { displayName: row.displayName, rows: [] });
    groups.get(row.normalizedTopic)!.rows.push(row);
  }

  const existingRows = await db.select().from(topicLifecycle);
  const existingByTopic = new Map(existingRows.map((r) => [r.normalizedTopic, r]));

  let computed = 0;
  const usage: ChatUsage[] = [];

  for (const [normalizedTopic, group] of groups) {
    // B1 oldest (61-90 days ago) -> B3 newest (0-30 days ago).
    const b1Rows = group.rows.filter((r) => now.getTime() - r.publishedAt.getTime() > 2 * THIRTY_DAYS_MS);
    const b2Rows = group.rows.filter((r) => {
      const age = now.getTime() - r.publishedAt.getTime();
      return age > THIRTY_DAYS_MS && age <= 2 * THIRTY_DAYS_MS;
    });
    const b3Rows = group.rows.filter((r) => now.getTime() - r.publishedAt.getTime() <= THIRTY_DAYS_MS);

    const b1 = bucketStats(b1Rows);
    const b2 = bucketStats(b2Rows);
    const b3 = bucketStats(b3Rows);
    const totalRatioCount = group.rows.filter((r) => r.viewRatio != null).length;

    const { classification, spreadTrend, performanceTrend } = classifyLifecycle({ totalRatioCount, b1, b2, b3 });

    const episodeIds = group.rows.map((r) => r.episodeId);
    const inputHash = inputHashOf(episodeIds);
    const existing = existingByTopic.get(normalizedTopic);

    let counterAngles: CounterAngle[] = (existing?.counterAngles as CounterAngle[] | undefined) ?? [];
    if (classification === "peaking") {
      const isFresh =
        !!existing &&
        existing.inputHash === inputHash &&
        existing.classification === "peaking" &&
        counterAngles.length > 0 &&
        now.getTime() - new Date(existing.computedAt).getTime() < SEVEN_DAYS_MS;
      if (!isFresh) {
        try {
          const uniqueEpisodes = Array.from(new Map(group.rows.map((r) => [r.episodeId, r])).values()).map((r) => ({
            title: r.episodeTitle,
            showName: r.showName,
          }));
          const result = await generateCounterAngles(group.displayName, uniqueEpisodes);
          counterAngles = result.angles;
          usage.push(result.usage);
        } catch (err) {
          console.error(`Counter-angle generation failed for topic ${group.displayName}:`, err);
          counterAngles = (existing?.counterAngles as CounterAngle[] | undefined) ?? [];
        }
      }
    } else {
      counterAngles = [];
    }

    await db
      .insert(topicLifecycle)
      .values({
        normalizedTopic,
        displayName: group.displayName,
        classification,
        spreadB1: b1.spread,
        spreadB2: b2.spread,
        spreadB3: b3.spread,
        avgRatioB1: b1.avgRatio,
        avgRatioB2: b2.avgRatio,
        avgRatioB3: b3.avgRatio,
        spreadTrend,
        performanceTrend,
        counterAngles,
        inputHash,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: topicLifecycle.normalizedTopic,
        set: {
          displayName: group.displayName,
          classification,
          spreadB1: b1.spread,
          spreadB2: b2.spread,
          spreadB3: b3.spread,
          avgRatioB1: b1.avgRatio,
          avgRatioB2: b2.avgRatio,
          avgRatioB3: b3.avgRatio,
          spreadTrend,
          performanceTrend,
          counterAngles,
          inputHash,
          computedAt: now,
        },
      });

    computed++;
  }

  return { computed, usage };
}
