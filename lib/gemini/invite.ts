import { chatCompletion, type ChatUsage } from "../openrouter/client";

export type InviteEvidence = {
  episodeTitle: string;
  showName: string;
  excerpt: string | null;
};

export type InviteDraft = { subject: string; body: string };

const responseSchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
};

export async function draftInviteEmail(params: {
  guestName: string;
  topic?: string | null;
  evidence?: InviteEvidence | null;
}): Promise<{ draft: InviteDraft; usage: ChatUsage }> {
  const { guestName, topic, evidence } = params;

  const hook = evidence
    ? `They were recently featured in "${evidence.episodeTitle}" on ${evidence.showName}${
        evidence.excerpt ? `, where they discussed: "${evidence.excerpt}"` : ""
      }.`
    : topic
    ? `Their work is relevant to the topic "${topic}", which has been trending across the shows we track.`
    : "No specific episode evidence is available — keep the invite general but still warm and specific about their known work.";

  const prompt = `Draft a short, warm, professional podcast guest invitation email to ${guestName}${
    topic ? ` to discuss "${topic}"` : ""
  }.

Personalization hook (use it naturally, don't just repeat it verbatim): ${hook}

Keep it under 150 words, no generic filler, sign off as "Aditya". Output strictly valid JSON matching the schema, no markdown.`;

  const { content, usage } = await chatCompletion(prompt, {
    temperature: 0.5,
    jsonSchema: { name: "invite_draft", schema: responseSchema },
  });

  try {
    return { draft: JSON.parse(content) as InviteDraft, usage };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for invite draft: ${content.slice(0, 300)}`);
  }
}
