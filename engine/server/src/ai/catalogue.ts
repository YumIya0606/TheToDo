import { db, getSetting, setSetting } from "../db/index.js";
import { listGatewayModels, PROVIDERS } from "./provider.js";
import { fetchModels, getCustomProvider, poolKey } from "./custom.js";
import { rankForSinhala, suggestModel } from "./ranking.js";

/**
 * Model catalogues, cached on disk.
 *
 * A connection's catalogue rarely changes, but reading it is a network round
 * trip. Fetching every connection on every page load made the Settings screen
 * take as long as its slowest endpoint — with four reseller endpoints that was
 * four sequential requests, which is what made the app look frozen after
 * adding one. The cache turns that into an instant read, and a refresh is only
 * ever paid when the catalogue is actually stale.
 */

const TTL_MS = 6 * 60 * 60 * 1000; // six hours
const CACHE_KEY = (id: string) => `models.cache.${id}`;

export interface Catalogue {
  models: Array<{ id: string; why?: string; isFree: boolean; free?: boolean | "unknown" }>;
  suggested: string | null;
  warning: string | null;
  fetchedAt: number;
  /** True when the cache is old enough to be worth refreshing. */
  stale: boolean;
}

const EMPTY: Catalogue = { models: [], suggested: null, warning: null, fetchedAt: 0, stale: true };

function readCache(id: string): Catalogue | null {
  const raw = getSetting(CACHE_KEY(id), null) as Catalogue | null;
  if (!raw || !Array.isArray(raw.models)) return null;
  return { ...raw, stale: Date.now() - raw.fetchedAt > TTL_MS };
}

function writeCache(id: string, c: Omit<Catalogue, "stale">): void {
  setSetting(CACHE_KEY(id), c);
}

/** Cached catalogue for a connection, without touching the network. */
export function cachedCatalogue(id: string): Catalogue {
  return readCache(id) ?? EMPTY;
}

/**
 * Catalogue for a connection. Uses the cache unless it is missing or stale, in
 * which case it refreshes. A refresh that fails keeps the previous catalogue and
 * records the warning, so a provider having a bad minute never blanks the list.
 */
export async function catalogueFor(
  id: string,
  opts: { force?: boolean } = {},
): Promise<Catalogue> {
  const cached = readCache(id);
  if (cached && !cached.stale && !opts.force) return cached;

  const result = await fetchCatalogue(id);
  if (result.models.length > 0) {
    writeCache(id, { ...result, fetchedAt: Date.now() });
    return { ...result, fetchedAt: Date.now(), stale: false };
  }
  // Keep whatever we had, but surface why the refresh did not work.
  if (cached) return { ...cached, warning: result.warning ?? cached.warning };
  writeCache(id, { ...result, fetchedAt: Date.now() });
  return { ...result, fetchedAt: Date.now(), stale: true };
}

async function fetchCatalogue(id: string): Promise<Omit<Catalogue, "fetchedAt" | "stale">> {
  try {
    if (id.startsWith("custom:")) {
      const cp = getCustomProvider(Number(id.slice("custom:".length)));
      if (!cp) return { models: [], suggested: null, warning: "Endpoint not found." };
      // Prefer a key from the pool, then the one stored on the endpoint.
      const pooled = db
        .prepare(
          "SELECT key_value FROM api_keys WHERE provider = ? AND enabled = 1 ORDER BY id LIMIT 1",
        )
        .get(id) as { key_value: string } | undefined;
      const key = pooled?.key_value ?? cp.apiKey ?? undefined;
      const fetched = await fetchModels(cp, key);
      return {
        models: rankForSinhala(fetched.models).slice(0, 200).map((m) => ({
          id: m.id,
          why: m.why,
          isFree: m.free === true,
          free: m.free,
        })),
        suggested: suggestModel(fetched.models)?.id ?? null,
        warning: fetched.warning ?? null,
      };
    }

    if (id === "kiloFree") {
      // The gateway routes itself; there is nothing to choose.
      return { models: [], suggested: "kilo-auto/free", warning: null };
    }

    const pooled = db
      .prepare(
        "SELECT key_value FROM api_keys WHERE provider = ? AND enabled = 1 ORDER BY id LIMIT 1",
      )
      .get(id) as { key_value: string } | undefined;
    const models = await listGatewayModels(id, pooled?.key_value);
    return {
      models: rankForSinhala(models).slice(0, 200).map((m) => ({
        id: m.id,
        why: m.why,
        isFree: m.free === true,
        free: m.free,
      })),
      suggested: suggestModel(models)?.id ?? null,
      warning: null,
    };
  } catch (e) {
    return { models: [], suggested: null, warning: (e as Error).message };
  }
}

/** Every connection id, in display order, including custom ones. */
export function allConnectionIds(): string[] {
  const builtin = Object.keys(PROVIDERS).filter((k) => k !== "none");
  const custom = (
    db.prepare("SELECT id FROM custom_providers ORDER BY name").all() as Array<{ id: number }>
  ).map((r) => poolKey(r.id));
  return [...builtin, ...custom];
}

/** Drop a cached catalogue, e.g. when an endpoint's URL or model changes. */
export function invalidateCatalogue(id: string): void {
  setSetting(CACHE_KEY(id), null);
}

/**
 * Refresh any catalogue that is missing or stale, in the background.
 *
 * Called at startup so the Settings screen is never the thing that pays for a
 * network round trip. Errors are swallowed: a cache miss is not a failure, and
 * the worst case is that the list says "not checked yet".
 */
export function warmCatalogues(): void {
  for (const id of allConnectionIds()) {
    const cached = readCache(id);
    if (cached && !cached.stale) continue;
    void catalogueFor(id, { force: false }).catch(() => undefined);
  }
}
