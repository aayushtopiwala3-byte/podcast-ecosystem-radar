import { chatCompletion } from "../openrouter/client";

export type InterviewPrepDraft = { questions: string[]; script: string };

const responseSchema = {
  type: "object",
  properties: {
    questions: { type: "array", items: { type: "string" } },
    script: { type: "string" },
  },
  required: ["questions", "script"],
  additionalProperties: false,
};

export async function draftInterviewPrep(params: {
  guestName: string;
  guestSource: "proven" | "suggested";
  topic: string;
  topicPerformance?: { showCount: number; avgViewRatio: number } | null;
  evidence?: { episodeTitle: string; showName: string; excerpt: string | null; viewRatio: number | null } | null;
  suggestionReason?: string | null;
}): Promise<InterviewPrepDraft> {
  const { guestName, guestSource, topic, topicPerformance, evidence, suggestionReason } = params;

  const performanceContext = topicPerformance
    ? `Across the ${topicPerformance.showCount} monitored show(s) that have covered "${topic}" in the last 6 months, episodes on this topic average a ${topicPerformance.avgViewRatio.toFixed(
        2
      )}x view-ratio relative to each show's own baseline.`
    : `No cross-show performance data is available yet for "${topic}".`;

  const guestContext =
    guestSource === "proven" && evidence
      ? `${guestName} already appeared on "${evidence.episodeTitle}" (${evidence.showName})${
          evidence.viewRatio != null ? `, which hit a ${evidence.viewRatio.toFixed(2)}x view-ratio` : ""
        }${evidence.excerpt ? `. Excerpt from that appearance: "${evidence.excerpt}"` : ""}.`
      : guestSource === "suggested"
      ? `${guestName} is an AI-suggested, unverified lead — not yet a guest on any monitored show.${
          suggestionReason ? ` Reason suggested: ${suggestionReason}` : ""
        }`
      : `${guestName} is being considered as a guest for "${topic}".`;

  const prompt = `You are prepping Aditya, a podcast host, for a recording with ${guestName} on the topic "${topic}".

${performanceContext}
${guestContext}

Produce two things:
1. "questions": 5-8 serious, substantive interview questions specific to ${guestName} and "${topic}" — avoid generic/fluffy questions.
2. "script": an informal conversational outline (a few short paragraphs) noting which angles on "${topic}" tend to land well with audiences vs. which tend to fall flat, based on the performance context above, and how to steer the conversation toward the angles that work.

This is a draft for Aditya to review and edit before recording — be direct and concrete, not generic advice. Output strictly valid JSON matching the schema, no markdown.`;

  const text = await chatCompletion(prompt, {
    temperature: 0.6,
    jsonSchema: { name: "interview_prep_draft", schema: responseSchema },
  });

  try {
    return JSON.parse(text) as InterviewPrepDraft;
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for interview prep draft: ${text.slice(0, 300)}`);
  }
}
