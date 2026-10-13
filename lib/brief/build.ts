import { db } from "../db";
import { aiSuggestions, episodeEntities, episodes, guestProfiles, shows, topicLifecycle, weeklyBriefs } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getTopTopics } from "../stats/topic-performance";
import { getGlobalProvenDraws, type GlobalProvenDraw } from "../stats/proven-draws";
import { verdictCopy, type Verdict } from "../guests/burn-score";
import { lifecycleCopy, type Classification } from "../topics/lifecycle";
import type { CounterAngle } from "../gemini/counter-angles";
import { computeMoneyMap, type MoneyMap } from "../stats/money-map";

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

export type GuestProfileSummary = {
  verdict: Verdict;
  copy: string;
  repetitionScore: number | null;
  velocity30d: number;
  appearances90d: number;
  distinctShows30d: number;
  distinctShows6m: number;
  daysSinceLast: number;
  nextWindowDate: string | null;
  repeatedStories: { story: string; episodeIds: number[] }[];
  freshMaterial: { point: string; episodeId: number }[];
};

export type TopicLifecycleSummary = {
  classification: Classification;
  copy: string;
  spreadB1: number;
  spreadB2: number;
  spreadB3: number;
  avgRatioB1: number | null;
  avgRatioB2: number | null;
  avgRatioB3: number | null;
  spreadTrend: number;
  performanceTrend: number | null;
  counterAngles: CounterAngle[];
};

export type TopicLead = FlaggedEntity & {
  // Null until computeTopicLifecycles() has run for this topic (admin-triggered, not on the Monday cron path).
  lifecycle: TopicLifecycleSummary | null;
};

export type GuestLead = FlaggedEntity & {
  urgent: boolean; // 2+ distinct shows within the trailing 30 days
  overexposed: boolean; // 4+ total episode appearances within the trailing 90 days
  // Null until computeGuestProfiles() has run for this guest (admin-triggered, not on the Monday cron path).
  profile: GuestProfileSummary | null;
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

export type SuggestedGuest = {
  value: string;
  reason: string;
  sourceUrl?: string;
  topic: string;
};

export type BriefPayload = {
  weekStartDate: string;
  generatedAt: string;
  guestLeads: GuestLead[];
  guestSignals: {
    provenDraws: GlobalProvenDraw[];
    suggestedGuests: SuggestedGuest[];
    // Honest reporting of the original repeat-across-shows check (item 1/2): this is
    // guestLeads.length, surfaced explicitly so the "0 guests on 2+ shows" finding
    // stays visible even though it's no longer the headline metric.
    repeatAppearanceCount: number;
  };
  trendingTopics: TopicLead[];
  sponsorSignals: {
    tier1: FlaggedSponsor[];
    tier2: FlaggedSponsor[];
    singleShowAdReads: WatchlistSponsor[];
    tier3: SuggestedSponsor[];
  };
  moneyMap: MoneyMap;
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
  // Read-only join: guest_profiles rows are computed by a separate admin-triggered
  // endpoint (lib/guests/burn-score.ts), never by this function — keeps the Monday
  // cron path free of AI calls.
  const profileRows = await db.select().from(guestProfiles);
  const profileByGuest = new Map(profileRows.map((p) => [p.normalizedGuest, p]));

  const guestLeads: GuestLead[] = Array.from(guestGroups.entries())
    .filter(([, g]) => g.showIds.size >= 2)
    .map(([key, g]) => {
      const recentShowIds = new Set(
        g.evidence
          .filter((e) => now.getTime() - new Date(e.publishedAt).getTime() <= THIRTY_DAYS_MS)
          .map((e) => e.showId)
      );
      const recentAppearances = g.evidence.filter(
        (e) => now.getTime() - new Date(e.publishedAt).getTime() <= NINETY_DAYS_MS
      ).length;

      const p = profileByGuest.get(key);
      const profile: GuestProfileSummary | null = p
        ? {
            verdict: p.verdict as Verdict,
            copy: verdictCopy({
              verdict: p.verdict as Verdict,
              appearances90d: p.appearances90d,
              nextWindowDate: p.nextWindowDate,
            }),
            repetitionScore: p.repetitionScore,
            velocity30d: p.velocity30d,
            appearances90d: p.appearances90d,
            distinctShows30d: p.distinctShows30d,
            distinctShows6m: p.distinctShows6m,
            daysSinceLast: p.daysSinceLast,
            nextWindowDate: p.nextWindowDate,
            repeatedStories: p.repeatedStories as { story: string; episodeIds: number[] }[],
            freshMaterial: p.freshMaterial as { point: string; episodeId: number }[],
          }
        : null;

      return {
        value: g.value,
        showCount: g.showIds.size,
        evidence: g.evidence,
        urgent: recentShowIds.size >= 2,
        overexposed: recentAppearances >= 4,
        profile,
      };
    })
    // Same-month overlaps (urgent) surface first — they're the active media-round signal
    // the assignment asks for; the rest is the wider 6-month validation set.
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.showCount - a.showCount);

  // Top-5 performing topics drive both the global proven-draws scope and the
  // AI-suggested guest/sponsor pools — computed once, reused below.
  const topTopics = await getTopTopics(5);
  const topTopicTags = new Set(topTopics.map((t) => t.tag));

  const provenDraws = await getGlobalProvenDraws(Array.from(topTopicTags), 6);
  const guestSuggestionRows =
    topTopics.length > 0 ? await db.select().from(aiSuggestions).where(eq(aiSuggestions.kind, "guest")) : [];
  const suggestedGuests: SuggestedGuest[] = guestSuggestionRows
    .filter((row) => topTopicTags.has(row.topic))
    .flatMap((row) =>
      (row.suggestions as { name: string; reason: string; sourceUrl?: string }[]).map((s) => ({
        value: s.name,
        reason: s.reason,
        sourceUrl: s.sourceUrl,
        topic: row.topic,
      }))
    );

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
  // Read-only join: topic_lifecycle rows are computed by a separate admin-triggered
  // endpoint (lib/topics/lifecycle.ts), never by this function — keeps the Monday
  // cron path free of AI calls (counter-angle generation for Peaking topics).
  const lifecycleRows = await db.select().from(topicLifecycle);
  const lifecycleByTopic = new Map(lifecycleRows.map((r) => [r.normalizedTopic, r]));

  const trendingTopics: TopicLead[] = Array.from(topicGroups.entries())
    .filter(([, g]) => g.showIds.size >= 2)
    .map(([key, g]) => {
      const r = lifecycleByTopic.get(key);
      const lifecycle: TopicLifecycleSummary | null = r
        ? {
            classification: r.classification as Classification,
            copy: lifecycleCopy(r.classification as Classification),
            spreadB1: r.spreadB1,
            spreadB2: r.spreadB2,
            spreadB3: r.spreadB3,
            avgRatioB1: r.avgRatioB1,
            avgRatioB2: r.avgRatioB2,
            avgRatioB3: r.avgRatioB3,
            spreadTrend: r.spreadTrend,
            performanceTrend: r.performanceTrend,
            counterAngles: r.counterAngles as CounterAngle[],
          }
        : null;
      return { value: g.value, showCount: g.showIds.size, evidence: g.evidence, lifecycle };
    })
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

  const tier3Rows =
    topTopics.length > 0
      ? await db
          .select()
          .from(aiSuggestions)
          .where(eq(aiSuggestions.kind, "sponsor"))
      : [];
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

  // --- Money map: brand state machine + reach comparison (spec 3.1/3.2) ---
  const moneyMap = await computeMoneyMap();

  return {
    weekStartDate: weekStart.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    guestLeads,
    guestSignals: {
      provenDraws,
      suggestedGuests,
      repeatAppearanceCount: guestLeads.length,
    },
    trendingTopics,
    sponsorSignals: {
      tier1,
      tier2,
      singleShowAdReads,
      tier3,
    },
    moneyMap,
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
