import { db } from "../db";
import { episodeEntities, episodes, shows } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Aditya's stated reach (problem statement) — monthly podcast listeners, not directly
// comparable to YouTube per-video view counts. Used only as a directional signal (spec 3.2).
export const ADITYA_MONTHLY_LISTENERS = 9000;

export type BrandState = "new_entrant" | "scaling" | "steady" | "churned";

export type MoneyMapEvidence = {
  showId: number;
  showName: string;
  episodeId: number;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
  excerpt: string | null;
  mentionType: "ad_read" | "mention" | null;
};

export type ShowReachInfo = { showId: number; showName: string; medianViewCount: number | null };

export type MoneyMapBrand = {
  value: string;
  state: BrandState;
  recentAdReadCount: number;
  priorAdReadCount: number;
  recentShowCount: number;
  priorShowCount: number;
  evidence: MoneyMapEvidence[]; // ad-read evidence, trailing 90 days
  reach: ShowReachInfo[]; // per distinct show the active-window ad reads sit on
  underReachBuyer: boolean;
};

export type MentionOnlyBrand = {
  value: string;
  showCount: number;
  evidence: MoneyMapEvidence[];
};

export type MoneyMap = {
  newEntrants: MoneyMapBrand[];
  scaling: MoneyMapBrand[];
  steady: MoneyMapBrand[];
  churned: MoneyMapBrand[];
  mentionOnly: MentionOnlyBrand[];
};

// Rules, not AI — deterministic and defensible, same posture as burn-score/lifecycle (spec 3.1).
export function classifyBrandState(input: {
  recentAdReadCount: number;
  priorAdReadCount: number;
  recentShowCount: number;
  priorShowCount: number;
}): BrandState {
  const { recentAdReadCount, priorAdReadCount, recentShowCount, priorShowCount } = input;
  if (recentAdReadCount > 0 && priorAdReadCount === 0) return "new_entrant";
  if (recentAdReadCount === 0 && priorAdReadCount > 0) return "churned";
  if (recentAdReadCount > priorAdReadCount || recentShowCount > priorShowCount) return "scaling";
  return "steady";
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type EvidenceRow = {
  showId: number;
  showName: string;
  episodeId: number;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: Date;
  excerpt: string | null;
  mentionType: string | null;
};

function toEvidence(r: EvidenceRow): MoneyMapEvidence {
  return {
    showId: r.showId,
    showName: r.showName,
    episodeId: r.episodeId,
    episodeTitle: r.episodeTitle,
    episodeUrl: r.episodeUrl,
    publishedAt: r.publishedAt.toISOString(),
    excerpt: r.excerpt,
    mentionType: r.mentionType as "ad_read" | "mention" | null,
  };
}

// No AI involved (pure arithmetic over existing entity rows), so — unlike guest burn-score
// and topic lifecycle — this is computed live, not cached in its own table. Safe on the
// Monday cron path; only the pitch draft itself (lib/gemini/sponsor-pitch.ts) calls Gemini,
// and that stays admin-triggered on demand, same as invite drafts.
export async function computeMoneyMap(): Promise<MoneyMap> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);

  const rows = await db
    .select({
      value: episodeEntities.value,
      normalizedValue: episodeEntities.normalizedValue,
      mentionType: episodeEntities.mentionType,
      excerpt: episodeEntities.excerpt,
      showId: shows.id,
      showName: shows.name,
      episodeId: episodes.id,
      episodeTitle: episodes.title,
      episodeUrl: episodes.url,
      publishedAt: episodes.publishedAt,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "sponsor"), gte(episodes.publishedAt, ninetyDaysAgo)));

  type Row = (typeof rows)[number];
  const groups = new Map<string, { value: string; rows: Row[] }>();
  for (const row of rows) {
    if (!groups.has(row.normalizedValue)) groups.set(row.normalizedValue, { value: row.value, rows: [] });
    groups.get(row.normalizedValue)!.rows.push(row);
  }

  // Trailing-90-day median viewCount per show — reach proxy (spec 3.2), independent of brand.
  const episodeRows = await db
    .select({ showId: shows.id, viewCount: episodes.viewCount })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(gte(episodes.publishedAt, ninetyDaysAgo));
  const viewCountsByShow = new Map<number, number[]>();
  for (const r of episodeRows) {
    if (r.viewCount == null) continue;
    if (!viewCountsByShow.has(r.showId)) viewCountsByShow.set(r.showId, []);
    viewCountsByShow.get(r.showId)!.push(r.viewCount);
  }
  const medianByShow = new Map<number, number | null>();
  for (const [showId, counts] of viewCountsByShow) medianByShow.set(showId, median(counts));

  const newEntrants: MoneyMapBrand[] = [];
  const scaling: MoneyMapBrand[] = [];
  const steady: MoneyMapBrand[] = [];
  const churned: MoneyMapBrand[] = [];
  const mentionOnly: MentionOnlyBrand[] = [];

  for (const group of groups.values()) {
    const adReadRows = group.rows.filter((r) => r.mentionType === "ad_read");
    if (adReadRows.length === 0) {
      mentionOnly.push({
        value: group.value,
        showCount: new Set(group.rows.map((r) => r.showId)).size,
        evidence: group.rows.map(toEvidence),
      });
      continue;
    }

    const recentAdReads = adReadRows.filter((r) => now.getTime() - r.publishedAt.getTime() <= THIRTY_DAYS_MS);
    const priorAdReads = adReadRows.filter((r) => {
      const age = now.getTime() - r.publishedAt.getTime();
      return age > THIRTY_DAYS_MS && age <= NINETY_DAYS_MS;
    });

    const recentShowCount = new Set(recentAdReads.map((r) => r.showId)).size;
    const priorShowCount = new Set(priorAdReads.map((r) => r.showId)).size;

    const state = classifyBrandState({
      recentAdReadCount: recentAdReads.length,
      priorAdReadCount: priorAdReads.length,
      recentShowCount,
      priorShowCount,
    });

    // Reach is read off whichever window actually has ad reads (recent, unless Churned which
    // only has prior-window evidence) — the window that's live evidence of real spend.
    const activeRows = recentAdReads.length > 0 ? recentAdReads : priorAdReads;
    const activeShowIds = Array.from(new Set(activeRows.map((r) => r.showId)));
    const reach: ShowReachInfo[] = activeShowIds.map((showId) => ({
      showId,
      showName: activeRows.find((r) => r.showId === showId)!.showName,
      medianViewCount: medianByShow.get(showId) ?? null,
    }));
    const underReachBuyer = reach.some((r) => r.medianViewCount != null && r.medianViewCount < ADITYA_MONTHLY_LISTENERS);

    const brand: MoneyMapBrand = {
      value: group.value,
      state,
      recentAdReadCount: recentAdReads.length,
      priorAdReadCount: priorAdReads.length,
      recentShowCount,
      priorShowCount,
      evidence: adReadRows
        .map(toEvidence)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      reach,
      underReachBuyer,
    };

    if (state === "new_entrant") newEntrants.push(brand);
    else if (state === "scaling") scaling.push(brand);
    else if (state === "steady") steady.push(brand);
    else churned.push(brand);
  }

  const byRecentCount = (a: MoneyMapBrand, b: MoneyMapBrand) => b.recentAdReadCount - a.recentAdReadCount;
  return {
    newEntrants: newEntrants.sort(byRecentCount),
    scaling: scaling.sort(byRecentCount),
    steady: steady.sort(byRecentCount),
    churned: churned.sort((a, b) => b.priorAdReadCount - a.priorAdReadCount),
    mentionOnly: mentionOnly.sort((a, b) => b.showCount - a.showCount),
  };
}
