import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { computeTopicLifecycles } from "@/lib/topics/lifecycle";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await computeTopicLifecycles();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
