import { chatCompletion, type ChatUsage } from "../ai/gemini-flash";

export type InviteEvidence = {
  episodeTitle: string;
  showName: string;
  excerpt: string | null;
};

export type InviteDraft = { subject: string; body: string };

export type UnaskedAngle = { question: string; why: string };

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
  unaskedAngle?: UnaskedAngle | null;
}): Promise<{ draft: InviteDraft; usage: ChatUsage }> {
  const { guestName, topic, evidence, unaskedAngle } = params;

  const hook = evidence
    ? `They were recently featured in "${evidence.episodeTitle}" on ${evidence.showName}${
        evidence.excerpt ? `, where they discussed: "${evidence.excerpt}"` : ""
      }.`
    : topic
    ? `Their work is relevant to the topic "${topic}", which has been trending across the shows we track.`
    : "No specific episode evidence is available — keep the invite general but still warm and specific about their known work.";

  // The single most persuasive line in the email (spec 1.2): a specific angle nobody else
  // asked them about, not a generic "come on our show" pitch.
  const angleInstruction = unaskedAngle
    ? `\n\nCrucially, reference this unasked angle naturally in the email — it's the main reason they'd say yes to yet another podcast: other shows haven't asked them about "${unaskedAngle.question}" (${unaskedAngle.why}). Phrase it like "every other show asked you about X; I want to talk about Y" — specific, not generic.`
    : "";

  const prompt = `Draft a short, warm, professional podcast guest invitation email to ${guestName}${
    topic ? ` to discuss "${topic}"` : ""
  }.

Personalization hook (use it naturally, don't just repeat it verbatim): ${hook}${angleInstruction}

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
