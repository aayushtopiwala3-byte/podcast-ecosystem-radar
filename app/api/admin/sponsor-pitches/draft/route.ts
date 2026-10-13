import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { sponsorPitches } from "@/lib/db/schema";
import { computeMoneyMap, ADITYA_MONTHLY_LISTENERS } from "@/lib/stats/money-map";
import { draftSponsorPitch, type ReachBand } from "@/lib/gemini/sponsor-pitch";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { brand } = body;
  if (typeof brand !== "string" || !brand.trim()) {
    return NextResponse.json({ error: "brand is required" }, { status: 400 });
  }

  const moneyMap = await computeMoneyMap();
  const stated = [...moneyMap.newEntrants, ...moneyMap.scaling, ...moneyMap.steady, ...moneyMap.churned];
  const match = stated.find((b) => b.value === brand);
  const mentionMatch = !match ? moneyMap.mentionOnly.find((b) => b.value === brand) : null;

  if (!match && !mentionMatch) {
    return NextResponse.json({ error: "Brand not found in the current money map" }, { status: 404 });
  }

  const state = match ? match.state : "mention_only";
  const sourceEvidence = match ? match.evidence : mentionMatch!.evidence;
  const evidence = sourceEvidence.map((e) => ({
    showName: e.showName,
    episodeTitle: e.episodeTitle,
    publishedAt: e.publishedAt,
    excerpt: e.excerpt,
  }));
  const reachBands: ReachBand[] = match
    ? match.reach.map((r) => ({
        showName: r.showName,
        medianViewCount: r.medianViewCount,
        band: r.medianViewCount == null ? "unknown" : r.medianViewCount < ADITYA_MONTHLY_LISTENERS ? "under-reach" : "at-or-above",
      }))
    : [];

  let draft;
  try {
    ({ draft } = await draftSponsorPitch({ brand, state, evidence, reachBands }));
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to draft sponsor pitch" }, { status: 502 });
  }

  const [row] = await db
    .insert(sponsorPitches)
    .values({
      brand,
      state,
      subject: draft.subject,
      body: draft.body,
      evidence: sourceEvidence,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ draft: row });
}
