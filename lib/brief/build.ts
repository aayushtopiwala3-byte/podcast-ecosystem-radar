import { db } from "../db";
import { aiSuggestions, episodeEntities, episodes, shows, weeklyBriefs } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getTopTopics } from "../stats/topic-performance";

export type EvidenceItem = {
  showId: number;
  showName: string;
  episodeId: number;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
  excerpt: string | null;
};

export type FlaggedEntity = {
  value: string;
  showCount: number;
  evidence: EvidenceItem[];
};

export type GuestLead = FlaggedEntity & {
  urgent: boolean; // 2+ distinct shows within the trailing 30 days
  overexposed: boolean; // 4+ total episode appearances within the trailing 90 days
};

export type FlaggedSponsor = FlaggedEntity & {
  adReadCount: number;
  mentionCount: number;
};

export type WatchlistSponsor = {
  value: string;
  showName: string;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: string;
  excerpt: string | null;
};

export type SuggestedSponsor = {
  value: string;
  reason: string;
  sourceUrl?: string;
  topic: string;
};

export type BriefPayload = {
  weekStartDate: string;
  generatedAt: string;
  guestLeads: GuestLead[];
  trendingTopics: FlaggedEntity[];
  sponsorSignals: {
    tier1: FlaggedSponsor[];
    tier2: FlaggedSponsor[];
    singleShowAdReads: WatchlistSponsor[];
    tier3: SuggestedSponsor[];
  };
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function fetchEntityRows(type: "guest" | "topic" | "sponsor", since: Date) {
  return db
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
    .where(and(eq(episodeEntities.type, type), gte(episodes.publishedAt, since)));
}

export async function buildWeeklyBrief(): Promise<BriefPayload> {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS);

  // --- Guests: trailing 6 months, distinct shows ---
  const guestRows = await fetchEntityRows("guest", sixMonthsAgo);
  const guestGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const row of guestRows) {
    const key = row.normalizedValue;
    if (!guestGroups.has(key)) {
      guestGroups.set(key, { value: row.value, evidence: [], showIds: new Set() });
    }
    const group = guestGroups.get(key)!;
    group.showIds.add(row.showId);
    group.evidence.push({
      showId: row.showId,
      showName: row.showName,
      episodeId: row.episodeId,
      episodeTitle: row.episodeTitle,
      episodeUrl: row.episodeUrl,
      publishedAt: row.publishedAt.toISOString(),
      excerpt: row.excerpt,
    });
  }
  const guestLeads: GuestLead[] = Array.from(guestGroups.values())
    .filter((g) => g.showIds.size >= 2)
    .map((g) => {
      const recentShowIds = new Set(
        g.evidence
          .filter((e) => now.getTime() - new Date(e.publishedAt).getTime() <= THIRTY_DAYS_MS)
          .map((e) => e.showId)
      );
      const recentAppearances = g.evidence.filter(
        (e) => now.getTime() - new Date(e.publishedAt).getTime() <= NINETY_DAYS_MS
      ).length;
      return {
        value: g.value,
        showCount: g.showIds.size,
        evidence: g.evidence,
        urgent: recentShowIds.size >= 2,
        overexposed: recentAppearances >= 4,
      };
    })
    .sort((a, b) => b.showCount - a.showCount);

  // --- Topics: trailing 6 months, distinct shows ---
  const topicRows = await fetchEntityRows("topic", sixMonthsAgo);
  const topicGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const row of topicRows) {
    const key = row.normalizedValue;
    if (!topicGroups.has(key)) {
      topicGroups.set(key, { value: row.value, evidence: [], showIds: new Set() });
    }
    const group = topicGroups.get(key)!;
    group.showIds.add(row.showId);
    group.evidence.push({
      showId: row.showId,
      showName: row.showName,
      episodeId: row.episodeId,
      episodeTitle: row.episodeTitle,
      episodeUrl: row.episodeUrl,
      publishedAt: row.publishedAt.toISOString(),
      excerpt: row.excerpt,
    });
  }
  const trendingTopics: FlaggedEntity[] = Array.from(topicGroups.values())
    .filter((g) => g.showIds.size >= 2)
    .map((g) => ({ value: g.value, showCount: g.showIds.size, evidence: g.evidence }))
    .sort((a, b) => b.showCount - a.showCount);

  // --- Sponsors: trailing 6 months ---
  const sponsorRows = await fetchEntityRows("sponsor", sixMonthsAgo);
  const sponsorGroups = new Map<
    string,
    { value: string; evidence: EvidenceItem[]; showIds: Set<number>; adReadCount: number; mentionCount: number }
  >();
  for (const row of sponsorRows) {
    const key = row.normalizedValue;
    if (!sponsorGroups.has(key)) {
      sponsorGroups.set(key, { value: row.value, evidence: [], showIds: new Set(), adReadCount: 0, mentionCount: 0 });
    }
    const group = sponsorGroups.get(key)!;
    group.showIds.add(row.showId);
    if (row.mentionType === "ad_read") group.adReadCount++;
    else group.mentionCount++;
    group.evidence.push({
      showId: row.showId,
      showName: row.showName,
      episodeId: row.episodeId,
      episodeTitle: row.episodeTitle,
      episodeUrl: row.episodeUrl,
      publishedAt: row.publishedAt.toISOString(),
      excerpt: row.excerpt,
    });
  }

  // Ad-read presence is tracked separately from overall mentions so tiering reflects
  // proven paid budget on specific shows, not just name-drops.
  const adReadGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const row of sponsorRows) {
    if (row.mentionType !== "ad_read") continue;
    const key = row.normalizedValue;
    if (!adReadGroups.has(key)) {
      adReadGroups.set(key, { value: row.value, evidence: [], showIds: new Set() });
    }
    const g = adReadGroups.get(key)!;
    g.showIds.add(row.showId);
    g.evidence.push({
      showId: row.showId,
      showName: row.showName,
      episodeId: row.episodeId,
      episodeTitle: row.episodeTitle,
      episodeUrl: row.episodeUrl,
      publishedAt: row.publishedAt.toISOString(),
      excerpt: row.excerpt,
    });
  }

  const tier1: FlaggedSponsor[] = Array.from(adReadGroups.entries())
    .filter(([, g]) => g.showIds.size >= 2)
    .map(([key, g]) => {
      const full = sponsorGroups.get(key)!;
      return {
        value: g.value,
        showCount: g.showIds.size,
        evidence: g.evidence,
        adReadCount: full.adReadCount,
        mentionCount: full.mentionCount,
      };
    })
    .sort((a, b) => b.showCount - a.showCount);

  const singleShowAdReads: WatchlistSponsor[] = Array.from(adReadGroups.values())
    .filter((g) => g.showIds.size === 1)
    .map((g) => {
      const ev = g.evidence[0];
      return {
        value: g.value,
        showName: ev.showName,
        episodeTitle: ev.episodeTitle,
        episodeUrl: ev.episodeUrl,
        publishedAt: ev.publishedAt,
        excerpt: ev.excerpt,
      };
    });

  const tier2: FlaggedSponsor[] = Array.from(sponsorGroups.entries())
    .filter(([key]) => !adReadGroups.has(key))
    .map(([, g]) => ({
      value: g.value,
      showCount: g.showIds.size,
      evidence: g.evidence,
      adReadCount: g.adReadCount,
      mentionCount: g.mentionCount,
    }))
    .sort((a, b) => b.showCount - a.showCount);

  const topTopics = await getTopTopics(5);
  const tier3Rows =
    topTopics.length > 0
      ? await db
          .select()
          .from(aiSuggestions)
          .where(eq(aiSuggestions.kind, "sponsor"))
      : [];
  const topTopicTags = new Set(topTopics.map((t) => t.tag));
  const tier3: SuggestedSponsor[] = tier3Rows
    .filter((row) => topTopicTags.has(row.topic))
    .flatMap((row) =>
      (row.suggestions as { name: string; reason: string; sourceUrl?: string }[]).map((s) => ({
        value: s.name,
        reason: s.reason,
        sourceUrl: s.sourceUrl,
        topic: row.topic,
      }))
    );

  return {
    weekStartDate: weekStart.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    guestLeads,
    trendingTopics,
    sponsorSignals: {
      tier1,
      tier2,
      singleShowAdReads,
      tier3,
    },
  };
}

export async function saveWeeklyBrief(payload: BriefPayload) {
  const [row] = await db
    .insert(weeklyBriefs)
    .values({
      weekStartDate: payload.weekStartDate,
      payload,
      emailSent: false,
    })
    .returning();
  return row;
}
