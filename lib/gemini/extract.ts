import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = "gemini-flash-latest";

export type ExtractionResult = {
  guests: { name: string; excerpt: string; confidence: number }[];
  topics: { topic: string; excerpt: string; confidence: number }[];
  sponsors: {
    brand: string;
    mention_type: "ad_read" | "mention";
    excerpt: string;
    confidence: number;
  }[];
};

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    guests: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          excerpt: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["name", "excerpt", "confidence"],
      },
    },
    topics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topic: { type: SchemaType.STRING },
          excerpt: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["topic", "excerpt", "confidence"],
      },
    },
    sponsors: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          brand: { type: SchemaType.STRING },
          mention_type: { type: SchemaType.STRING, format: "enum", enum: ["ad_read", "mention"] },
          excerpt: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["brand", "mention_type", "excerpt", "confidence"],
      },
    },
  },
  required: ["guests", "topics", "sponsors"],
};

const SYSTEM_PROMPT = `You are an information-extraction engine for a podcast intelligence tool. You will be given the title and transcript (or description, if no transcript was available) of a single podcast episode.

Extract ONLY what is explicitly and clearly stated in the text:
1. guests: named individuals who are guests being interviewed on this episode (NOT the host, unless ambiguous). Use their full name as stated.
2. topics: 2-6 short topic phrases (2-5 words each) that capture the substantive subjects discussed (e.g. "AI agents in enterprise", "D2C unit economics", "Series A fundraising"). Avoid generic filler like "podcast" or "interview".
3. sponsors: brand or product names that are mentioned as sponsors or advertisers. For each, classify mention_type:
   - "ad_read": the text clearly reads like a dedicated sponsored ad read — e.g. a promo code, phrase like "this episode is sponsored by", "use code X for Y% off", a dedicated ad segment distinct from organic conversation.
   - "mention": an organic or passing reference to a brand/product without clear sponsorship language.

For EVERY item in every list (guests, topics, sponsors), you MUST include a short excerpt (max ~200 chars, verbatim or near-verbatim from the text) that is direct evidence for that extraction. Never claim something was found without a supporting excerpt.

Rules:
- If something is not clearly stated, do NOT include it. When uncertain, lower the confidence score (0-1) rather than omitting without reason, but never invent facts not present in the text.
- Do not guess or hallucinate full names, topics, or brands that are not actually present in the text.
- If the input text is too short or uninformative (e.g. just a title with no real content), return empty arrays.
- Output strictly valid JSON matching the provided schema. No markdown, no commentary.`;

export async function extractEntities(
  episodeTitle: string,
  rawText: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema as any,
      temperature: 0.2,
    },
  });

  // Gemini Flash has a large context window but we cap input defensively to control cost/latency.
  const truncated = rawText.length > 18000 ? rawText.slice(0, 18000) : rawText;

  const prompt = `Episode title: ${episodeTitle}\n\nEpisode text:\n${truncated}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed = JSON.parse(text) as ExtractionResult;
    return {
      guests: parsed.guests ?? [],
      topics: parsed.topics ?? [],
      sponsors: parsed.sponsors ?? [],
    };
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 500)}`);
  }
}
