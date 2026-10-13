import crypto from "crypto";
import { db } from "../db";
import { episodeEntities, episodes, shows, guestProfiles } from "../db/schema";
import { eq, and, gte } from "drizzle-orm";
import { scoreRepetition, type RepetitionExcerpt } from "../gemini/repetition";
import type { ChatUsage } from "../ai/gemini-flash";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FORTY_FIVE_DAYS_MS = 45 * 24 * 60 * 60 * 1000;
const EXCERPT_CHAR_CAP = 4000;
const MAX_EXCERPTS = 5;

export type Verdict = "oversaturated" | "wait" | "book_now" | "warm_lead";

type Appearance = {
  episodeId: number;
  showId: number;
  showName: string;
  publishedAt: Date;
  sourceType: string;
  rawText: string;
};

type VerdictResult = { verdict: Verdict; nextWindowDate: string | null };

export function computeVerdict(input: {
  velocity30d: number;
  appearances90d: number;
  distinctShows30d: number;
  repetitionScore: number | null;
  lastAppearance: Date;
}): VerdictResult {
  const { velocity30d, appearances90d, distinctShows30d, repetitionScore, lastAppearance } = input;

  if (velocity30d >= 3 || (appearances90d >= 4 && repetitionScore !== null && repetitionScore >= 0.7)) {
    return { verdict: "oversaturated", nextWindowDate: null };
  }

  if (velocity30d >= 2 && repetitionScore !== null && repetitionScore >= 0.5) {
    const nextWindow = new Date(lastAppearance.getTime() + FORTY_FIVE_DAYS_MS);
    return { verdict: "wait", nextWindowDate: nextWindow.toISOString().slice(0, 10) };
  }

  if (distinctShows30d >= 2 && velocity30d <= 2 && repetitionScore !== null && repetitionScore < 0.5) {
    return { verdict: "book_now", nextWindowDate: null };
  }

  return { verdict: "warm_lead", nextWindowDate: null };
}

export function verdictCopy(input: { verdict: Verdict; appearances90d: number; nextWindowDate: string | null }): string {
  switch (input.verdict) {
    case "oversaturated":
      return `Skip for now — ${input.appearances90d} appearances in 90 days, material is repeating.`;
    case "wait":
      return `Wait until ${
        input.nextWindowDate
          ? new Date(input.nextWindowDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "later"
      } — in a media round but recycling the same stories.`;
    case "book_now":
      return "Book now — active media round, material still fresh.";
    case "warm_lead":
      return "Validated but not currently active — no urgency.";
  }
}

function inputHashOf(episodeIds: number[]): string {
  const sorted = [...episodeIds].sort((a, b) => a - b);
  return crypto.createHash("sha256").update(sorted.join(",")).digest("hex");
}

// Up to one excerpt per distinct show (MAX_EXCERPTS shows), preferring youtube_transcript
// rows over description-only text, so the repetition call compares real substance, not titles.
function pickExcerpts(appearances: Appearance[]): RepetitionExcerpt[] {
  const byShow = new Map<number, Appearance[]>();
  for (const a of appearances) {
    if (!byShow.has(a.showId)) byShow.set(a.showId, []);
    byShow.get(a.showId)!.push(a);
  }

  const picked: RepetitionExcerpt[] = [];
  for (const showAppearances of byShow.values()) {
    const best =
      showAppearances.find((a) => a.sourceType === "youtube_transcript") ??
      showAppearances.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0];
    picked.push({ episodeId: best.episodeId, showName: best.showName, text: best.rawText.slice(0, EXCERPT_CHAR_CAP) });
    if (picked.length >= MAX_EXCERPTS) break;
  }
  return picked;
}

export async function computeGuestProfiles(): Promise<{
  computed: number;
  skipped: number;
  usage: ChatUsage[];
}> {
  const now = new Date();
  const since = new Date(now.getTime() - SIX_MONTHS_MS);

  const rows = await db
    .select({
      normalizedGuest: episodeEntities.normalizedValue,
      displayName: episodeEntities.value,
      episodeId: episodes.id,
      showId: shows.id,
      showName: shows.name,
      publishedAt: episodes.publishedAt,
      sourceType: episodes.sourceType,
      rawText: episodes.rawText,
    })
    .from(episodeEntities)
    .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(episodeEntities.type, "guest"), gte(episodes.publishedAt, since)));

  const groups = new Map<string, { displayName: string; appearances: Appearance[] }>();
  for (const row of rows) {
    if (!groups.has(row.normalizedGuest)) {
      groups.set(row.normalizedGuest, { displayName: row.displayName, appearances: [] });
    }
    groups.get(row.normalizedGuest)!.appearances.push({
      episodeId: row.episodeId,
      showId: row.showId,
      showName: row.showName,
      publishedAt: row.publishedAt,
      sourceType: row.sourceType,
      rawText: row.rawText,
    });
  }

  const existingRows = await db.select().from(guestProfiles);
  const existingByGuest = new Map(existingRows.map((r) => [r.normalizedGuest, r]));

  let computed = 0;
  let skipped = 0;
  const usage: ChatUsage[] = [];

  for (const [normalizedGuest, group] of groups) {
    const distinctShows6m = new Set(group.appearances.map((a) => a.showId)).size;
    // Scope matches buildWeeklyBrief's guestLeads criterion — only guests on 2+ distinct
    // shows in 6 months surface as leads, so only those get a profile computed.
    if (distinctShows6m < 2) continue;

    const episodeIds = group.appearances.map((a) => a.episodeId);
    const inputHash = inputHashOf(episodeIds);
    const existing = existingByGuest.get(normalizedGuest);
    if (existing && existing.inputHash === inputHash) {
      skipped++;
      continue;
    }

    const recent30 = group.appearances.filter((a) => now.getTime() - a.publishedAt.getTime() <= THIRTY_DAYS_MS);
    const recent90 = group.appearances.filter((a) => now.getTime() - a.publishedAt.getTime() <= NINETY_DAYS_MS);
    const velocity30d = recent30.length;
    const distinctShows30d = new Set(recent30.map((a) => a.showId)).size;
    const appearances90d = recent90.length;
    const lastAppearance = group.appearances.reduce((max, a) => (a.publishedAt > max ? a.publishedAt : max), group.appearances[0].publishedAt);
    const daysSinceLast = Math.floor((now.getTime() - lastAppearance.getTime()) / (24 * 60 * 60 * 1000));

    let repetitionScore: number | null = null;
    let repeatedStories: { story: string; episodeIds: number[] }[] = [];
    let freshMaterial: { point: string; episodeId: number }[] = [];

    const excerpts = pickExcerpts(group.appearances);
    if (excerpts.length >= 2) {
      try {
        const { result, usage: callUsage } = await scoreRepetition(group.displayName, excerpts);
        repetitionScore = result.repetitionScore;
        repeatedStories = result.repeatedStories;
        freshMaterial = result.freshMaterial;
        usage.push(callUsage);
      } catch (err) {
        // Leave repetitionScore null ("repetition not assessed") — never silently default to 0.
        console.error(`Repetition scoring failed for guest ${group.displayName}:`, err);
      }
    }

    const { verdict, nextWindowDate } = computeVerdict({
      velocity30d,
      appearances90d,
      distinctShows30d,
      repetitionScore,
      lastAppearance,
    });

    await db
      .insert(guestProfiles)
      .values({
        normalizedGuest,
        displayName: group.displayName,
        verdict,
        repetitionScore,
        velocity30d,
        appearances90d,
        distinctShows30d,
        distinctShows6m,
        daysSinceLast,
        nextWindowDate,
        repeatedStories,
        freshMaterial,
        inputHash,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: guestProfiles.normalizedGuest,
        set: {
          displayName: group.displayName,
          verdict,
          repetitionScore,
          velocity30d,
          appearances90d,
          distinctShows30d,
          distinctShows6m,
          daysSinceLast,
          nextWindowDate,
          repeatedStories,
          freshMaterial,
          inputHash,
          computedAt: now,
        },
      });

    computed++;
  }

  return { computed, skipped, usage };
}
