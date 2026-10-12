import { chatCompletion } from "../openrouter/client";
import { TOPIC_TAXONOMY } from "./taxonomy";

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
  type: "object",
  properties: {
    guests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          excerpt: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["name", "excerpt", "confidence"],
        additionalProperties: false,
      },
    },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string", enum: TOPIC_TAXONOMY as unknown as string[] },
          excerpt: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["topic", "excerpt", "confidence"],
        additionalProperties: false,
      },
    },
    sponsors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          mention_type: { type: "string", enum: ["ad_read", "mention"] },
          excerpt: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["brand", "mention_type", "excerpt", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["guests", "topics", "sponsors"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an information-extraction engine for a podcast intelligence tool. You will be given the title and transcript (or description, if no transcript was available) of a single podcast episode.

Extract ONLY what is explicitly and clearly stated in the text:
1. guests: named individuals who are guests being interviewed on this episode (NOT the host, unless ambiguous). Use their full name as stated.
2. topics: 2-6 tags chosen ONLY from this fixed taxonomy: ${TOPIC_TAXONOMY.join(", ")}. For each substantive subject discussed, pick the closest matching canonical tag(s) from this list — never invent a new tag or output freeform text. If nothing in the taxonomy reasonably fits, omit it rather than forcing a bad match.
3. sponsors: brand or product names that are mentioned as sponsors or advertisers. For each, classify mention_type:
   - "ad_read": the text clearly reads like a dedicated sponsored ad read — e.g. a promo code, phrase like "this episode is sponsored by", "use code X for Y% off", a dedicated ad segment distinct from organic conversation.
   - "mention": an organic or passing reference to a brand/product without clear sponsorship language.

For EVERY item in every list (guests, topics, sponsors), you MUST include a short excerpt (max ~200 chars, verbatim or near-verbatim from the text) that is direct evidence for that extraction. Never claim something was found without a supporting excerpt.

Rules:
- If something is not clearly stated, do NOT include it. When uncertain, lower the confidence score (0-1) rather than omitting without reason, but never invent facts not present in the text.
- Do not guess or hallucinate full names, topics, or brands that are not actually present in the text.
- If the input text is too short or uninformative (e.g. just a title with no real content), return empty arrays.
- Output strictly valid JSON matching the provided schema. No markdown, no commentary.`;

export async function extractEntities(episodeTitle: string, rawText: string): Promise<ExtractionResult> {
  // Gemini Flash has a large context window but we cap input defensively to control cost/latency.
  const truncated = rawText.length > 18000 ? rawText.slice(0, 18000) : rawText;
  const prompt = `Episode title: ${episodeTitle}\n\nEpisode text:\n${truncated}`;

  const text = await chatCompletion(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.2,
    jsonSchema: { name: "episode_extraction", schema: responseSchema },
  });

  try {
    const parsed = JSON.parse(text) as ExtractionResult;
    return {
      guests: parsed.guests ?? [],
      topics: parsed.topics ?? [],
      sponsors: parsed.sponsors ?? [],
    };
  } catch (e) {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON: ${text.slice(0, 500)}`);
  }
}
