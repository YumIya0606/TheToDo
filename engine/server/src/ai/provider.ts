import type { ClassType, MessageKind, StatusChange, Subject, Urgency } from "../../../../shared/types.js";

import { getSetting } from "../db/index.js";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Provider-specific model override. */
  model?: string;
  jsonMode?: boolean;
  /** Set false for a model that must think before answering. Defaults to true. */
  disableReasoning?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  /** True when the model hit max_tokens before finishing its answer. */
  truncated?: boolean;
}

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  /** True when the provider needs an API key before it can be used. */
  readonly requiresKey: boolean;
  isConfigured(apiKey: string | undefined): boolean;
  complete(req: LlmRequest, apiKey?: string): Promise<LlmResult>;
}

/* ------------------------------------------------------------------ helpers */

function requireKey(provider: string, apiKey?: string): string {
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      `${provider} needs an API key. Add one in Settings → AI, or switch to a different provider.`,
    );
  }
  return apiKey.trim();
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(err: unknown): boolean {
  return /\b429\b/.test((err as Error)?.message ?? "");
}

function isRetryable(err: unknown): boolean {
  const m = (err as Error)?.message ?? "";
  if (isRateLimited(err)) return true;
  return /\b(500|502|503|504)\b/.test(m) || /timed out|ECONNRESET|socket hang up|fetch failed/i.test(m);
}

/**
 * Shared free tiers return 429 constantly, and each attempt can sit for the full
 * timeout. Two short attempts then move on: the queue marks the message for a
 * later pass, which is far cheaper than blocking the whole run.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) break;
      await sleep(1500 * 2 ** i + Math.floor(Math.random() * 500));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  label: string,
): Promise<any> {
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    timeoutMs,
    label,
  );
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message ?? j?.message ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new Error(`${label} HTTP ${res.status}: ${detail}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned a non-JSON response: ${text.slice(0, 200)}`);
  }
}

/* ---------------------------------------------- OpenAI-compatible providers */

/**
 * The one OpenAI-compatible call, used by both the built-in gateways and the
 * user's own endpoints.
 *
 * Two things vary between providers and are handled here rather than by every
 * caller: a shared tier returns 429, and stricter endpoints reject optional
 * parameters outright instead of ignoring them. Both are recovered from
 * silently, because a connection that looks broken when it is only being fussy
 * wastes the student's time.
 */
async function openAiChat(
  chatUrl: string,
  label: string,
  req: LlmRequest,
  apiKey: string | undefined,
  defaultModel: string,
  extraHeaders: Record<string, string> = {},
  auth: { header: string; prefix: string } = { header: "Authorization", prefix: "Bearer " },
): Promise<LlmResult> {
  const started = Date.now();
  // The caller's model wins, but falling back to the connection's own default
  // matters: without it, a connection would only work when something upstream
  // remembered to name a model for it.
  const model = req.model || defaultModel;
  if (!model) throw new Error(`No model selected for ${label}. Pick one from its model list.`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (apiKey) headers[auth.header] = `${auth.prefix}${apiKey}`;

  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.1,
    max_tokens: req.maxTokens ?? 2000,
  };

  const optional: Array<[string, unknown]> = [];
  if (req.jsonMode) optional.push(["response_format", { type: "json_object" }]);
  if (req.disableReasoning !== false) {
    optional.push(["reasoning", { enabled: false, effort: "none" }]);
  }

  const send = async (keys: string[]) => {
    const payload: Record<string, unknown> = { ...body };
    for (const [k, v] of optional) if (keys.includes(k)) payload[k] = v;
    return postJson(chatUrl, headers, payload, req.timeoutMs ?? 90_000, label);
  };

  const json = await withRetry(async () => {
    try {
      return await send(optional.map(([k]) => k));
    } catch (err) {
      const m = (err as Error).message;
      if (!/\b400\b/.test(m) || !/unsupported parameter|unrecognized|unknown parameter/i.test(m)) {
        throw err;
      }
      const rejected = optional.filter(([k]) => m.includes(k)).map(([k]) => k);
      if (rejected.length === 0) throw err;
      // Drop only what the provider named and try the rest.
      return await send(optional.map(([k]) => k).filter((k) => !rejected.includes(k)));
    }
  }, label);

  const choice = json?.choices?.[0];
  const msg = choice?.message ?? {};
  const candidates = [msg.content, msg.reasoning_content, msg.reasoning]
    .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s: string) => s.trim());
  const text = candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  if (!text) throw new Error(`${label} returned an empty completion`);

  return {
    text,
    model: json.model ?? model,
    provider: label,
    promptTokens: json?.usage?.prompt_tokens,
    completionTokens: json?.usage?.completion_tokens,
    latencyMs: Date.now() - started,
    truncated: choice?.finish_reason === "length",
  };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly baseUrl: string,
    readonly defaultModel: string,
    readonly requiresKey = true,
    private readonly keyHeader = "Authorization",
    private readonly keyPrefix = "Bearer ",
    readonly modelsUrl: string | null = null,
    readonly note: string = "",
  ) {}

  isConfigured(apiKey: string | undefined): boolean {
    return this.requiresKey ? Boolean(apiKey && apiKey.trim()) : true;
  }

  async complete(req: LlmRequest, apiKey?: string): Promise<LlmResult> {
    return openAiChat(
      `${this.baseUrl}/chat/completions`,
      this.label,
      req,
      apiKey,
      this.defaultModel,
      { "HTTP-Referer": "https://thetodo.local", "X-Title": "TheToDo" },
      { header: this.keyHeader, prefix: this.keyPrefix },
    );
  }
}

/* ----------------------------------------------------------------- Gemini */

/**
 * Google retires models for new users regularly: gemini-2.5-flash now answers
 * 404 "no longer available to new users" while still appearing in the model
 * list, and the free Flash tier intermittently answers 503 under load. Rather
 * than hard-coding one name, walk a preference order and skip whatever this
 * account cannot actually reach, remembering what worked.
 */
const GEMINI_PREFERENCE = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
];

let geminiKnownGood: string | null = null;

export class GeminiProvider implements LlmProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini (recommended)";
  readonly defaultModel = "gemini-flash-latest";
  readonly requiresKey = true;
  readonly note =
    "Free forever, no card, and the best Sinhala reading of the free options. Create a key at aistudio.google.com/apikey. TheToDo moves to another Flash automatically if the one it prefers is retired or busy.";

  isConfigured(apiKey: string | undefined): boolean {
    return Boolean(apiKey && apiKey.trim());
  }

  async complete(req: LlmRequest, apiKey?: string): Promise<LlmResult> {
    const key = requireKey(this.label, apiKey);
    const started = Date.now();
    const timeoutMs = req.timeoutMs ?? 120_000;
    const preferred = req.model || geminiKnownGood || this.defaultModel;
    const chain = [preferred, ...GEMINI_PREFERENCE].filter(
      (m, i, a) => Boolean(m) && a.indexOf(m) === i,
    );

    let lastError: unknown;
    for (let i = 0; i < chain.length; i++) {
      try {
        const result = await this.callOnce(chain[i], key, req, timeoutMs, started);
        geminiKnownGood = chain[i];
        return result;
      } catch (err) {
        lastError = err;
        // Retired model, or the shared free tier is congested: try the next.
        if (!/\b404\b|\b503\b|no longer available|not found/i.test((err as Error).message)) {
          throw err;
        }
        if (i < chain.length - 1) await sleep(700 * (i + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
  }

  private async callOnce(
    model: string,
    key: string,
    req: LlmRequest,
    timeoutMs: number,
    started: number,
  ): Promise<LlmResult> {
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(key)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? 0.1,
      maxOutputTokens: req.maxTokens ?? 2000,
    };
    if (req.jsonMode) generationConfig.responseMimeType = "application/json";

    const json = await postJson(
      url,
      {},
      {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig,
      },
      timeoutMs,
      this.label,
    );

    const candidate = json?.candidates?.[0];
    const text: string = candidate?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!text) {
      const reason = json?.promptFeedback?.blockReason ?? candidate?.finishReason ?? "unknown";
      throw new Error(`${this.label} (${model}) returned no text (finish: ${reason})`);
    }
    return {
      text,
      model,
      provider: this.id,
      promptTokens: json?.usageMetadata?.promptTokenCount,
      completionTokens: json?.usageMetadata?.candidatesTokenCount,
      latencyMs: Date.now() - started,
      truncated: candidate?.finishReason === "MAX_TOKENS",
    };
  }

  /** Live model list for this key, so Settings can offer what is really usable. */
  async listModels(apiKey: string | undefined): Promise<GatewayModel[]> {
    const key = requireKey(this.label, apiKey);
    const res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`,
      ),
      25_000,
      "Gemini model list",
    );
    if (!res.ok) throw new Error(`Gemini model list returned HTTP ${res.status}`);
    const json: any = await res.json();
    return (json.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => ({
        id: String(m.name).replace(/^models\//, ""),
        name: m.displayName,
        contextLength: m.inputTokenLimit,
        isFree: true,
      }))
      .filter((m: GatewayModel) => !/-image|-tts/.test(m.id));
  }
}

/* ------------------------------------------------------- rule-only (no AI) */

export class DisabledProvider implements LlmProvider {
  readonly id = "none";
  readonly label = "No AI (rules only)";
  readonly defaultModel = "rules";
  readonly requiresKey = false;
  isConfigured(): boolean {
    return true;
  }
  async complete(): Promise<LlmResult> {
    throw new Error("No AI provider is selected. Rules-only mode does not call a model.");
  }
}

/**
 * A user-defined OpenAI-compatible endpoint. Built per request from the database
 * so a new endpoint can be added from the app without a rebuild.
 */
export class CustomProviderAdapter implements LlmProvider {
  readonly requiresKey = false;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly defaultModel: string,
    private readonly chatUrl: string,
    private readonly note = "",
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async complete(req: LlmRequest, apiKey?: string): Promise<LlmResult> {
    return openAiChat(this.chatUrl, this.label, req, apiKey, this.defaultModel);
  }

  get description(): string {
    return this.note;
  }
}

/* ---------------------------------------------------------------- registry */

export const KILO_BASE = "https://api.kilo.ai/api/gateway";

/**
 * Every provider here has a genuinely free tier. Paid-only services are
 * deliberately not offered: this app is for a student on a free way, and a
 * provider that bills by the token without a free allowance is a trap in a
 * dropdown. Any other OpenAI-compatible endpoint, paid or free, can still be
 * added by hand under Settings → API keys → Custom endpoint.
 */
export const PROVIDERS: Record<string, LlmProvider> = {
  gemini: new GeminiProvider(),
  kiloFree: new OpenAiCompatibleProvider(
    "kiloFree",
    "Kilo Gateway — free tier (no key needed)",
    KILO_BASE,
    "kilo-auto/free",
    false,
    "Authorization",
    "Bearer ",
    `${KILO_BASE}/models`,
    "No API key required. Routes to a rotating free model, so quality varies; good for trying TheToDo immediately.",
  ),
  kilo: new OpenAiCompatibleProvider(
    "kilo",
    "Kilo Gateway (your key)",
    KILO_BASE,
    "google/gemini-3.8-flash",
    true,
    "Authorization",
    "Bearer ",
    `${KILO_BASE}/models`,
    "One key, 394 models. google/gemini-3.8-flash reads Sinhala best; free models are listed too.",
  ),
  openrouter: new OpenAiCompatibleProvider(
    "openrouter",
    "OpenRouter",
    "https://openrouter.ai/api/v1",
    "google/gemini-2.0-flash-exp:free",
    true,
    "Authorization",
    "Bearer ",
    "https://openrouter.ai/api/v1/models",
    "Many free models. A key needs a little credit in the account before :free models will serve requests.",
  ),
  groq: new OpenAiCompatibleProvider(
    "groq",
    "Groq (free tier)",
    "https://api.groq.com/openai/v1",
    "llama-3.3-70b-versatile",
    true,
    "Authorization",
    "Bearer ",
    "https://api.groq.com/openai/v1/models",
    "Genuinely free with a real rate limit, and very fast. Signup needs no card. Llama reads Sinhala less well than Gemini, so expect to spot-check a few summaries.",
  ),
  nvidia: new OpenAiCompatibleProvider(
    "nvidia",
    "NVIDIA NIM (free tier)",
    "https://integrate.api.nvidia.com/v1",
    "nvidia/nemotron-3-super-120b-a12b",
    true,
    "Authorization",
    "Bearer ",
    "https://integrate.api.nvidia.com/v1/models",
    "Free developer programme with request limits far higher than a shared free tier. nvidia/nemotron-3-super-120b-a12b is verified here to read Sinhala, including a tute, a question count and a postponed time.",
  ),
  none: new DisabledProvider(),
};

export function getProvider(id: string): LlmProvider {
  return PROVIDERS[id] ?? PROVIDERS.none;
}

export interface GatewayModel {
  id: string;
  name?: string;
  contextLength?: number;
  /** USD per million prompt tokens; 0 means free. */
  promptPerMillion?: number;
  completionPerMillion?: number;
  isFree: boolean;
}

/**
 * List the models a gateway exposes. The Kilo model index is public, so this
 * works before a key is entered.
 */
export async function listGatewayModels(
  providerId: string,
  keyOverride?: string,
): Promise<GatewayModel[]> {
  const p = getProvider(providerId);

  // Gemini needs a key, and its list is fetched with a bespoke call.
  if (p instanceof GeminiProvider) {
    return p.listModels(keyOverride || getSetting("ai.apiKey", ""));
  }

  const compat = p as unknown as OpenAiCompatibleProvider;
  if (!compat.modelsUrl) return [];

  const res = await withTimeout(
    fetch(compat.modelsUrl, { headers: { "Content-Type": "application/json" } }),
    20_000,
    "model list",
  );
  if (!res.ok) throw new Error(`Model list returned HTTP ${res.status}`);
  const json: any = await (res as Response).json();
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];

  return rows
    .map((m) => {
      const promptPerMillion = m?.pricing?.prompt != null ? Number(m.pricing.prompt) * 1e6 : undefined;
      const completionPerMillion =
        m?.pricing?.completion != null ? Number(m.pricing.completion) * 1e6 : undefined;
      return {
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        promptPerMillion,
        completionPerMillion,
        isFree: promptPerMillion === 0 || completionPerMillion === 0,
      };
    })
    .sort((a, b) => Number(b.isFree) - Number(a.isFree) || a.id.localeCompare(b.id));
}

/* --------------------------------------------------------- Laya triage ---- */

/**
 * Laya (convaiinnovations/laya) is a non-autoregressive *decision* model: it
 * answers typed questions (choice / score / yes-no) with calibrated
 * probabilities and never generates text. It therefore cannot summarise Sinhala.
 *
 * TheToDo uses it only as an optional cheap pre-triage pass: "is this message about
 * a class, and if so what kind?" Anything it is unsure about falls through to the
 * generative LLM. Point `triageEndpoint` at a Laya runner exposing
 * POST { endpoint, questions: [{id, question, options}] }.
 */
export interface TriageDecision {
  relevant: boolean;
  kind: MessageKind | null;
  confidence: number;
}

export async function layaTriage(
  endpoint: string,
  text: string,
  timeoutMs = 5000,
): Promise<TriageDecision | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        questions: [
          {
            id: "relevant",
            question: "Does this message announce or discuss a scheduled class, test, paper, lesson or study material?",
            options: ["yes", "no"],
          },
          {
            id: "kind",
            question: "What does this message primarily do?",
            options: [
              "announce_class",
              "postpone_or_cancel",
              "share_link",
              "share_material",
              "chat",
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const answers = json?.answers ?? json?.results ?? json;
    const pick = (id: string): any =>
      Array.isArray(answers)
        ? answers.find((a: any) => a?.id === id || a?.question_id === id)
        : answers?.[id];

    const rel = pick("relevant");
    const kind = pick("kind");
    const relLabel = String(rel?.answer ?? rel?.label ?? rel?.choice ?? "").toLowerCase();
    const kindLabel = String(kind?.answer ?? kind?.label ?? kind?.choice ?? "").toLowerCase();

    const map: Record<string, MessageKind> = {
      announce_class: "class_announcement",
      postpone_or_cancel: "postponement",
      share_link: "join_link",
      share_material: "material",
      chat: "chat",
    };

    return {
      relevant: relLabel === "yes",
      kind: map[kindLabel] ?? null,
      confidence: Number(rel?.probability ?? rel?.confidence ?? 0),
    };
  } catch {
    return null; // triage is best-effort; never block the main pipeline
  } finally {
    clearTimeout(timer);
  }
}

export type { ClassType, MessageKind, StatusChange, Subject, Urgency };
