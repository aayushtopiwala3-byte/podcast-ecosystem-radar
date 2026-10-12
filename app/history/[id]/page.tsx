import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { weeklyBriefs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import BriefSections from "@/components/BriefSections";
import type { BriefPayload } from "@/lib/brief/build";

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(weeklyBriefs).where(eq(weeklyBriefs.id, Number(id)));
  const brief = rows[0];
  if (!brief) notFound();

  const payload = brief.payload as BriefPayload;

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/history" className="text-sm text-[var(--text-dim)] hover:text-white">
        ← Back to history
      </Link>
      <header className="my-6">
        <h1 className="text-2xl font-bold text-white">Week of {brief.weekStartDate}</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Generated {new Date(brief.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
          {brief.emailSent ? "Emailed" : "Email not sent"}
        </p>
      </header>
      <BriefSections payload={payload} />
    </div>
  );
}
