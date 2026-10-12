import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodeEntities, episodes, interviewPrepDrafts, shows } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { draftInterviewPrep } from "@/lib/gemini/interview-prep";
import { getTopicPerformance } from "@/lib/stats/topic-performance";

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
    draft = await draftInterviewPrep({
      guestName: guestValue,
      guestSource,
      topic: topicValue,
      topicPerformance: topicPerformance
        ? { showCount: topicPerformance.showCount, avgViewRatio: topicPerformance.avgViewRatio }
        : null,
      evidence,
      suggestionReason: typeof suggestionReason === "string" ? suggestionReason : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to draft interview prep" }, { status: 502 });
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
    })
    .returning();

  return NextResponse.json({ draft: row });
}
