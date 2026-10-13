import { chatCompletion, type ChatUsage } from "../ai/gemini-flash";

export type CoverageAppearance = { episodeId: number; showName: string; episodeTitle: string; text: string };
export type CoveredQuestion = { text: string; episodeId: number; excerpt: string };
export type WhiteSpaceQuestion = { question: string; why: string };

const EXCERPT_CHAR_CAP = 3000;
const MAX_APPEARANCES = 8;

const coverageSchema = {
  type: "object",
  properties: {
    coveredQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          episodeId: { type: "number" },
          excerpt: { type: "string" },
        },
        required: ["text", "episodeId", "excerpt"],
        additionalProperties: false,
      },
    },
  },
  required: ["coveredQuestions"],
  additionalProperties: false,
};

const COVERAGE_SYSTEM_PROMPT = `You extract what has already been asked or discussed with a podcast guest, across one or more past episode transcripts/descriptions. For each distinct question or theme actually covered, output an item with the episodeId it came from and a verbatim excerpt (max ~200 chars) quoting the supporting text. Only report items clearly present in the text — never invent coverage that isn't there. Output strictly valid JSON matching the schema, no markdown, no commentary.`;

// Step A (spec 1.2): extract the questions/themes actually covered across the guest's past
// appearances, each item traceable to an episodeId + verbatim excerpt so it's quotable evidence.
export async function extractCoverage(
  guestName: string,
  appearances: CoverageAppearance[]
): Promise<{ coveredQuestions: CoveredQuestion[]; usage: ChatUsage }> {
  const capped = appearances.slice(0, MAX_APPEARANCES);
  const body = capped
    .map((a) => `--- Episode ${a.episodeId}: "${a.episodeTitle}" (${a.showName}) ---\n${a.text.slice(0, EXCERPT_CHAR_CAP)}`)
    .join("\n\n");
  const prompt = `Guest: ${guestName}\n\n${body}`;

  const { content, usage } = await chatCompletion(prompt, {
    systemPrompt: COVERAGE_SYSTEM_PROMPT,
    temperature: 0.2,
    jsonSchema: { name: "guest_coverage", schema: coverageSchema },
  });

  try {
    const parsed = JSON.parse(content) as { coveredQuestions: CoveredQuestion[] };
    return { coveredQuestions: parsed.coveredQuestions ?? [], usage };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for coverage extraction: ${content.slice(0, 300)}`);
  }
}

const whiteSpaceSchema = {
  type: "object",
  properties: {
    whiteSpace: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          why: { type: "string" },
        },
        required: ["question", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["whiteSpace"],
  additionalProperties: false,
};

const WHITE_SPACE_SYSTEM_PROMPT = `You generate interview questions for a podcast guest that deliberately avoid ground already covered by that guest's past appearances. You'll be given a list of questions/themes already covered (with sourcing) and must propose genuinely new angles grounded in what is publicly known about the guest's work. For each proposed question, give a one-line "why" explaining the specific gap it fills relative to the covered list. Do not propose a question that overlaps, even loosely rephrased, with anything in the covered list. Output strictly valid JSON matching the schema, no markdown, no commentary.`;

// Step B (spec 1.2): the complement of Step A — 8-10 questions nobody in the ecosystem has
// asked yet, grounded in public knowledge of the guest (uses OpenRouter's web grounding plugin).
export async function generateWhiteSpace(
  guestName: string,
  coveredQuestions: CoveredQuestion[]
): Promise<{ whiteSpace: WhiteSpaceQuestion[]; usage: ChatUsage }> {
  const coveredList =
    coveredQuestions.length > 0
      ? coveredQuestions.map((c) => `- (Episode ${c.episodeId}) ${c.text} — "${c.excerpt}"`).join("\n")
      : "(none — no prior monitored-show coverage found for this guest)";
  const prompt = `Guest: ${guestName}\n\nAlready covered across monitored shows:\n${coveredList}\n\nPropose 8-10 interview questions for ${guestName} that are explicitly NOT covered by the above, grounded in what is publicly known about their work.`;

  const { content, usage } = await chatCompletion(prompt, {
    systemPrompt: WHITE_SPACE_SYSTEM_PROMPT,
    temperature: 0.6,
    jsonSchema: { name: "guest_white_space", schema: whiteSpaceSchema },
    grounded: true,
  });

  try {
    const parsed = JSON.parse(content) as { whiteSpace: WhiteSpaceQuestion[] };
    return { whiteSpace: parsed.whiteSpace ?? [], usage };
  } catch {
    throw new Error(`OpenRouter (Gemini Flash) returned invalid JSON for white-space generation: ${content.slice(0, 300)}`);
  }
}
