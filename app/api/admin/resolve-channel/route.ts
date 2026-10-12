import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { handle, query } = await req.json();
  const apiKey = process.env.YOUTUBE_API_KEY!;

  try {
    if (handle) {
      const cleanHandle = handle.replace(/^@/, "");
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(
          cleanHandle
        )}&key=${apiKey}`
      );
      const json = await res.json();
      if (json.items?.length) {
        return NextResponse.json({ channelId: json.items[0].id, title: json.items[0].snippet.title });
      }
    }
    if (query) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
          query
        )}&key=${apiKey}`
      );
      const json = await res.json();
      if (json.items?.length) {
        const channelId = json.items[0].snippet.channelId || json.items[0].id.channelId;
        return NextResponse.json({ channelId, title: json.items[0].snippet.title });
      }
    }
    return NextResponse.json({ error: "No channel resolved. Do not guess — check the handle manually." }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
