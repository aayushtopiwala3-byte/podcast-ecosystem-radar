import { chatCompletion, type ChatUsage } from "../ai/gemini-flash";

export type RepetitionExcerpt = { episodeId: number; showName: string; text: string };

export type RepetitionResult = {
  repetitionScore: number;
  repeatedStories: { story: string; episodeIds: number[] }[];
  freshMaterial: { point: string; episodeId: number }[];
};

const responseSchema = {
  type: "object",
  properties: {
    repetitionScore: { type: "number" },
    repeatedStories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          story: { type: "string" },
          episodeIds: { type: "array", items: { type: "number" } },
        },
        required: ["story", "episodeIds"],
        additionalProperties: false,
      },
    },
    freshMaterial: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          episodeId: { type: "number" },
        },
        required: ["point", "episodeId"],
        additionalProperties: false,
      },
    },
  },
  required: ["repetitionScore", "repeatedStories", "freshMaterial"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You score how much a podcast guest repeats themselves across multiple appearances. You will be given the guest's name and excerpts from several different episodes (different shows) where they appeared.

Score "repetitionScore" from 0 (no overlap, all fresh material) to 1 (same anecdotes, framings, statistics, or origin story repeated nearly verbatim across appearances).

Only report a "repeatedStory" if its substance clearly appears in two or more of the supplied excerpts — quote the supporting phrasing from each. Do not report a repeated story based on topic similarity alone; it must be the same specific anecdote, framing, statistic, or origin story.

List notably fresh material (points that appear in only one excerpt and aren't generic) under "freshMaterial".

If you are not confident an overlap is real, lower the score rather than guessing. Output strictly valid JSON matching the schema, no markdown, no commentary.`;

export async function scoreRepetition(
  guestName: string,
  excerpts: RepetitionExcerpt[]
): Promise<{ result: RepetitionResult; usage: ChatUsage }> {
  const body = excerpts
    .map((e) => `--- Episode ${e.episodeId} (${e.showName}) ---\n${e.text}`)
    .join("\n\n");
  const prompt = `Guest: ${guestName}\n\n${body}`;

  const { content, usage } = await chatCompletion(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.2,
    jsonSchema: { name: "guest_repetition", schema: responseSchema },
  });

  try {
    const parsed = JSON.parse(content) as RepetitionResult;
    return {
      result: {
        repetitionScore: typeof parsed.repetitionScore === "number" ? parsed.repetitionScore : 0,
        repeatedStories: parsed.repeatedStories ?? [],
        freshMaterial: parsed.freshMaterial ?? [],
      },
      usage,
    };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for repetition score: ${content.slice(0, 300)}`);
  }
}
