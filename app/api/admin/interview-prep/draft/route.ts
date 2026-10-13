import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodeEntities, episodes, interviewPrepDrafts, shows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { draftInterviewPrep } from "@/lib/gemini/interview-prep";
import { extractCoverage, generateWhiteSpace, type CoveredQuestion, type WhiteSpaceQuestion } from "@/lib/gemini/coverage";
import { getTopicPerformance } from "@/lib/stats/topic-performance";
import { normalizeGuestName } from "@/lib/ingest/normalize";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { topicValue, guestValue, guestSource, evidenceEpisodeId, suggestionReason } = body;

  if (typeof topicValue !== "string" || !topicValue.trim()) {
    return NextResponse.json({ error: "topicValue is required" }, { status: 400 });
  }
  if (typeof guestValue !== "string" || !guestValue.trim()) {
    return NextResponse.json({ error: "guestValue is required" }, { status: 400 });
  }
  if (guestSource !== "proven" && guestSource !== "suggested") {
    return NextResponse.json({ error: "guestSource must be 'proven' or 'suggested'" }, { status: 400 });
  }

  const allTopics = await getTopicPerformance();
  const topicPerformance = allTopics.find((t) => t.tag === topicValue) ?? null;

  let evidence: { episodeTitle: string; showName: string; excerpt: string | null; viewRatio: number | null } | null =
    null;
  if (evidenceEpisodeId) {
    const rows = await db
      .select({
        title: episodes.title,
        showName: shows.name,
        excerpt: episodeEntities.excerpt,
        viewRatio: episodes.viewRatio,
      })
      .from(episodes)
      .innerJoin(shows, eq(episodes.showId, shows.id))
      .leftJoin(
        episodeEntities,
        and(
          eq(episodeEntities.episodeId, episodes.id),
          eq(episodeEntities.type, "guest"),
          eq(episodeEntities.value, guestValue)
        )
      )
      .where(eq(episodes.id, Number(evidenceEpisodeId)));
    if (rows[0]) {
      evidence = {
        episodeTitle: rows[0].title,
        showName: rows[0].showName,
        excerpt: rows[0].excerpt ?? null,
        viewRatio: rows[0].viewRatio,
      };
    }
  }

  let draft;
  try {
    ({ draft } = await draftInterviewPrep({
      guestName: guestValue,
      guestSource,
      topic: topicValue,
      topicPerformance: topicPerformance
        ? { showCount: topicPerformance.showCount, avgViewRatio: topicPerformance.avgViewRatio }
        : null,
      evidence,
      suggestionReason: typeof suggestionReason === "string" ? suggestionReason : null,
    }));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to draft interview prep" }, { status: 502 });
  }

  // Differentiated prep (spec 1.2): only for "proven" guests who have monitored-show history
  // to diff against — Step A extracts what's already been covered, Step B generates the
  // complement. "suggested" guests have no transcript history, so both stay null.
  let coveredQuestions: CoveredQuestion[] | null = null;
  let whiteSpace: WhiteSpaceQuestion[] | null = null;

  if (guestSource === "proven") {
    const appearanceRows = await db
      .select({
        episodeId: episodes.id,
        episodeTitle: episodes.title,
        showName: shows.name,
        publishedAt: episodes.publishedAt,
        rawText: episodes.rawText,
      })
      .from(episodeEntities)
      .innerJoin(episodes, eq(episodeEntities.episodeId, episodes.id))
      .innerJoin(shows, eq(episodes.showId, shows.id))
      .where(and(eq(episodeEntities.type, "guest"), eq(episodeEntities.normalizedValue, normalizeGuestName(guestValue))));

    if (appearanceRows.length > 0) {
      const appearances = [...appearanceRows]
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .map((a) => ({ episodeId: a.episodeId, episodeTitle: a.episodeTitle, showName: a.showName, text: a.rawText }));

      try {
        const coverage = await extractCoverage(guestValue, appearances);
        coveredQuestions = coverage.coveredQuestions;
        const whiteSpaceResult = await generateWhiteSpace(guestValue, coveredQuestions);
        whiteSpace = whiteSpaceResult.whiteSpace;
        if (whiteSpace.length > 0) {
          draft.questions = whiteSpace.map((w) => w.question);
        }
      } catch (err) {
        // Leave coveredQuestions/whiteSpace null and fall back to draftInterviewPrep's
        // generic questions rather than failing the whole draft.
        console.error(`Differentiated prep failed for guest ${guestValue}:`, err);
      }
    }
  }

  const [row] = await db
    .insert(interviewPrepDrafts)
    .values({
      topicValue,
      guestValue,
      guestSource,
      questions: draft.questions,
      script: draft.script,
      evidenceEpisodeId: evidenceEpisodeId ? Number(evidenceEpisodeId) : null,
      coveredQuestions,
      whiteSpace,
    })
    .returning();

  return NextResponse.json({ draft: row });
}
