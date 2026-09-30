import { getSetting, setSetting } from "../db/index.js";
import { PROVIDERS } from "./provider.js";
import { listKeys, totalCount, availableCount } from "./keypool.js";
import {
  getCustomProvider,
  listCustomProviders,
  poolKey,
} from "./custom.js";
import { catalogueFor, type Catalogue } from "./catalogue.js";

/**
 * One list of connections.
 *
 * A connection is anywhere TheToDo can send a message: a known free service,
 * or an endpoint the student supplied. Keys, the chosen model and the active
 * selection all hang off a connection, so there is exactly one concept to
 * understand instead of a provider setting, a key table and a custom table that
 * have to be kept in step with each other.
 */

export type ConnectionKind = "service" | "custom";

export interface ConnectionKey {
  id: number;
  label: string;
  masked: string;
  status: string;
  enabled: boolean;
  coolingDown: boolean;
  ok: number;
  fail: number;
  used: number;
  lastError: string | null;
}

export interface Connection {
  id: string;
  kind: ConnectionKind;
  name: string;
  note: string;
  baseUrl: string | null;
  requiresKey: boolean;
  /** Model currently selected for this connection. */
  model: string;
  /** Model TheToDo would pick, ranked for Sinhala. */
  suggestedModel: string | null;
  models: Array<{ id: string; why?: string; isFree: boolean; free?: boolean | "unknown" }>;
  modelsWarning: string | null;
  modelsFetchedAt: number;
  keys: ConnectionKey[];
  keySummary: { total: number; available: number; active: number; rateLimited: number; invalid: number };
  active: boolean;
  removable: boolean;
}

/**
 * Display order for the built-in services. Every free tier the app can actually
 * use, most reliable for Sinhala first. Keep in step with PROVIDERS: a service
 * that is registered but not listed here simply will not appear.
 */
const BUILTIN_ORDER = ["gemini", "nvidia", "groq", "kilo", "openrouter", "kiloFree"];

function toKeys(provider: string): ConnectionKey[] {
  return listKeys(provider).map((k) => ({
    id: k.id,
    label: k.label,
    masked: mask(k.key),
    status: k.status,
    enabled: k.enabled === 1,
    coolingDown: k.disabledUntil > Date.now(),
    ok: k.stats.ok_count,
    fail: k.stats.fail_count,
    used: k.stats.used_count,
    lastError: k.last_error,
  }));
}

function mask(k: string): string {
  const s = (k ?? "").trim();
  if (s.length <= 10) return s.slice(0, 3) + "…";
  return `${s.slice(0, 5)}…${s.slice(-4)}`;
}

function summarise(keys: ConnectionKey[]) {
  return {
    total: keys.length,
    available: keys.filter((k) => k.enabled && !k.coolingDown).length,
    active: keys.filter((k) => k.status === "active").length,
    rateLimited: keys.filter((k) => k.status === "rate_limited").length,
    invalid: keys.filter((k) => k.status === "invalid").length,
  };
}

/**
 * Every connection, in one shape.
 *
 * The catalogue is read from cache, never fetched here: listing connections is
 * what the Settings screen and the app's startup both do, so it has to be
 * instant. Refreshes happen on demand, or in the background when a cache entry
 * is stale.
 */
export async function listConnections(
  opts: { refresh?: boolean } = {},
): Promise<Connection[]> {
  const activeId = getSetting("ai.provider", "gemini") as string;
  const out: Connection[] = [];

  const build = (c: Catalogue): Connection["models"] => c.models;
  void build;

  for (const id of BUILTIN_ORDER) {
    const p = PROVIDERS[id];
    if (!p) continue;
    const keys = toKeys(id);
    const cat = await catalogueFor(id, { force: opts.refresh });
    out.push({
      id,
      kind: "service",
      name: p.label,
      note: "note" in p ? String((p as { note?: string }).note ?? "") : "",
      baseUrl: null,
      requiresKey: p.requiresKey,
      model: modelFor(id, p.defaultModel),
      suggestedModel: cat.suggested,
      models: cat.models,
      modelsWarning: cat.warning,
      modelsFetchedAt: cat.fetchedAt,
      keys,
      keySummary: summarise(keys),
      active: activeId === id,
      removable: false,
    });
  }

  for (const c of listCustomProviders()) {
    const pid = poolKey(c.id);
    const keys = toKeys(pid);
    const cat = await catalogueFor(pid, { force: opts.refresh });
    const hasKey = keys.length > 0 || Boolean(c.apiKey);
    out.push({
      id: pid,
      kind: "custom",
      name: c.name,
      note: `Your endpoint at ${c.baseUrl}`,
      baseUrl: c.baseUrl,
      requiresKey: !hasKey,
      model: c.model || cat.suggested || "",
      suggestedModel: cat.suggested,
      models: cat.models,
      modelsWarning: cat.warning,
      modelsFetchedAt: cat.fetchedAt,
      keys,
      keySummary: summarise(keys),
      active: activeId === pid,
      removable: true,
    });
  }

  return out;
}

/** One connection, fully described. */
export async function describeConnection(id: string): Promise<Connection | null> {
  const all = await listConnections();
  return all.find((c) => c.id === id) ?? null;
}

/** One connection, with its catalogue freshly fetched. */
export async function describeConnectionFresh(id: string): Promise<Connection | null> {
  const all = await listConnections({ refresh: true });
  return all.find((c) => c.id === id) ?? null;
}

/** Switch which connection is used, optionally choosing its model. */
export function activateConnection(id: string, model?: string): void {
  if (id.startsWith("custom:")) {
    if (!getCustomProvider(Number(id.slice("custom:".length)))) {
      throw new Error("That endpoint no longer exists.");
    }
  } else if (!PROVIDERS[id]) {
    throw new Error("Unknown connection.");
  }
  setSetting("ai.provider", id);
  if (model !== undefined) setSetting("ai.model", model);
  else if (id.startsWith("custom:")) {
    const cp = getCustomProvider(Number(id.slice("custom:".length)));
    if (cp?.model) setSetting("ai.model", cp.model);
  } else {
    setSetting("ai.model", "");
  }
}

/**
 * The model chosen for a connection.
 *
 * Stored per connection rather than as one global setting, so switching the
 * active connection does not lose what was picked for the other one, and a
 * connection you configured keeps its model even while another is in use.
 */
const modelKey = (id: string) => `model.${id}`;

export function modelFor(id: string, fallback: string): string {
  return (getSetting(modelKey(id), "") as string) || fallback;
}

export async function setConnectionModel(id: string, model: string): Promise<void> {
  if (id.startsWith("custom:")) {
    const { updateCustomProvider } = await import("./custom.js");
    updateCustomProvider(Number(id.slice("custom:".length)), { model });
  } else {
    setSetting(modelKey(id), model);
  }
  // Keep the global in step when this connection is the one in use, so the
  // analysis path and the settings screen cannot disagree.
  if (getSetting("ai.provider", "") === id) setSetting("ai.model", model);
}

export { totalCount, availableCount };
