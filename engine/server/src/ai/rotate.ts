import { getSetting, setSetting } from "../db/index.js";
import {
  CustomProviderAdapter,
  getProvider,
  PROVIDERS,
  type GatewayModel,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from "./provider.js";
import { availableCount, classify, pick, report, totalCount } from "./keypool.js";
import { chatUrlFor, getCustomProvider, poolKey } from "./custom.js";

/**
 * Resolves the configured provider and hands out API keys from the pool.
 *
 * The rotation is the point: free tiers cap requests per key, so the engine asks
 * for a key, tries it, and reports the outcome. A throttled key is parked and
 * the next one is used; a rejected key is taken out of rotation entirely. If
 * every key is cooling down the caller is told to wait rather than hammering a
 * rate limit and making the situation worse.
 */

export interface ProviderChoice {
  provider: LlmProvider;
  /** Pool namespace, e.g. "gemini", "openrouter", "custom:3". */
  poolKey: string;
  /** Keys usable right now, and how many are configured in total. */
  available: number;
  total: number;
}

export function providerId(): string {
  return getSetting("ai.provider", "gemini") as string;
}

/** The choice for a specific connection, or null if it does not exist. */
export function resolveProviderById(id: string): ProviderChoice | null {
  const previous = providerId();
  if (previous !== id) setSetting("ai.provider", id);
  try {
    return resolveProvider();
  } finally {
    if (previous !== id) setSetting("ai.provider", previous);
  }
}

/** One real completion against a connection, with a specific key. */
export async function providerCall(
  choice: ProviderChoice,
  model: string | undefined,
  key: string | undefined,
): Promise<string> {
  const { provider, poolKey: namespace } = choice;
  const out = await provider.complete(
    {
      messages: [
        { role: "system", content: "You reply with one JSON object and nothing else." },
        { role: "user", content: 'Return exactly {"ok":true}' },
      ],
      temperature: 0,
      maxTokens: 1500,
      model: model || provider.defaultModel,
      jsonMode: true,
      timeoutMs: 90_000,
    },
    key,
  );
  void namespace;
  return out.model;
}

export function resolveProvider(): ProviderChoice | null {
  const id = providerId();
  if (!id || id === "none") return null;

  if (id.startsWith("custom:")) {
    const customId = Number(id.slice("custom:".length));
    const cp = getCustomProvider(customId);
    if (!cp) return null;
    const provider = new CustomProviderAdapter(
      `custom:${customId}`,
      cp.name,
      cp.model || (getSetting("ai.model", "") as string),
      chatUrlFor(cp.baseUrl),
      cp.baseUrl,
    );
    const namespace = poolKey(customId);
    // The endpoint's own stored key is the fallback when no pool key exists.
    if (availableCount(namespace) === 0 && cp.apiKey) {
      return {
        provider,
        poolKey: namespace,
        available: 1,
        total: 1,
      };
    }
    return {
      provider,
      poolKey: namespace,
      available: availableCount(namespace),
      total: totalCount(namespace),
    };
  }

  const provider = getProvider(id);
  return {
    provider,
    poolKey: id,
    available: availableCount(id),
    total: totalCount(id),
  };
}

/** True when the failure is about money rather than capacity or a bad request. */
export function isBillingError(error: string): boolean {
  const m = error.toLowerCase();
  return (
    /\b402\b/.test(m) ||
    m.includes("insufficient credit") ||
    m.includes("insufficient balance") ||
    m.includes("balance is empty") ||
    m.includes("payment required") ||
    m.includes("out of credit") ||
    m.includes("exceeded your current quota")
  );
}

export interface RotatingResult extends LlmResult {
  keyId: number | null;
  /** Set when a paid model was swapped for its free equivalent mid-request. */
  switchedToFreeModel?: string;
}

/**
 * Run a request, walking the key pool. Each attempt takes the key the pool says
 * is least-recently-used and currently available; a failure is classified so the
 * offending key can be parked before the next attempt.
 *
 * A 402 means the chosen model is billed on this endpoint. Rather than failing,
 * the request is retried once on the free variant of the same model if the
 * provider publishes one — which is the difference between "your reseller ran
 * out of credit" and the app quietly not working at all.
 */
export async function completeWithPool(
  choice: ProviderChoice,
  req: LlmRequest,
  /** For a custom endpoint with a stored key but an empty pool. */
  fallbackKey?: string,
): Promise<RotatingResult> {
  const { provider, poolKey: namespace } = choice;
  const maxAttempts = Math.max(1, Math.min(totalCount(namespace), 4));
  let lastError: unknown;
  let attempts = 0;
  let switchedToFreeModel: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;
    const pooled = pick(namespace);
    const keyId = pooled?.id ?? null;
    const apiKey = pooled?.key ?? fallbackKey;

    if (!apiKey && provider.requiresKey) {
      throw new Error(
        `No usable API key for ${provider.label}. Add one in Settings → AI connections.`,
      );
    }

    try {
      const result = await provider.complete(req, apiKey);
      if (keyId !== null) report(keyId, "ok");

      // The fallback that worked becomes the connection's model, so the next
      // message goes straight to it instead of paying for a failed request every
      // single time to rediscover the same answer.
      if (switchedToFreeModel) {
        const { setConnectionModel } = await import("./connections.js");
        await setConnectionModel(namespace, switchedToFreeModel).catch(() => undefined);
        logModelSwitch(namespace, switchedToFreeModel);
      }

      return switchedToFreeModel
        ? { ...result, keyId, switchedToFreeModel }
        : { ...result, keyId };
    } catch (err) {
      const message = (err as Error).message;
      if (keyId !== null) report(keyId, classify(message), message);
      lastError = err;

      // Billed model on a free plan: move to the free twin and try again.
      if (isBillingError(message) && !switchedToFreeModel) {
        const current = req.model ?? provider.defaultModel;
        const free = await freeAlternativeFor(namespace, current);
        if (free && free !== current) {
          switchedToFreeModel = free;
          req = { ...req, model: free };
          attempts = Math.max(attempts - 1, 0);
          continue;
        }
      }

      // A wrong key or an unreachable endpoint will not fix itself by retrying
      // the same shape of request.
      const outcome = classify(message);
      if (outcome === "auth" && availableCount(namespace) === 0) break;
      if (outcome === "parse" && availableCount(namespace) === 0) break;
    }
  }

  if (lastError instanceof Error) {
    if (availableCount(namespace) === 0 && totalCount(namespace) > 0) {
      throw new Error(
        `All ${totalCount(namespace)} key(s) for ${provider.label} are rate limited right now. ` +
          `TheToDo will keep the messages and continue on the next run.`,
      );
    }
    throw lastError;
  }
  throw new Error("The AI provider could not be reached.");
}

/** One line, so a silent model change is visible in the app log. */
function logModelSwitch(connection: string, model: string): void {
  console.log(`[theTodo:engine] ${connection}: switched to the free model ${model}`);
}

/** A free model to fall back to when the current one turns out to be billed. */
async function freeAlternativeFor(namespace: string, model: string): Promise<string | null> {  try {
    const { cachedCatalogue } = await import("./catalogue.js");
    const { freeVariantOf } = await import("./ranking.js");
    const cat = cachedCatalogue(namespace);
    if (!cat.models.length) return null;

    // Best case: the same model published for free under another name, e.g.
    // gemini-3.8-flash and free/gemini-3.8-flash.
    const twin = freeVariantOf(cat.models as any, model);
    if (twin) return twin;

    // Otherwise the catalogue's own recommendation, which is ranked for Sinhala
    // and prefers a confirmed-free option over one of unknown cost.
    const suggested = cat.suggested;
    if (suggested && suggested !== model) return suggested;

    // Last resort: the best model explicitly marked free.
    const best = cat.models.find((m) => (m as any).free === true || m.isFree);
    return best && best.id !== model ? best.id : null;
  } catch {
    return null;
  }
}

/** Models an endpoint publishes, including user-defined ones. */
export async function modelsFor(id: string): Promise<GatewayModel[]> {
  if (id.startsWith("custom:")) {
    const { fetchModels } = await import("./custom.js");
    const cp = getCustomProvider(Number(id.slice("custom:".length)));
    if (!cp) return [];
    const r = await fetchModels(cp);
    return r.models.map((m) => ({
      id: m.id,
      contextLength: m.contextLength,
      isFree: m.isFree,
      promptPerMillion: m.promptPerMillion,
      completionPerMillion: m.completionPerMillion,
    }));
  }
  const { listGatewayModels } = await import("./provider.js");
  return listGatewayModels(id);
}

export { PROVIDERS };
