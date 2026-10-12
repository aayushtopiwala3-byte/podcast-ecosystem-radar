// Compliance: every AI call in this codebase must go through OpenRouter, pinned to this
// exact Gemini Flash model id. Never parameterize or default to a different model.
export const PINNED_MODEL = "google/gemini-3.8-flash";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

type JsonSchema = { name: string; schema: Record<string, unknown> };

type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  jsonSchema?: JsonSchema;
  grounded?: boolean;
  maxSearchResults?: number;
};

export type ChatUsage = { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number };
export type ChatResponse = { content: string; usage: ChatUsage };

export async function chatCompletion(userPrompt: string, opts: ChatOptions = {}): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const messages: { role: string; content: string }[] = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  const body: Record<string, unknown> = {
    model: PINNED_MODEL,
    messages,
    temperature: opts.temperature,
    usage: { include: true },
  };

  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
    };
  }

  // OpenRouter has no equivalent of Google's native `google_search` grounding tool — grounding
  // here goes through OpenRouter's own "web" plugin, which for Gemini is backed by Google search
  // but returns OpenRouter's own response shape (url_citation annotations), not Gemini's native
  // groundingMetadata. Model stays pinned to PINNED_MODEL either way.
  if (opts.grounded) {
    body.plugins = [{ id: "web", max_results: opts.maxSearchResults ?? 3 }];
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.error) throw new Error(`OpenRouter error: ${json.error.message}`);

  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`OpenRouter returned no content: ${JSON.stringify(json).slice(0, 500)}`);
  }

  // Under BYOK (bring-your-own-key), OpenRouter's own `usage.cost` is always 0 — that field is
  // OpenRouter's markup, which BYOK waives. The real dollar cost actually billed by the upstream
  // provider (Google) is `usage.cost_details.upstream_inference_cost`. Fall back to `usage.cost`
  // for non-BYOK setups where `cost_details` isn't present.
  const usage: ChatUsage = {
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    totalTokens: json.usage?.total_tokens ?? 0,
    costUsd: json.usage?.cost_details?.upstream_inference_cost ?? json.usage?.cost ?? 0,
  };

  return { content, usage };
}
