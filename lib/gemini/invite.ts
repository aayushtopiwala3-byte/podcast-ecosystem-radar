import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = "gemini-flash-latest";

export type InviteEvidence = {
  episodeTitle: string;
  showName: string;
  excerpt: string | null;
};

export type InviteDraft = { subject: string; body: string };

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    subject: { type: SchemaType.STRING },
    body: { type: SchemaType.STRING },
  },
  required: ["subject", "body"],
};

export async function draftInviteEmail(params: {
  guestName: string;
  topic?: string | null;
  evidence?: InviteEvidence | null;
}): Promise<InviteDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const { guestName, topic, evidence } = params;

  const hook = evidence
    ? `They were recently featured in "${evidence.episodeTitle}" on ${evidence.showName}${
        evidence.excerpt ? `, where they discussed: "${evidence.excerpt}"` : ""
      }.`
    : topic
    ? `Their work is relevant to the topic "${topic}", which has been trending across the shows we track.`
    : "No specific episode evidence is available — keep the invite general but still warm and specific about their known work.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as any,
      temperature: 0.5,
    },
  });

  const prompt = `Draft a short, warm, professional podcast guest invitation email to ${guestName}${
    topic ? ` to discuss "${topic}"` : ""
  }.

Personalization hook (use it naturally, don't just repeat it verbatim): ${hook}

Keep it under 150 words, no generic filler, sign off as "Aditya". Output strictly valid JSON matching the schema, no markdown.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as InviteDraft;
  } catch {
    throw new Error(`Gemini returned invalid JSON for invite draft: ${text.slice(0, 300)}`);
  }
}
