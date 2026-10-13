import { chatCompletion, type ChatUsage } from "../ai/gemini-flash";

export type CounterAngle = { angle: string; rationale: string };

const responseSchema = {
  type: "object",
  properties: {
    angles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["angle", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["angles"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You generate counter-programming angles for a podcast topic that is already saturated across the shows a producer tracks. You will be given the topic and the titles of episodes (with their shows) that already cover it. Propose exactly 3 contrarian or adjacent angles that none of the supplied episodes appear to have taken, so a host can cover the same topic without repeating what's already out there. Each angle needs a one-line rationale explaining specifically why it's differentiated from the supplied set. These are speculative suggestions, not facts — never claim any of the supplied episodes covered these angles. Output strictly valid JSON matching the schema, no markdown, no commentary.`;

// Spec 2.2: one call per Peaking topic, given the topic and the episodes already covering it,
// returning 3 angles nobody in that set has taken.
export async function generateCounterAngles(
  topic: string,
  episodes: { title: string; showName: string }[]
): Promise<{ angles: CounterAngle[]; usage: ChatUsage }> {
  const list = episodes.map((e) => `- "${e.title}" (${e.showName})`).join("\n");
  const prompt = `Topic: ${topic}\n\nEpisodes already covering this topic across monitored shows:\n${list}\n\nPropose 3 counter-programming angles.`;

  const { content, usage } = await chatCompletion(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.6,
    jsonSchema: { name: "counter_angles", schema: responseSchema },
  });

  try {
    const parsed = JSON.parse(content) as { angles: CounterAngle[] };
    return { angles: parsed.angles ?? [], usage };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for counter angles: ${content.slice(0, 300)}`);
  }
}
