import { db } from "../db";
import { episodeEntities } from "../db/schema";
import { eq } from "drizzle-orm";
import { chatCompletion, type ChatUsage } from "../openrouter/client";

export type Suggestion = { name: string; reason: string; sourceUrl?: string };

async function getKnownNames(type: "guest" | "sponsor"): Promise<string[]> {
  const rows = await db.selectDistinct({ value: episodeEntities.value }).from(episodeEntities).where(eq(episodeEntities.type, type));
  return rows.map((r) => r.value);
}

function parseSuggestions(text: string): Suggestion[] {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is Suggestion => typeof s?.name === "string" && typeof s?.reason === "string");
  } catch {
    return [];
  }
}

// OpenRouter has no equivalent of Google's native `google_search` grounding tool. Grounding here
// goes through OpenRouter's own "web" plugin (see lib/openrouter/client.ts), still on the same
// pinned Gemini Flash model. Any failure (quota, bad JSON, no results) falls back to an empty
// list — never fabricates a name.
async function groundedGenerate(prompt: string): Promise<{ suggestions: Suggestion[]; usage: ChatUsage }> {
  const { content, usage } = await chatCompletion(prompt, { temperature: 0.4, grounded: true, maxSearchResults: 3 });
  return { suggestions: parseSuggestions(content), usage };
}

export async function suggestGuestsForTopic(
  topic: string
): Promise<{ suggestions: Suggestion[]; usage: ChatUsage | null }> {
  try {
    const known = await getKnownNames("guest");
    const prompt = `You are a podcast booking researcher. Using web search, find 3 real, currently active startup founders or operators who would be strong potential podcast guests for a show covering the topic "${topic}".

Strict rules:
- Do NOT suggest anyone in this list of guests already featured on our monitored shows: ${known.length ? known.join(", ") : "(none yet)"}.
- Only suggest real, verifiable people found via search — never invent a name.
- For each, give a one-sentence "reason" explaining why they're relevant to "${topic}" right now, and a "sourceUrl" if search gives you one.
- Output ONLY a raw JSON array, no markdown, no commentary, in this exact shape: [{"name": "...", "reason": "...", "sourceUrl": "..."}]`;
    return await groundedGenerate(prompt);
  } catch (err) {
    console.error(`suggestGuestsForTopic(${topic}) failed, falling back to empty list:`, err);
    return { suggestions: [], usage: null };
  }
}

export async function suggestSponsorsForTopic(
  topic: string
): Promise<{ suggestions: Suggestion[]; usage: ChatUsage | null }> {
  try {
    const known = await getKnownNames("sponsor");
    const prompt = `You are a podcast sponsorship researcher. Using web search, find 3 real brands or products that are topically relevant to "${topic}" and are plausible podcast ad-read sponsors, but are NOT in this list of brands already detected as sponsors on our monitored shows: ${known.length ? known.join(", ") : "(none yet)"}.

Strict rules:
- Only suggest real, verifiable brands found via search — never invent one.
- For each, give a one-sentence "reason" explaining the topical fit, and a "sourceUrl" if search gives you one.
- Output ONLY a raw JSON array, no markdown, no commentary, in this exact shape: [{"name": "...", "reason": "...", "sourceUrl": "..."}]`;
    return await groundedGenerate(prompt);
  } catch (err) {
    console.error(`suggestSponsorsForTopic(${topic}) failed, falling back to empty list:`, err);
    return { suggestions: [], usage: null };
  }
}
