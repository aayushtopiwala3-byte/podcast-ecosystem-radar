import { Resend } from "resend";
import type { TrippedAlert } from "../alerts/evaluate";

const KIND_LABEL: Record<TrippedAlert["kind"], { label: string; color: string }> = {
  guest_book_now: { label: "Guest — Book now", color: "#a855f7" },
  topic_emerging: { label: "Topic — Emerging", color: "#22d3ee" },
  brand_new_entrant: { label: "Brand — New entrant", color: "#ec4899" },
};

export function buildAlertEmailHtml(alerts: TrippedAlert[], dashboardUrl: string): string {
  const items = alerts.map((a) => {
    const { label, color } = KIND_LABEL[a.kind];
    return `
    <div style="margin-bottom:16px; padding:12px 16px; border-left:3px solid ${color};">
      <div style="font-size:11px; font-weight:600; color:${color}; text-transform:uppercase; letter-spacing:0.03em;">${label}</div>
      <div style="font-weight:600; margin-top:2px;">${a.displayName}</div>
      <div style="color:#64748b; font-size:13px; margin-top:2px;">${a.detail}</div>
      ${a.evidenceUrl ? `<a href="${a.evidenceUrl}" style="font-size:12px; color:${color};">Evidence →</a>` : ""}
    </div>`;
  });

  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width:640px; margin:0 auto; color:#0f172a;">
    <h1 style="font-size:20px;">Podcast Radar — Off-cycle alert</h1>
    <p style="color:#64748b; font-size:13px;">
      ${alerts.length} newsworthy change${alerts.length === 1 ? "" : "s"} since the last daily check. Nothing else moved.
    </p>
    ${items.join("")}
    <p style="margin-top:28px;">
      <a href="${dashboardUrl}" style="background:#7c3aed;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;">
        Open full dashboard →
      </a>
    </p>
  </div>`;
}

export async function sendAlertEmail(alerts: TrippedAlert[]) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const html = buildAlertEmailHtml(alerts, dashboardUrl);

  const result = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.BRIEF_RECIPIENT_EMAIL!,
    subject: `Podcast Radar — ${alerts.length} off-cycle alert${alerts.length === 1 ? "" : "s"}`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }

  return result;
}
