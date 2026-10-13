"use client";

import { useState } from "react";
import type { BriefPayload, EvidenceItem, GuestProfileSummary, TopicLifecycleSummary } from "@/lib/brief/build";
import type { BrandState, MoneyMapBrand, MentionOnlyBrand, ShowReachInfo } from "@/lib/stats/money-map";
import EvidenceList from "./EvidenceList";
import { fmtDate } from "@/lib/format";
import InviteComposer from "./InviteComposer";
import SponsorPitchComposer from "./SponsorPitchComposer";
import TopicSparkline from "./charts/TopicSparkline";

const VERDICT_STYLE: Record<GuestProfileSummary["verdict"], { label: string; color: string }> = {
  oversaturated: { label: "Oversaturated", color: "#f43f5e" },
  wait: { label: "Wait", color: "#f59e0b" },
  book_now: { label: "Book now", color: "#22c55e" },
  warm_lead: { label: "Warm lead", color: "#94a3b8" },
};

function VerdictChip({ profile }: { profile: GuestProfileSummary }) {
  const { label, color } = VERDICT_STYLE[profile.verdict];
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}

const CLASSIFICATION_STYLE: Record<TopicLifecycleSummary["classification"], { label: string; color: string }> = {
  insufficient_data: { label: "Insufficient data", color: "#94a3b8" },
  emerging: { label: "Emerging", color: "#22c55e" },
  peaking: { label: "Peaking", color: "#f59e0b" },
  evergreen: { label: "Evergreen", color: "#3b82f6" },
  fading: { label: "Fading", color: "#f43f5e" },
  mixed: { label: "Mixed signal", color: "#94a3b8" },
};

function LifecycleChip({ lifecycle }: { lifecycle: TopicLifecycleSummary }) {
  const { label, color } = CLASSIFICATION_STYLE[lifecycle.classification];
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  );
}

function TopicLifecycleDetail({ lifecycle }: { lifecycle: TopicLifecycleSummary }) {
  const { color } = CLASSIFICATION_STYLE[lifecycle.classification];
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color }}>
          {lifecycle.copy}
        </p>
        <TopicSparkline
          avgRatioB1={lifecycle.avgRatioB1}
          avgRatioB2={lifecycle.avgRatioB2}
          avgRatioB3={lifecycle.avgRatioB3}
          color={color}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Shows 61-90d", value: lifecycle.spreadB1 },
          { label: "Shows 31-60d", value: lifecycle.spreadB2 },
          { label: "Shows 0-30d", value: lifecycle.spreadB3 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white/5 py-2 px-1">
            <div className="text-sm font-semibold text-white">{s.value}</div>
            <div className="text-[10px] text-[var(--text-dim)]">{s.label}</div>
          </div>
        ))}
      </div>
      {lifecycle.classification === "peaking" && lifecycle.counterAngles.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-[10px] font-semibold text-amber-400 mb-2">
            AI suggestion — counter-programming angles, unverified
          </div>
          <ul className="space-y-2">
            {lifecycle.counterAngles.map((a, i) => (
              <li key={i} className="text-xs text-[var(--text-dim)]">
                <span className="text-white font-medium">{a.angle}</span> — {a.rationale}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const BRAND_STATE_STYLE: Record<BrandState, { label: string; color: string; note: string }> = {
  new_entrant: { label: "New entrant", color: "#22c55e", note: "Highest priority — budget just opened" },
  scaling: { label: "Scaling", color: "#3b82f6", note: "Actively expanding" },
  steady: { label: "Steady", color: "#94a3b8", note: "Flat, ongoing spend" },
  churned: { label: "Churned", color: "#f59e0b", note: "Budget ended or between flights — worth a timed pitch" },
};

// Mirrors lib/stats/money-map.ts's ADITYA_MONTHLY_LISTENERS — duplicated here (not imported)
// so a client component never pulls in the server-only db module that file depends on.
const ADITYA_MONTHLY_LISTENERS_DISPLAY = 9000;

function ReachBreakdown({ reach }: { reach: ShowReachInfo[] }) {
  if (reach.length === 0) return null;
  return (
    <div className="text-xs text-[var(--text-dim)]">
      <div className="mb-1">
        Reach — trailing 90-day median YouTube views per show. Not directly comparable to monthly podcast
        listeners; treat as directional only.
      </div>
      <ul className="space-y-0.5">
        {reach.map((r) => (
          <li key={r.showId}>
            {r.showName}:{" "}
            {r.medianViewCount != null ? (
              <span className={r.medianViewCount < ADITYA_MONTHLY_LISTENERS_DISPLAY ? "text-amber-400" : "text-white"}>
                {r.medianViewCount.toLocaleString()} median views
              </span>
            ) : (
              <span className="text-slate-500">reach unknown</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoneyMapBrandCard({ brand }: { brand: MoneyMapBrand }) {
  const { label, color, note } = BRAND_STATE_STYLE[brand.state];
  return (
    <ExpandableCard
      title={brand.value}
      badge={label}
      badgeColor={color}
      evidence={brand.evidence}
      extra={
        <span className="flex gap-1 shrink-0">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color }}>
            {note}
          </span>
          {brand.underReachBuyer && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
              Under-reach buyer
            </span>
          )}
        </span>
      }
      footer={
        <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-2">
          <ReachBreakdown reach={brand.reach} />
          <SponsorPitchComposer brand={brand.value} />
        </div>
      }
    />
  );
}

function GuestProfileDetail({ profile }: { profile: GuestProfileSummary }) {
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-3">
      <p className="text-xs" style={{ color: VERDICT_STYLE[profile.verdict].color }}>
        {profile.copy}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          { label: "Velocity (30d)", value: profile.velocity30d },
          { label: "Appearances (90d)", value: profile.appearances90d },
          { label: "Distinct shows (30d)", value: profile.distinctShows30d },
          { label: "Days since last", value: profile.daysSinceLast },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white/5 py-2 px-1">
            <div className="text-sm font-semibold text-white">{s.value}</div>
            <div className="text-[10px] text-[var(--text-dim)]">{s.label}</div>
          </div>
        ))}
      </div>
      {profile.repetitionScore !== null && (
        <div className="text-xs text-[var(--text-dim)]">
          Repetition score: <span className="text-white font-medium">{profile.repetitionScore.toFixed(2)}</span>
        </div>
      )}
      {profile.repeatedStories.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[var(--text-dim)] mb-1.5">Repeated stories</div>
          <ul className="space-y-1.5">
            {profile.repeatedStories.map((s, i) => (
              <li key={i} className="text-xs text-[var(--text-dim)]">
                "{s.story}" — episodes {s.episodeIds.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExpandableCard({
  title,
  badge,
  badgeColor,
  evidence,
  extra,
  footer,
  profile,
  lifecycle,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  evidence: EvidenceItem[];
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  profile?: GuestProfileSummary | null;
  lifecycle?: TopicLifecycleSummary | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4 fade-slide-in">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-white truncate">{title}</span>
          {profile && <VerdictChip profile={profile} />}
          {lifecycle && <LifecycleChip lifecycle={lifecycle} />}
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
      {open && profile && <GuestProfileDetail profile={profile} />}
      {open && lifecycle && <TopicLifecycleDetail lifecycle={lifecycle} />}
      {open && <EvidenceList evidence={evidence} />}
      {footer}
    </div>
  );
}

export default function BriefSections({ payload }: { payload: BriefPayload }) {
  const urgentLeads = payload.guestLeads.filter((g) => g.urgent);
  const validatedLeads = payload.guestLeads.filter((g) => !g.urgent);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="Guest Leads" subtitle="Two windows: an active-media-round signal and a wider validation pool — see note below" color="#a855f7" />
        <p className="text-xs text-[var(--text-dim)] mb-4">
          "On 2+ shows in the last 30 days" is the active media-round signal — book fast, while the story is fresh.
          "Validated over the last 6 months" is a wider pool showing guests who have proven cross-show appeal, but
          aren't necessarily in a media round right now.
        </p>

        <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">On 2+ shows in the last 30 days — active media round</h4>
        <div className="space-y-3">
          {urgentLeads.length === 0 && <EmptyState text="No guest is on 2+ shows in the last 30 days right now." />}
          {urgentLeads.map((g) => (
            <ExpandableCard
              key={g.value}
              title={g.value}
              badge={`${g.showCount} shows`}
              badgeColor="#a855f7"
              evidence={g.evidence}
              profile={g.profile}
              extra={
                <span className="flex gap-1 shrink-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    Act fast — 2+ shows this month
                  </span>
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

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Validated over the last 6 months — not currently in a media round</h4>
          <div className="space-y-3">
            {validatedLeads.length === 0 && <EmptyState text="No other guests spotted on multiple shows in the last 6 months yet." />}
            {validatedLeads.map((g) => (
              <ExpandableCard
                key={g.value}
                title={g.value}
                badge={`${g.showCount} shows`}
                badgeColor="#a855f7"
                evidence={g.evidence}
                profile={g.profile}
                extra={
                  g.overexposed ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                      Overexposed — 4+ appearances this quarter
                    </span>
                  ) : undefined
                }
                footer={<InviteComposer guestValue={g.value} evidenceEpisodeId={g.evidence[0]?.episodeId} />}
              />
            ))}
          </div>
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
              lifecycle={t.lifecycle}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Money Map" subtitle="Brand ad-read state changes, trailing 90 days" color="#ec4899" />
        <p className="text-xs text-[var(--text-dim)] mb-4">
          Built from paid ad-read rows only — passing mentions are never counted as spend evidence. Reach
          comparisons weigh each show's trailing-90-day median YouTube view count against Aditya's roughly
          9,000 monthly listeners; these are different units and not directly comparable, so any "Under-reach
          buyer" flag is a directional signal, not a precise claim.
        </p>

        {(() => {
          // Brief rows cached before this field existed won't have it — fall back to empty.
          const moneyMap = payload.moneyMap ?? {
            newEntrants: [],
            scaling: [],
            steady: [],
            churned: [],
            mentionOnly: [],
          };
          return (
            <>
              {moneyMap.newEntrants.length === 0 &&
                moneyMap.scaling.length === 0 &&
                moneyMap.steady.length === 0 &&
                moneyMap.churned.length === 0 &&
                moneyMap.mentionOnly.length === 0 && (
                  <EmptyState text="No brand ad-read or mention activity in the last 90 days yet." />
                )}

              {moneyMap.newEntrants.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">New entrants — highest pitch priority</h4>
                  <div className="space-y-3">
                    {moneyMap.newEntrants.map((b) => (
                      <MoneyMapBrandCard key={b.value} brand={b} />
                    ))}
                  </div>
                </div>
              )}

              {moneyMap.scaling.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Scaling</h4>
                  <div className="space-y-3">
                    {moneyMap.scaling.map((b) => (
                      <MoneyMapBrandCard key={b.value} brand={b} />
                    ))}
                  </div>
                </div>
              )}

              {moneyMap.churned.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Churned — worth a timed pitch</h4>
                  <div className="space-y-3">
                    {moneyMap.churned.map((b) => (
                      <MoneyMapBrandCard key={b.value} brand={b} />
                    ))}
                  </div>
                </div>
              )}

              {moneyMap.steady.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Steady</h4>
                  <div className="space-y-3">
                    {moneyMap.steady.map((b) => (
                      <MoneyMapBrandCard key={b.value} brand={b} />
                    ))}
                  </div>
                </div>
              )}

              {moneyMap.mentionOnly.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-3">Discussed, no evidence of spend</h4>
                  <div className="space-y-3">
                    {moneyMap.mentionOnly.map((b) => (
                      <ExpandableCard
                        key={b.value}
                        title={b.value}
                        badge={`${b.showCount} shows`}
                        badgeColor="#94a3b8"
                        evidence={b.evidence}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
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
