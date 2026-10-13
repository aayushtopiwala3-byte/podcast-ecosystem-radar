import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { sponsorPitches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendSponsorPitchEmail } from "@/lib/email/send-pitch";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db.select().from(sponsorPitches).where(eq(sponsorPitches.id, Number(id)));
  const draft = rows[0];
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  try {
    await sendSponsorPitchEmail({ subject: draft.subject, body: draft.body });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to send sponsor pitch email" }, { status: 502 });
  }

  const [row] = await db
    .update(sponsorPitches)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(sponsorPitches.id, Number(id)))
    .returning();

  return NextResponse.json({ draft: row });
}
