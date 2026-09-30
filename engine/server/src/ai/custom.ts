import { db } from "../db/index.js";

/**
 * User-defined OpenAI-compatible endpoints: any service that speaks
 * `/v1/chat/completions` (or `.../chat/completions` without the version
 * segment). Stored in the database rather than compiled in, so a student can
 * point TheToDo at a local Ollama, a university proxy, or a reseller without
 * touching code.
 */

export interface CustomProvider {
  id: number;
  name: string;
  baseUrl: string;
  kind: string;
  apiKey: string | null;
  modelsUrl: string | null;
  model: string;
  enabled: number;
  createdAt: number;
}

interface Row {
  id: number;
  name: string;
  base_url: string;
  kind: string;
  api_key: string | null;
  models_url: string | null;
  model: string;
  enabled: number;
  created_at: number;
}

const toProvider = (r: Row): CustomProvider => ({
  id: r.id,
  name: r.name,
  baseUrl: r.base_url,
  kind: r.kind,
  apiKey: r.api_key,
  modelsUrl: r.models_url,
  model: r.model,
  enabled: r.enabled,
  createdAt: r.created_at,
});

/** Provider keys in the pool namespace for this custom endpoint. */
export const poolKey = (id: number) => `custom:${id}`;

export function listCustomProviders(): CustomProvider[] {
  return (db.prepare("SELECT * FROM custom_providers ORDER BY name").all() as Row[]).map(toProvider);
}

export function getCustomProvider(id: number): CustomProvider | undefined {
  const r = db.prepare("SELECT * FROM custom_providers WHERE id = ?").get(id) as Row | undefined;
  return r ? toProvider(r) : undefined;
}

export function addCustomProvider(p: {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model?: string;
}): number {
  const base = normaliseBaseUrl(p.baseUrl);
  if (!base) throw new Error("That does not look like a usable base URL.");
  const info = db
    .prepare(
      `INSERT INTO custom_providers (name, base_url, kind, api_key, models_url, model, enabled, created_at)
       VALUES (?,?,'openai_compat',?,?,?,1,?)`,
    )
    .run(p.name.trim() || "Custom", base, p.apiKey?.trim() || null, modelsUrlFor(base), p.model ?? "", Date.now());
  return Number(info.lastInsertRowid);
}

export function updateCustomProvider(
  id: number,
  patch: { name?: string; baseUrl?: string; apiKey?: string | null; model?: string; enabled?: boolean },
): CustomProvider | undefined {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.name !== undefined) {
    sets.push("name = @name");
    params.name = patch.name.trim() || "Custom";
  }
  if (patch.baseUrl !== undefined) {
    const base = normaliseBaseUrl(patch.baseUrl);
    if (!base) throw new Error("That does not look like a usable base URL.");
    sets.push("base_url = @base_url", "models_url = @models_url");
    params.base_url = base;
    params.models_url = modelsUrlFor(base);
  }
  if (patch.apiKey !== undefined) {
    sets.push("api_key = @api_key");
    params.api_key = patch.apiKey ? patch.apiKey.trim() : null;
  }
  if (patch.model !== undefined) {
    sets.push("model = @model");
    params.model = patch.model;
  }
  if (patch.enabled !== undefined) {
    sets.push("enabled = @enabled");
    params.enabled = patch.enabled ? 1 : 0;
  }
  if (sets.length) db.prepare(`UPDATE custom_providers SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return getCustomProvider(id);
}

export function removeCustomProvider(id: number): void {
  db.prepare("DELETE FROM custom_providers WHERE id = ?").run(id);
  db.prepare("DELETE FROM api_keys WHERE provider = ?").run(poolKey(id));
}

/**
 * Accept what people actually paste: "https://host/v1", ".../v1/", or the full
 * ".../chat/completions". The version segment is preserved, because an endpoint
 * that lives at /v1 and one that lives at the root are both real and rebuilding
 * the URL must not guess which.
 */
export function normaliseBaseUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/i, "");
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Build the completions URL. When the base already names a version, keep it;
 * otherwise assume the conventional /v1 prefix, which is what every
 * OpenAI-compatible server exposes.
 */
export function chatUrlFor(baseUrl: string): string {
  const base = normaliseBaseUrl(baseUrl) ?? baseUrl;
  return /\/v\d+$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

export function modelsUrlFor(baseUrl: string): string {
  const base = normaliseBaseUrl(baseUrl) ?? baseUrl;
  return /\/v\d+$/i.test(base) ? `${base}/models` : `${base}/v1/models`;
}

export interface ModelInfo {
  id: string;
  contextLength?: number;
  isFree: boolean;
  promptPerMillion?: number;
  completionPerMillion?: number;
}

/** Fetch the model catalogue an endpoint publishes, tolerating a missing /models. */
export async function fetchModels(
  p: CustomProvider,
  apiKeyOverride?: string,
): Promise<{ models: ModelInfo[]; warning?: string }> {
  const key = apiKeyOverride ?? p.apiKey ?? "";
  const url = p.modelsUrl ?? modelsUrlFor(p.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      return { models: [], warning: `Model list unavailable (HTTP ${res.status}). Type the model name instead.` };
    }
    const json: any = await res.json();
    const rows: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    if (!rows.length) {
      return { models: [], warning: "This endpoint did not return a model list. Type the model name instead." };
    }
    return {
      models: rows
        .map((m) => ({
          id: String(m.id ?? m.name ?? m.model ?? "").replace(/^models\//, ""),
          contextLength: m.context_length ?? m.contextLength,
          isFree: true,
          promptPerMillion: m.pricing?.prompt != null ? Number(m.pricing.prompt) * 1e6 : undefined,
          completionPerMillion: m.pricing?.completion != null ? Number(m.pricing.completion) * 1e6 : undefined,
        }))
        .filter((m) => m.id),
    };
  } catch (err) {
    return {
      models: [],
      warning: `Could not reach the model list: ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
