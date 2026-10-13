import { db } from "../db";
import { episodeEntities, episodes, shows } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";
import type { EvidenceItem } from "../brief/build";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export type TopicGap = { value: string; ecosystemShowCount: number; evidence: EvidenceItem[] };
export type GuestGap = { value: string; ecosystemShowCount: number; evidence: EvidenceItem[] };
export type SponsorGap = { value: string; ecosystemShowCount: number; evidence: EvidenceItem[] };
export type AheadTopic = {
  value: string;
  ownFirstSeenAt: string;
  ecosystemFirstSeenAt: string;
  daysAhead: number;
  ownEvidence: EvidenceItem;
};

export type OwnShowGaps = {
  configured: boolean;
  ownShowId: number | null;
  ownShowName: string | null;
  topicGaps: TopicGap[];
  guestGaps: GuestGap[];
  sponsorGaps: SponsorGap[];
  whereAhead: AheadTopic[];
};

const EMPTY: OwnShowGaps = {
  configured: false,
  ownShowId: null,
  ownShowName: null,
  topicGaps: [],
  guestGaps: [],
  sponsorGaps: [],
  whereAhead: [],
};

type Row = {
  value: string;
  normalizedValue: string;
  mentionType: string | null;
  excerpt: string | null;
  showId: number;
  showName: string;
  episodeId: number;
  episodeTitle: string;
  episodeUrl: string;
  publishedAt: Date;
};

async function fetchTypeRows(type: "guest" | "topic" | "sponsor", since: Date): Promise<Row[]> {
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

function toEvidence(r: Row): EvidenceItem {
  return {
    showId: r.showId,
    showName: r.showName,
    episodeId: r.episodeId,
    episodeTitle: r.episodeTitle,
    episodeUrl: r.episodeUrl,
    publishedAt: r.publishedAt.toISOString(),
    excerpt: r.excerpt,
  };
}

// Pure deterministic comparisons over already-ingested entity rows, same posture as the
// money map (spec 3.1/3.2) — no AI involved, safe to compute live on every brief build.
export async function computeOwnShowGaps(): Promise<OwnShowGaps> {
  const ownRows = await db.select().from(shows).where(eq(shows.isOwnShow, true));
  const ownShow = ownRows[0];
  if (!ownShow) return EMPTY;

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);
  const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS);

  // --- Topic gaps: topics on 3+ ecosystem shows in the trailing 90 days that his show
  // has not covered in the trailing 90 days (spec 4.1). ---
  const topicRows90d = await fetchTypeRows("topic", ninetyDaysAgo);
  const ecosystemTopicRows = topicRows90d.filter((r) => r.showId !== ownShow.id);
  const ownTopicNormalized90d = new Set(topicRows90d.filter((r) => r.showId === ownShow.id).map((r) => r.normalizedValue));

  const ecosystemTopicGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const r of ecosystemTopicRows) {
    if (!ecosystemTopicGroups.has(r.normalizedValue)) {
      ecosystemTopicGroups.set(r.normalizedValue, { value: r.value, evidence: [], showIds: new Set() });
    }
    const g = ecosystemTopicGroups.get(r.normalizedValue)!;
    g.showIds.add(r.showId);
    g.evidence.push(toEvidence(r));
  }

  const topicGaps: TopicGap[] = Array.from(ecosystemTopicGroups.entries())
    .filter(([key, g]) => g.showIds.size >= 3 && !ownTopicNormalized90d.has(key))
    .map(([, g]) => ({ value: g.value, ecosystemShowCount: g.showIds.size, evidence: g.evidence }))
    .sort((a, b) => b.ecosystemShowCount - a.ecosystemShowCount);

  // --- Guest gaps: guests on 2+ ecosystem shows (trailing 6 months) who have never
  // appeared on his show (checked against his show's full history, not windowed). ---
  const guestRows6m = await fetchTypeRows("guest", sixMonthsAgo);
  const ecosystemGuestRows = guestRows6m.filter((r) => r.showId !== ownShow.id);
  const ownGuestRowsAllTime = await db
    .select({ normalizedValue: episodeEntities.normalizedValue })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(and(eq(episodeEntities.type, "guest"), eq(episodes.showId, ownShow.id)));
  const ownGuestNormalizedAllTime = new Set(ownGuestRowsAllTime.map((r) => r.normalizedValue));

  const ecosystemGuestGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const r of ecosystemGuestRows) {
    if (!ecosystemGuestGroups.has(r.normalizedValue)) {
      ecosystemGuestGroups.set(r.normalizedValue, { value: r.value, evidence: [], showIds: new Set() });
    }
    const g = ecosystemGuestGroups.get(r.normalizedValue)!;
    g.showIds.add(r.showId);
    g.evidence.push(toEvidence(r));
  }

  const guestGaps: GuestGap[] = Array.from(ecosystemGuestGroups.entries())
    .filter(([key, g]) => g.showIds.size >= 2 && !ownGuestNormalizedAllTime.has(key))
    .map(([, g]) => ({ value: g.value, ecosystemShowCount: g.showIds.size, evidence: g.evidence }))
    .sort((a, b) => b.ecosystemShowCount - a.ecosystemShowCount);

  // --- Sponsor gaps: brands with ad reads on 2+ ecosystem shows (trailing 6 months) and
  // none on his show (checked against his show's full ad-read history, not windowed). ---
  const sponsorRows6m = await fetchTypeRows("sponsor", sixMonthsAgo);
  const ecosystemAdReadRows = sponsorRows6m.filter((r) => r.showId !== ownShow.id && r.mentionType === "ad_read");
  const ownAdReadRowsAllTime = await db
    .select({ normalizedValue: episodeEntities.normalizedValue })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .where(
      and(eq(episodeEntities.type, "sponsor"), eq(episodeEntities.mentionType, "ad_read"), eq(episodes.showId, ownShow.id))
    );
  const ownAdReadNormalizedAllTime = new Set(ownAdReadRowsAllTime.map((r) => r.normalizedValue));

  const ecosystemSponsorGroups = new Map<string, { value: string; evidence: EvidenceItem[]; showIds: Set<number> }>();
  for (const r of ecosystemAdReadRows) {
    if (!ecosystemSponsorGroups.has(r.normalizedValue)) {
      ecosystemSponsorGroups.set(r.normalizedValue, { value: r.value, evidence: [], showIds: new Set() });
    }
    const g = ecosystemSponsorGroups.get(r.normalizedValue)!;
    g.showIds.add(r.showId);
    g.evidence.push(toEvidence(r));
  }

  const sponsorGaps: SponsorGap[] = Array.from(ecosystemSponsorGroups.entries())
    .filter(([key, g]) => g.showIds.size >= 2 && !ownAdReadNormalizedAllTime.has(key))
    .map(([, g]) => ({ value: g.value, ecosystemShowCount: g.showIds.size, evidence: g.evidence }))
    .sort((a, b) => b.ecosystemShowCount - a.ecosystemShowCount);

  // --- Where he's ahead: topics his show covered before any other ecosystem show did,
  // within the same trailing 6-month pool used for trending topics (spec 4.1). ---
  const topicRows6m = await fetchTypeRows("topic", sixMonthsAgo);
  const ownTopicRows = topicRows6m.filter((r) => r.showId === ownShow.id);
  const ecosystemTopicRows6m = topicRows6m.filter((r) => r.showId !== ownShow.id);

  const ownFirstByTopic = new Map<string, Row>();
  for (const r of ownTopicRows) {
    const existing = ownFirstByTopic.get(r.normalizedValue);
    if (!existing || r.publishedAt < existing.publishedAt) ownFirstByTopic.set(r.normalizedValue, r);
  }
  const ecosystemFirstByTopic = new Map<string, Date>();
  for (const r of ecosystemTopicRows6m) {
    const existing = ecosystemFirstByTopic.get(r.normalizedValue);
    if (!existing || r.publishedAt < existing) ecosystemFirstByTopic.set(r.normalizedValue, r.publishedAt);
  }

  const whereAhead: AheadTopic[] = [];
  for (const [key, ownRow] of ownFirstByTopic) {
    const ecosystemFirst = ecosystemFirstByTopic.get(key);
    if (!ecosystemFirst) continue; // ecosystem hasn't covered it (yet) — not a "where he's ahead" claim, just uncontested
    if (ownRow.publishedAt.getTime() < ecosystemFirst.getTime()) {
      const daysAhead = Math.round((ecosystemFirst.getTime() - ownRow.publishedAt.getTime()) / (24 * 60 * 60 * 1000));
      whereAhead.push({
        value: ownRow.value,
        ownFirstSeenAt: ownRow.publishedAt.toISOString(),
        ecosystemFirstSeenAt: ecosystemFirst.toISOString(),
        daysAhead,
        ownEvidence: toEvidence(ownRow),
      });
    }
  }
  whereAhead.sort((a, b) => b.daysAhead - a.daysAhead);

  return {
    configured: true,
    ownShowId: ownShow.id,
    ownShowName: ownShow.name,
    topicGaps,
    guestGaps,
    sponsorGaps,
    whereAhead,
  };
}
