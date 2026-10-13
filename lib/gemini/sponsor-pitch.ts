import { chatCompletion, type ChatUsage } from "../ai/gemini-flash";

export type PitchEvidenceItem = {
  showName: string;
  episodeTitle: string;
  publishedAt: string;
  excerpt: string | null;
};

export type ReachBand = {
  showName: string;
  band: "under-reach" | "at-or-above" | "unknown";
  medianViewCount: number | null;
};

export type SponsorPitchDraft = { subject: string; body: string };

const responseSchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
};

const STATE_CONTEXT: Record<string, string> = {
  new_entrant: "This brand just started running ad reads on monitored shows in the last 30 days — their budget just opened.",
  scaling: "This brand already runs ad reads on monitored shows and is increasing spend or expanding to more shows.",
  steady: "This brand has a steady, ongoing ad-read presence on monitored shows.",
  churned:
    "This brand ran ad reads on monitored shows 30-90 days ago but has none in the last 30 days — their flight may have ended or be between cycles, worth a timed pitch.",
  mention_only: "This brand has been discussed on monitored shows but has no evidence of ad spend yet.",
};

// Evidence block is assembled by the caller from code, not invented here (spec 3.3) — this
// function only turns handed facts into prose, and is explicitly told not to add new ones.
export async function draftSponsorPitch(params: {
  brand: string;
  state: string;
  evidence: PitchEvidenceItem[];
  reachBands: ReachBand[];
}): Promise<{ draft: SponsorPitchDraft; usage: ChatUsage }> {
  const { brand, state, evidence, reachBands } = params;

  const evidenceList = evidence
    .map((e) => `- "${e.episodeTitle}" on ${e.showName} (${e.publishedAt})${e.excerpt ? `: "${e.excerpt}"` : ""}`)
    .join("\n");

  const underReach = reachBands.filter((r) => r.band === "under-reach");
  const reachNote =
    underReach.length > 0
      ? `\n\nReach note: ${underReach
          .map((r) => r.showName)
          .join(
            ", "
          )} has a trailing-90-day median YouTube view count below Aditya's roughly 9,000 monthly podcast listeners. This is a directional signal only — YouTube per-video views and monthly podcast listeners are different units and are not directly comparable. If you mention it, phrase it as a loose, directional note, never as a precise or certain claim.`
      : "";

  const prompt = `Draft a short, professional cold outreach email pitching ${brand} to sponsor Aditya's podcast.

Context: ${STATE_CONTEXT[state] ?? ""}

Evidence of ${brand}'s existing ad-read activity on other podcasts we track:
${evidenceList || "(no ad-read evidence on file)"}${reachNote}

Only reference facts from the evidence above — do not invent numbers, shows, or claims not listed. Keep it under 150 words, no generic filler, sign off as "Aditya". Output strictly valid JSON matching the schema, no markdown.`;

  const { content, usage } = await chatCompletion(prompt, {
    temperature: 0.5,
    jsonSchema: { name: "sponsor_pitch_draft", schema: responseSchema },
  });

  try {
    return { draft: JSON.parse(content) as SponsorPitchDraft, usage };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for sponsor pitch: ${content.slice(0, 300)}`);
  }
}
