import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { interviewPrepDrafts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof interviewPrepDrafts.$inferInsert> = {};
  if (Array.isArray(body.questions)) updates.questions = body.questions;
  if (typeof body.script === "string") updates.script = body.script;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [row] = await db.update(interviewPrepDrafts).set(updates).where(eq(interviewPrepDrafts.id, Number(id))).returning();
  return NextResponse.json({ draft: row });
}
