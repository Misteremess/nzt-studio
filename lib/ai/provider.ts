// lib/ai/provider.ts
// Server-only unified text-generation layer over multiple AI providers.
//
// Every AI module calls generateText() with a provider (resolved from settings)
// and a system+user prompt; this routes to the official Anthropic or Google
// Gemini SDK, optionally enabling live web search/grounding. API keys never
// leave the server.
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "@/lib/ai/types";

/** Concrete model id used for each provider. */
export const ANTHROPIC_MODEL = "claude-opus-4-7";
export const GEMINI_MODEL = "gemini-2.5-flash";

/** Human-facing model id for the given provider (stored alongside outputs). */
export function providerModelId(provider: AiProvider): string {
  return provider === "gemini" ? GEMINI_MODEL : ANTHROPIC_MODEL;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when the selected provider's API key is not configured. */
export class MissingApiKeyError extends Error {
  constructor(public readonly provider: AiProvider) {
    super(
      provider === "gemini"
        ? "GEMINI_API_KEY no está configurada en el servidor."
        : "ANTHROPIC_API_KEY no está configurada en el servidor."
    );
    this.name = "MissingApiKeyError";
  }
}

/** Thrown when a provider's API call fails. Carries an HTTP-ish status. */
export class AiApiError extends Error {
  constructor(
    public readonly provider: AiProvider,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AiSource {
  title: string;
  url: string;
}

export interface GenerateOptions {
  system: string;
  user: string;
  maxTokens: number;
  /** Enable live web research (Anthropic web_search / Gemini Google Search). */
  webSearch?: boolean;
  /**
   * Whether the model is expected to return raw JSON (default true unless
   * webSearch is enabled). Set to false for callers expecting plain text/HTML
   * — on Gemini this avoids forcing `responseMimeType: "application/json"`,
   * which would wrap a non-JSON answer (e.g. an HTML document) in a JSON string.
   */
  expectJson?: boolean;
  /** Images attached to the user message (vision), e.g. a logo or brand reference. */
  images?: { data: string; mediaType: string }[];
}

export interface GenerateResult {
  provider: AiProvider;
  model: string;
  text: string;
  raw: unknown;
  /** Web sources cited by the model (empty unless webSearch was used). */
  sources: AiSource[];
}

/**
 * Generates text with the chosen provider.
 * Throws MissingApiKeyError / AiApiError on failure.
 */
export async function generateText(
  provider: AiProvider,
  opts: GenerateOptions
): Promise<GenerateResult> {
  return provider === "gemini" ? generateWithGemini(opts) : generateWithAnthropic(opts);
}

// ─── Anthropic ─────────────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("anthropic");
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

async function generateWithAnthropic(opts: GenerateOptions): Promise<GenerateResult> {
  const client = getAnthropic();

  const tools = opts.webSearch
    ? [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 }]
    : undefined;

  try {
    const stream = client.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      ...(tools ? { tools } : {}),
      messages: [{ role: "user", content: buildAnthropicContent(opts) }],
    });

    const message = await stream.finalMessage();
    return {
      provider: "anthropic",
      model: ANTHROPIC_MODEL,
      text: extractAnthropicText(message),
      raw: message,
      sources: opts.webSearch ? extractAnthropicSources(message) : [],
    };
  } catch (err) {
    if (err instanceof MissingApiKeyError) throw err;
    if (err instanceof Anthropic.APIError) {
      throw new AiApiError("anthropic", err.status ?? 0, err.message);
    }
    throw err;
  }
}

/** Builds the user message content, prepending any attached images (vision). */
function buildAnthropicContent(
  opts: GenerateOptions
): string | Anthropic.Messages.ContentBlockParam[] {
  if (!opts.images || opts.images.length === 0) return opts.user;
  return [
    ...opts.images.map(
      (img): Anthropic.Messages.ContentBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: img.data,
        },
      })
    ),
    { type: "text", text: opts.user },
  ];
}

// Join with "" (not "\n"): when the model cites web sources, its final answer is
// split across many text blocks at citation points; newlines would corrupt JSON.
function extractAnthropicText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function extractAnthropicSources(message: Anthropic.Messages.Message): AiSource[] {
  const out: AiSource[] = [];
  const seen = new Set<string>();
  for (const block of message.content) {
    if (block.type !== "web_search_tool_result") continue;
    const content = (block as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;
      const url = typeof r.url === "string" ? r.url : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ title: typeof r.title === "string" && r.title ? r.title : url, url });
    }
  }
  return out.slice(0, 10);
}

// ─── Gemini ────────────────────────────────────────────────────────────────────

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError("gemini");
  geminiClient ??= new GoogleGenAI({ apiKey });
  return geminiClient;
}

async function generateWithGemini(opts: GenerateOptions): Promise<GenerateResult> {
  const ai = getGemini();

  // Gemini 2.5's "thinking" tokens are drawn from the SAME maxOutputTokens
  // budget as the answer, so dynamic thinking can truncate the JSON. Give the
  // answer generous headroom on top of what the caller asked for.
  const maxOutputTokens = Math.min(opts.maxTokens + 8192, 65536);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildGeminiContents(opts),
      config: {
        systemInstruction: opts.system,
        maxOutputTokens,
        // Dynamic thinking budget (Gemini 2.5): the model decides how much to think.
        thinkingConfig: { thinkingBudget: -1 },
        // Web search and JSON mime type are mutually exclusive. When not
        // searching and JSON is expected, force a raw JSON response so there
        // are no markdown fences or prose to trip up the parser.
        ...(opts.webSearch
          ? { tools: [{ googleSearch: {} }] }
          : opts.expectJson === false
            ? {}
            : { responseMimeType: "application/json" }),
      },
    });

    const text = (response.text ?? "").trim();
    if (!text) {
      const finish = response.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") {
        throw new AiApiError(
          "gemini",
          0,
          "Gemini agotó el límite de tokens pensando y no llegó a responder. Reintenta."
        );
      }
      throw new AiApiError("gemini", 0, "Gemini no devolvió ninguna respuesta.");
    }

    return {
      provider: "gemini",
      model: GEMINI_MODEL,
      text,
      raw: response,
      sources: opts.webSearch ? extractGeminiSources(response) : [],
    };
  } catch (err) {
    if (err instanceof MissingApiKeyError || err instanceof AiApiError) throw err;
    const status = readErrorStatus(err);
    const message = err instanceof Error ? err.message : "Error de la API de Gemini.";
    // Surface the real cause in the server logs — the user-facing message is
    // intentionally generic, so without this the root cause is invisible.
    console.error("[Gemini] generateContent failed", { status, message });
    throw new AiApiError("gemini", status, message);
  }
}

/** Builds the Gemini request contents, prepending any attached images (vision). */
function buildGeminiContents(opts: GenerateOptions): string | { parts: object[] } {
  if (!opts.images || opts.images.length === 0) return opts.user;
  return {
    parts: [
      ...opts.images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.data } })),
      { text: opts.user },
    ],
  };
}

function extractGeminiSources(
  response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>
): AiSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: AiSource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const url = chunk.web?.uri ?? "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: chunk.web?.title || url, url });
  }
  return out.slice(0, 10);
}

/** Best-effort extraction of an HTTP status from a Gemini SDK error. */
function readErrorStatus(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const r = err as Record<string, unknown>;
    if (typeof r.status === "number") return r.status;
    if (typeof r.code === "number") return r.code;
  }
  return 0;
}
