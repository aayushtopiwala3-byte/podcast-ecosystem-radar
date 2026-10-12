import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(shows).orderBy(desc(shows.createdAt));
  return NextResponse.json({ shows: rows });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { name, platform, youtubeChannelId, youtubeHandle, rssUrl } = body;

  if (!name || !platform) {
    return NextResponse.json({ error: "name and platform are required" }, { status: 400 });
  }
  if (platform === "youtube" && !youtubeChannelId) {
    return NextResponse.json(
      { error: "youtubeChannelId is required for youtube shows (resolve it first, do not guess)" },
      { status: 400 }
    );
  }
  if (platform === "rss" && !rssUrl) {
    return NextResponse.json({ error: "rssUrl is required for rss shows" }, { status: 400 });
  }

  const slug = slugify(name);

  const [row] = await db
    .insert(shows)
    .values({
      name,
      slug,
      platform,
      youtubeChannelId: youtubeChannelId ?? null,
      youtubeHandle: youtubeHandle ?? null,
      rssUrl: rssUrl ?? null,
      active: true,
    })
    .returning();

  return NextResponse.json({ show: row });
}
