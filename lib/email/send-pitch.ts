import { Resend } from "resend";

export async function sendSponsorPitchEmail(draft: { subject: string; body: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width:640px; margin:0 auto; color:#0f172a; white-space:pre-wrap;">${draft.body}</div>`;

  const result = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.BRIEF_RECIPIENT_EMAIL!,
    subject: `[Sponsor pitch] ${draft.subject}`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }

  return result;
}
