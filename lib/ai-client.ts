/**
 * Unified AI client adapter.
 *
 * DEPLOY_TARGET=aws  → AWS Bedrock (Claude) via x-api-key  (no internet required)
 * otherwise          → Google Gemini (Cloudflare / local dev)
 *
 * Bedrock requires:
 *   - BEDROCK_API_KEY env var (stored in Secrets Manager)
 *   - VPC endpoint: com.amazonaws.us-west-2.bedrock-runtime
 */

export const isAWS = process.env.DEPLOY_TARGET === "aws";

// Default models
const DEFAULT_BEDROCK_MODEL = "anthropic.claude-sonnet-4-6";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-preview";

const BEDROCK_REGION = "us-west-2";
const BEDROCK_BASE = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com`;

export interface AiMessage {
  role: "user" | "model";
  text: string;
}

export interface AiGenerateOptions {
  /** Instruct model to respond with JSON only */
  jsonMode?: boolean;
  /** Request web search grounding (Gemini only; ignored on Bedrock) */
  useSearch?: boolean;
  /** Multi-turn conversation history */
  history?: AiMessage[];
  /** System prompt */
  systemPrompt?: string;
  /** Override model (Gemini model name or Bedrock model ID) */
  model?: string;
}

export interface AiGenerateResult {
  text: string;
  /** Grounding source URLs (Gemini googleSearch only; empty on Bedrock) */
  sources: string[];
}

/** Main entry point. Routes to Bedrock on AWS, Gemini elsewhere. */
export async function aiGenerate(
  prompt: string,
  options: AiGenerateOptions = {}
): Promise<AiGenerateResult> {
  if (isAWS) {
    return bedrockGenerate(prompt, options);
  }
  return geminiGenerate(prompt, options);
}

// ── Bedrock (AWS) ─────────────────────────────────────────────────────────

async function bedrockGenerate(
  prompt: string,
  options: AiGenerateOptions
): Promise<AiGenerateResult> {
  const apiKey = process.env.BEDROCK_API_KEY;
  if (!apiKey) throw new Error("BEDROCK_API_KEY not configured");

  // Build message array (convert Gemini-style "model" role → Claude "assistant")
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const h of options.history ?? []) {
    messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.text });
  }
  messages.push({ role: "user", content: prompt });

  // Build system prompt
  let system = options.systemPrompt ?? "";
  if (options.jsonMode) {
    system += (system ? "\n" : "") + "Respond with valid JSON only. No markdown code fences.";
  }

  const modelId = options.model ?? process.env.BEDROCK_MODEL ?? DEFAULT_BEDROCK_MODEL;

  const body: Record<string, unknown> = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    messages,
  };
  if (system) body.system = system;

  const url = `${BEDROCK_BASE}/model/${encodeURIComponent(modelId)}/invoke`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.statusText);
    throw new Error(`Bedrock ${resp.status}: ${err}`);
  }

  const data = await resp.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  return { text: text.trim(), sources: [] };
}

// ── Gemini (Cloudflare / local dev) ──────────────────────────────────────

async function geminiGenerate(
  prompt: string,
  options: AiGenerateOptions
): Promise<AiGenerateResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const ai = new GoogleGenAI({ apiKey });
  const model = options.model ?? DEFAULT_GEMINI_MODEL;

  // Build contents: string for simple, array for conversation
  type GeminiContents =
    | string
    | Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;

  let contents: GeminiContents = prompt;
  if (options.history?.length) {
    contents = [
      ...options.history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      { role: "user" as const, parts: [{ text: prompt }] },
    ];
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      ...(options.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
      ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  let sources: string[] = [];
  if (options.useSearch) {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    sources = (chunks as Array<{ web?: { uri?: string } }>)
      .map((c) => c.web?.uri)
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 3);
  }

  return { text: (response.text ?? "").trim(), sources };
}
