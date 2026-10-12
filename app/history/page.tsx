import Link from "next/link";
import { db } from "@/lib/db";
import { weeklyBriefs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import type { BriefPayload } from "@/lib/brief/build";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const briefs = await db.select().from(weeklyBriefs).orderBy(desc(weeklyBriefs.generatedAt));

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Brief History</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">Every weekly radar, archived.</p>
      </header>

      <div className="space-y-3">
        {briefs.length === 0 && <div className="card p-8 text-center text-[var(--text-dim)]">No briefs generated yet.</div>}
        {briefs.map((b) => {
          const payload = b.payload as BriefPayload;
          return (
            <Link
              key={b.id}
              href={`/history/${b.id}`}
              className="card p-5 flex items-center justify-between gap-4 fade-slide-in hover:bg-[var(--card-hover)] transition-colors block"
            >
              <div>
                <div className="font-semibold text-white">Week of {b.weekStartDate}</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  Generated {new Date(b.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge color="#a855f7" count={payload.guestLeads?.length ?? 0} label="guests" />
                <Badge color="#22d3ee" count={payload.trendingTopics?.length ?? 0} label="topics" />
                <Badge
                  color="#ec4899"
                  count={(payload.sponsorSignals?.tier1?.length ?? 0) + (payload.sponsorSignals?.tier2?.length ?? 0)}
                  label="sponsors"
                />
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    b.emailSent ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {b.emailSent ? "Emailed" : "Not sent"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${color}22`, color }}>
      {count} {label}
    </span>
  );
}
