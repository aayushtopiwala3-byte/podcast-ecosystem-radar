import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { episodeEntities, episodes, interviewPrepDrafts, inviteDrafts, shows } from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { draftInviteEmail, type UnaskedAngle } from "@/lib/gemini/invite";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { guestValue, topicValue, evidenceEpisodeId } = body;

  if (typeof guestValue !== "string" || !guestValue.trim()) {
    return NextResponse.json({ error: "guestValue is required" }, { status: 400 });
  }

  let evidence: { episodeTitle: string; showName: string; excerpt: string | null } | null = null;
  if (evidenceEpisodeId) {
    const rows = await db
      .select({ title: episodes.title, showName: shows.name, excerpt: episodeEntities.excerpt })
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
      evidence = { episodeTitle: rows[0].title, showName: rows[0].showName, excerpt: rows[0].excerpt ?? null };
    }
  }

  // Feed the invite from the most recent differentiated-prep white-space angle for this guest
  // (spec 1.2) — the single unasked-question hook is what makes a 5th podcast ask land.
  let unaskedAngle: UnaskedAngle | null = null;
  const [latestPrep] = await db
    .select({ whiteSpace: interviewPrepDrafts.whiteSpace })
    .from(interviewPrepDrafts)
    .where(and(eq(interviewPrepDrafts.guestValue, guestValue), isNotNull(interviewPrepDrafts.whiteSpace)))
    .orderBy(desc(interviewPrepDrafts.createdAt))
    .limit(1);
  if (latestPrep?.whiteSpace) {
    const whiteSpace = latestPrep.whiteSpace as { question: string; why: string }[];
    if (whiteSpace.length > 0) unaskedAngle = whiteSpace[0];
  }

  let draft;
  try {
    ({ draft } = await draftInviteEmail({ guestName: guestValue, topic: topicValue ?? null, evidence, unaskedAngle }));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to draft invite" }, { status: 502 });
  }

  const [row] = await db
    .insert(inviteDrafts)
    .values({
      guestValue,
      topicValue: topicValue ?? null,
      subject: draft.subject,
      body: draft.body,
      status: "draft",
      evidenceEpisodeId: evidenceEpisodeId ? Number(evidenceEpisodeId) : null,
    })
    .returning();

  return NextResponse.json({ draft: row });
}
