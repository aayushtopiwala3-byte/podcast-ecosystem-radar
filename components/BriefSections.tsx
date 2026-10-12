"use client";

import { useState } from "react";
import type { BriefPayload, EvidenceItem } from "@/lib/brief/build";
import EvidenceList, { fmtDate } from "./EvidenceList";
import InviteComposer from "./InviteComposer";

function ExpandableCard({
  title,
  badge,
  badgeColor,
  evidence,
  extra,
  footer,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  evidence: EvidenceItem[];
  extra?: React.ReactNode;
  footer?: React.ReactNode;
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
      {footer}
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
              extra={
                <span className="flex gap-1 shrink-0">
                  {g.urgent && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      Act fast — 2+ shows this month
                    </span>
                  )}
                  {g.overexposed && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      Overexposed — 4+ appearances this quarter
                    </span>
                  )}
                </span>
              }
              footer={<InviteComposer guestValue={g.value} evidenceEpisodeId={g.evidence[0]?.episodeId} />}
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

        <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Tier 1 — paid ad-reads on 2+ shows</h4>
        <div className="space-y-3">
          {payload.sponsorSignals.tier1.length === 0 && (
            <EmptyState text="No brand has a paid ad-read on 2+ shows in the last 6 months yet." />
          )}
          {payload.sponsorSignals.tier1.map((s) => (
            <ExpandableCard
              key={s.value}
              title={s.value}
              badge={`${s.showCount} shows`}
              badgeColor="#ec4899"
              evidence={s.evidence}
              extra={
                <span className="flex gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400">
                    {s.adReadCount} Ad read
                  </span>
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

        {payload.sponsorSignals.singleShowAdReads.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Single-show ad-reads (not yet Tier 1)</h4>
            <div className="space-y-2">
              {payload.sponsorSignals.singleShowAdReads.map((w, i) => (
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

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Tier 2 — organic mentions only</h4>
          <div className="space-y-3">
            {payload.sponsorSignals.tier2.length === 0 && (
              <EmptyState text="No organic-only sponsor mentions in the last 6 months yet." />
            )}
            {payload.sponsorSignals.tier2.map((s) => (
              <ExpandableCard
                key={s.value}
                title={s.value}
                badge={`${s.showCount} shows`}
                badgeColor="#ec4899"
                evidence={s.evidence}
                extra={
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 shrink-0">
                    {s.mentionCount} Mention
                  </span>
                }
              />
            ))}
          </div>
        </div>

        {payload.sponsorSignals.tier3.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">
              Tier 3 — AI suggestion, not sourced from monitored podcasts, unverified
            </h4>
            <div className="space-y-2">
              {payload.sponsorSignals.tier3.map((s, i) => (
                <div key={i} className="card p-3.5 fade-slide-in">
                  <div className="font-medium text-white">{s.value}</div>
                  <div className="text-xs text-[var(--text-dim)] mt-0.5">Relevant to: {s.topic}</div>
                  <p className="text-xs text-[var(--text-dim)] mt-1">{s.reason}</p>
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
