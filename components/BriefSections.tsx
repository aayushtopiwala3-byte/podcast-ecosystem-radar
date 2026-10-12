"use client";

import { useState } from "react";
import type { BriefPayload, EvidenceItem } from "@/lib/brief/build";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <ul className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
      {evidence.map((e, i) => (
        <li key={i} className="text-sm">
          <a
            href={e.episodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            {e.episodeTitle}
          </a>
          <div className="text-xs text-[var(--text-dim)] mt-0.5">
            {e.showName} · {fmtDate(e.publishedAt)}
          </div>
          {e.excerpt && (
            <blockquote className="text-xs text-[var(--text-dim)] italic mt-1 pl-2 border-l-2 border-[var(--border)]">
              "{e.excerpt}"
            </blockquote>
          )}
        </li>
      ))}
    </ul>
  );
}

function ExpandableCard({
  title,
  badge,
  badgeColor,
  evidence,
  extra,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  evidence: EvidenceItem[];
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4 fade-slide-in">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white truncate">{title}</span>
          {extra}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${badgeColor}22`, color: badgeColor }}>
            {badge}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
      {open && <EvidenceList evidence={evidence} />}
    </div>
  );
}

export default function BriefSections({ payload }: { payload: BriefPayload }) {
  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="Guest Leads" subtitle="Appearing on 2+ shows in the last 6 months — easiest to book right now" color="#a855f7" />
        <div className="space-y-3">
          {payload.guestLeads.length === 0 && <EmptyState text="No guests spotted on multiple shows in the last 6 months yet." />}
          {payload.guestLeads.map((g) => (
            <ExpandableCard
              key={g.value}
              title={g.value}
              badge={`${g.showCount} shows`}
              badgeColor="#a855f7"
              evidence={g.evidence}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Trending Topics" subtitle="Covered by 2+ shows in the last 6 months" color="#22d3ee" />
        <div className="space-y-3">
          {payload.trendingTopics.length === 0 && <EmptyState text="No cross-show topics in the last 6 months yet." />}
          {payload.trendingTopics.map((t) => (
            <ExpandableCard
              key={t.value}
              title={t.value}
              badge={`${t.showCount} shows`}
              badgeColor="#22d3ee"
              evidence={t.evidence}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Sponsor Signals" subtitle="Brands active across shows, trailing 6 months" color="#ec4899" />
        <div className="space-y-3">
          {payload.sponsorSignals.crossShow.length === 0 && (
            <EmptyState text="No brand has sponsored 2+ shows in the last 6 months yet." />
          )}
          {payload.sponsorSignals.crossShow.map((s) => (
            <ExpandableCard
              key={s.value}
              title={s.value}
              badge={`${s.showCount} shows`}
              badgeColor="#ec4899"
              evidence={s.evidence}
              extra={
                <span className="flex gap-1 shrink-0">
                  {s.adReadCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400">
                      {s.adReadCount} Ad read
                    </span>
                  )}
                  {s.mentionCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300">
                      {s.mentionCount} Mention
                    </span>
                  )}
                </span>
              }
            />
          ))}
        </div>

        {payload.sponsorSignals.watchlist.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Sponsor activity to watch (single-show ad-reads)</h4>
            <div className="space-y-2">
              {payload.sponsorSignals.watchlist.map((w, i) => (
                <div key={i} className="card p-3.5 flex items-center justify-between gap-3 fade-slide-in">
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{w.value}</div>
                    <a
                      href={w.episodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--text-dim)] hover:underline truncate block"
                    >
                      {w.episodeTitle} · {w.showName} · {fmtDate(w.publishedAt)}
                    </a>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400 shrink-0">
                    Ad read
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-1.5 h-6 rounded-full" style={{ background: color }} />
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-xs text-[var(--text-dim)]">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="card p-6 text-sm text-[var(--text-dim)] text-center">{text}</div>;
}
