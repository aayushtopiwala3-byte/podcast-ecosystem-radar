import { Resend } from "resend";
import type { BriefPayload } from "../brief/build";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function evidenceHtml(ev: { showName: string; episodeTitle: string; episodeUrl: string; publishedAt: string; excerpt: string | null }[]) {
  return ev
    .map(
      (e) => `<li style="margin-bottom:6px;"><a href="${e.episodeUrl}" style="color:#3b82f6;">${e.episodeTitle}</a> — ${e.showName}, ${fmtDate(
        e.publishedAt
      )}${e.excerpt ? `<br/><em style="color:#64748b;">"${e.excerpt}"</em>` : ""}</li>`
    )
    .join("");
}

export function buildBriefEmailHtml(payload: BriefPayload, dashboardUrl: string): string {
  const guestsHtml = payload.guestLeads.length
    ? payload.guestLeads
        .map(
          (g) => `<div style="margin-bottom:16px;"><strong style="color:#a855f7;">${g.value}</strong> — on ${g.showCount} shows this month<ul>${evidenceHtml(
            g.evidence
          )}</ul></div>`
        )
        .join("")
    : "<p>No guests appeared on 2+ monitored shows this month.</p>";

  const topicsHtml = payload.trendingTopics.length
    ? payload.trendingTopics
        .map(
          (t) => `<div style="margin-bottom:16px;"><strong style="color:#22d3ee;">${t.value}</strong> — on ${t.showCount} shows this week<ul>${evidenceHtml(
            t.evidence
          )}</ul></div>`
        )
        .join("")
    : "<p>No topics covered by 2+ shows in the last 7 days.</p>";

  const sponsorCrossHtml = payload.sponsorSignals.crossShow.length
    ? payload.sponsorSignals.crossShow
        .map(
          (s) =>
            `<div style="margin-bottom:16px;"><strong style="color:#ec4899;">${s.value}</strong> — on ${s.showCount} shows (last 30 days), ${s.adReadCount} ad-read(s), ${s.mentionCount} mention(s)<ul>${evidenceHtml(
              s.evidence
            )}</ul></div>`
        )
        .join("")
    : "<p>No brands crossed 2+ shows in the last 30 days.</p>";

  const sponsorWatchHtml = payload.sponsorSignals.watchlist.length
    ? `<ul>${payload.sponsorSignals.watchlist
        .map(
          (w) =>
            `<li style="margin-bottom:6px;"><strong>${w.value}</strong> (ad-read) — <a href="${w.episodeUrl}" style="color:#3b82f6;">${w.episodeTitle}</a>, ${w.showName}, ${fmtDate(
              w.publishedAt
            )}</li>`
        )
        .join("")}</ul>`
    : "<p>No single-show ad-reads to flag.</p>";

  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width:640px; margin:0 auto; color:#0f172a;">
    <h1 style="font-size:22px;">Your Monday Podcast Radar — ${fmtDate(payload.generatedAt)}</h1>
    <p style="color:#64748b;">Week of ${payload.weekStartDate}</p>

    <h2 style="color:#7c3aed; border-bottom:2px solid #a855f7; padding-bottom:6px;">Guest Leads</h2>
    ${guestsHtml}

    <h2 style="color:#3b82f6; border-bottom:2px solid #22d3ee; padding-bottom:6px;">Trending Topics</h2>
    ${topicsHtml}

    <h2 style="color:#d946ef; border-bottom:2px solid #ec4899; padding-bottom:6px;">Sponsor Signals</h2>
    <h3>Cross-show sponsors</h3>
    ${sponsorCrossHtml}
    <h3>Single-show ad-reads to watch</h3>
    ${sponsorWatchHtml}

    <p style="margin-top:32px;"><a href="${dashboardUrl}" style="background:#7c3aed;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;">Open full dashboard →</a></p>
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
