import { db } from "./db";
import { aiSuggestions } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { suggestGuestsForTopic, suggestSponsorsForTopic, type Suggestion } from "./gemini/ground";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function ensureOne(kind: "guest" | "sponsor", topic: string) {
  const existing = await db
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.kind, kind), eq(aiSuggestions.topic, topic)));

  const row = existing[0];
  const isFresh = row && Date.now() - new Date(row.generatedAt).getTime() < SEVEN_DAYS_MS;
  if (isFresh) return;

  const suggestions = kind === "guest" ? await suggestGuestsForTopic(topic) : await suggestSponsorsForTopic(topic);
  if (suggestions.length === 0) return; // keep any existing (stale) cache rather than overwrite with an empty failed result

  await db
    .insert(aiSuggestions)
    .values({ kind, topic, suggestions, generatedAt: new Date() })
    .onConflictDoUpdate({
      target: [aiSuggestions.kind, aiSuggestions.topic],
      set: { suggestions, generatedAt: new Date() },
    });
}

export async function ensureSuggestions(topics: string[]) {
  for (const topic of topics) {
    await ensureOne("guest", topic);
    await ensureOne("sponsor", topic);
  }
}

export async function getCachedSuggestions(kind: "guest" | "sponsor", topic: string): Promise<Suggestion[]> {
  const rows = await db
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.kind, kind), eq(aiSuggestions.topic, topic)));
  return (rows[0]?.suggestions as Suggestion[] | undefined) ?? [];
}
