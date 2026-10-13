import { Resend } from "resend";
import type { BriefPayload } from "../brief/build";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function summaryList(items: string[], emptyText: string) {
  if (items.length === 0) return `<p style="color:#64748b;">${emptyText}</p>`;
  return `<ul style="padding-left:18px;">${items.map((i) => `<li style="margin-bottom:4px;">${i}</li>`).join("")}</ul>`;
}

export function buildBriefEmailHtml(payload: BriefPayload, dashboardUrl: string): string {
  const urgentLeads = payload.guestLeads.filter((g) => g.urgent);
  const validatedLeads = payload.guestLeads.filter((g) => !g.urgent);
  const verdictLabel: Record<string, string> = {
    oversaturated: "Oversaturated",
    wait: "Wait",
    book_now: "Book now",
    warm_lead: "Warm lead",
  };
  const verdictTag = (g: BriefPayload["guestLeads"][number]) =>
    g.profile ? ` · <span style="color:#a855f7;">${verdictLabel[g.profile.verdict]}</span>` : "";
  const urgentItems = urgentLeads.map(
    (g) =>
      `<strong style="color:#a855f7;">${g.value}</strong> — ${g.showCount} shows · act fast${g.overexposed ? " · overexposed" : ""}${verdictTag(g)}`
  );
  const validatedItems = validatedLeads.map(
    (g) =>
      `<strong style="color:#a855f7;">${g.value}</strong> — ${g.showCount} shows${g.overexposed ? " · overexposed" : ""}${verdictTag(g)}`
  );

  const lifecycleLabel: Record<string, string> = {
    insufficient_data: "Insufficient data",
    emerging: "Emerging",
    peaking: "Peaking",
    evergreen: "Evergreen",
    fading: "Fading",
    mixed: "Mixed signal",
  };
  const lifecycleTag = (t: BriefPayload["trendingTopics"][number]) =>
    t.lifecycle ? ` · <span style="color:#22d3ee;">${lifecycleLabel[t.lifecycle.classification]}</span>` : "";
  const topicItems = payload.trendingTopics.map(
    (t) => `<strong style="color:#22d3ee;">${t.value}</strong> — ${t.showCount} shows${lifecycleTag(t)}`
  );

  const sponsorCount = payload.sponsorSignals.tier1.length + payload.sponsorSignals.tier2.length;
  const sponsorItems = [
    ...payload.sponsorSignals.tier1.map((s) => `<strong style="color:#ec4899;">${s.value}</strong> — Tier 1, ${s.showCount} shows`),
    ...payload.sponsorSignals.tier2.map((s) => `<strong style="color:#ec4899;">${s.value}</strong> — Tier 2, organic`),
  ];

  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width:640px; margin:0 auto; color:#0f172a;">
    <h1 style="font-size:22px;">Your Monday Podcast Radar — ${fmtDate(payload.generatedAt)}</h1>
    <p style="color:#64748b;">Week of ${payload.weekStartDate}</p>

    <h2 style="color:#7c3aed; border-bottom:2px solid #a855f7; padding-bottom:6px;">Guest Leads (${payload.guestLeads.length})</h2>
    <p style="color:#64748b; font-size:13px;">
      "On 2+ shows in the last 30 days" is the active media-round signal — book fast. "Validated over the last 6 months" is a wider pool, not currently in a media round.
    </p>

    <h3 style="color:#7c3aed; font-size:15px;">On 2+ shows in the last 30 days — active media round</h3>
    ${summaryList(urgentItems, "No guest is on 2+ shows in the last 30 days right now.")}

    <h3 style="color:#7c3aed; font-size:15px;">Validated over the last 6 months — not currently in a media round</h3>
    ${summaryList(validatedItems, "No other guests appeared on 2+ monitored shows in the last 6 months.")}

    <h2 style="color:#3b82f6; border-bottom:2px solid #22d3ee; padding-bottom:6px;">Trending Topics (${payload.trendingTopics.length})</h2>
    ${summaryList(topicItems, "No topics covered by 2+ shows in the last 6 months.")}

    <h2 style="color:#d946ef; border-bottom:2px solid #ec4899; padding-bottom:6px;">Sponsor Signals (${sponsorCount})</h2>
    ${summaryList(sponsorItems, "No qualifying sponsor signals in the last 6 months.")}

    <p style="margin-top:32px;">
      <a href="${dashboardUrl}" style="background:#7c3aed;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;">
        Open full dashboard for evidence, tiering &amp; drill-downs →
      </a>
    </p>
  </div>`;
}

export async function sendWeeklyBriefEmail(payload: BriefPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const html = buildBriefEmailHtml(payload, dashboardUrl);

  const result = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.BRIEF_RECIPIENT_EMAIL!,
    subject: `Your Monday Podcast Radar — ${fmtDate(payload.generatedAt)}`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }

  return result;
}
