import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof shows.$inferInsert> = {};
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.youtubeChannelId === "string" || body.youtubeChannelId === null)
    updates.youtubeChannelId = body.youtubeChannelId;
  if (typeof body.youtubeHandle === "string" || body.youtubeHandle === null)
    updates.youtubeHandle = body.youtubeHandle;
  if (typeof body.rssUrl === "string" || body.rssUrl === null) updates.rssUrl = body.rssUrl;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [row] = await db.update(shows).set(updates).where(eq(shows.id, Number(id))).returning();
  return NextResponse.json({ show: row });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(shows).where(eq(shows.id, Number(id)));
  return NextResponse.json({ ok: true });
}
