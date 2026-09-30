import { db } from "../db/index.js";
import { getSetting } from "../db/index.js";

/**
 * A pool of API keys per provider, with health tracking.
 *
 * Free tiers cap requests per *key*, not per account, so several keys for one
 * provider multiply throughput several times over. That only works if the app
 * can tell which key is currently throttled, so every outcome is classified and
 * the unusable keys are parked for a cooldown while the queue keeps moving
 * through the rest.
 */

export type KeyStatus = "active" | "rate_limited" | "invalid" | "unknown";

export type Outcome = "ok" | "rate_limit" | "auth" | "server" | "parse" | "other";

export interface PooledKey {
  id: number;
  provider: string;
  label: string;
  key: string;
  status: KeyStatus;
  disabledUntil: number;
}

interface KeyRow {
  id: number;
  provider: string;
  label: string;
  key_value: string;
  enabled: number;
  status: KeyStatus;
  last_error: string | null;
  disabled_until: number;
  ok_count: number;
  fail_count: number;
  used_count: number;
  last_used_at: number;
  last_ok_at: number;
}

/** How long a throttled key is skipped. Grows with the size of the rate limit. */
const COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 45 * 60_000;

/** Classify a provider error so the right key can be penalised correctly. */
export function classify(error: string): Outcome {
  const m = error.toLowerCase();
  if (
    m.includes("429") ||
    m.includes("quota exceeded") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("too many requests")
  ) {
    return "rate_limit";
  }
  if (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("unauthorized") ||
    m.includes("invalid api key") ||
    m.includes("api key not valid") ||
    m.includes("permission denied")
  ) {
    return "auth";
  }
  if (/\b(500|502|503|504)\b/.test(m)) return "server";
  if (m.includes("no json") || m.includes("empty completion") || m.includes("no text")) return "parse";
  return "other";
}

function toKey(r: KeyRow): PooledKey {
  return {
    id: r.id,
    provider: r.provider,
    label: r.label,
    key: r.key_value,
    status: r.status,
    disabledUntil: r.disabled_until,
  };
}

export function listKeys(
  provider?: string,
): Array<PooledKey & { stats: KeyRow; enabled: number; last_error: string | null; key_value: string }> {
  const rows = (
    provider
      ? db.prepare("SELECT * FROM api_keys WHERE provider = ? ORDER BY id").all(provider)
      : db.prepare("SELECT * FROM api_keys ORDER BY provider, id").all()
  ) as KeyRow[];
  return rows.map((r) => ({
    ...toKey(r),
    stats: r,
    enabled: r.enabled,
    last_error: r.last_error,
    key_value: r.key_value,
  }));
}

export function addKey(provider: string, key: string, label = ""): number {
  const trimmed = key.trim();
  const now = Date.now();
  const existing = db
    .prepare("SELECT id FROM api_keys WHERE provider = ? AND key_value = ?")
    .get(provider, trimmed) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE api_keys SET enabled = 1, status = 'unknown', disabled_until = 0 WHERE id = ?").run(
      existing.id,
    );
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO api_keys (provider, label, key_value, enabled, status, created_at)
       VALUES (?,?,?,1,'unknown',?)`,
    )
    .run(provider, label || defaultLabel(provider), trimmed, now);
  return Number(info.lastInsertRowid);
}

function defaultLabel(provider: string): string {
  const n = (db.prepare("SELECT COUNT(*) n FROM api_keys WHERE provider = ?").get(provider) as any).n;
  return `${provider} ${n + 1}`;
}

export function updateKey(
  id: number,
  patch: { label?: string; enabled?: boolean; status?: KeyStatus; key?: string },
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.label !== undefined) {
    sets.push("label = @label");
    params.label = patch.label;
  }
  if (patch.enabled !== undefined) {
    sets.push("enabled = @enabled");
    params.enabled = patch.enabled ? 1 : 0;
  }
  if (patch.status !== undefined) {
    sets.push("status = @status");
    params.status = patch.status;
  }
  if (patch.key !== undefined) {
    sets.push("key_value = @key");
    params.key = patch.key.trim();
  }
  if (patch.enabled === true) {
    sets.push("status = 'unknown'", "disabled_until = 0", "last_error = NULL");
  }
  if (!sets.length) return;
  db.prepare(`UPDATE api_keys SET ${sets.join(", ")} WHERE id = @id`).run(params);
}

export function removeKey(id: number): void {
  db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
}

export function clearPool(provider: string): void {
  db.prepare("DELETE FROM api_keys WHERE provider = ?").run(provider);
}

/**
 * Choose the next key to use for this provider.
 *
 * Least-recently-used among the ones that are enabled and not cooling down, so a
 * single key is never hammered while another sits idle. Keys with no history
 * come first, which means a newly added key is tried immediately.
 */
export function pick(provider: string): PooledKey | null {
  const now = Date.now();
  const row = db
    .prepare(
      `SELECT * FROM api_keys
       WHERE provider = ? AND enabled = 1 AND disabled_until <= ?
       ORDER BY (used_count = 0) DESC, last_used_at ASC, id ASC
       LIMIT 1`,
    )
    .get(provider, now) as KeyRow | undefined;
  if (!row) return null;
  db.prepare("UPDATE api_keys SET used_count = used_count + 1, last_used_at = ? WHERE id = ?").run(
    now,
    row.id,
  );
  return toKey(row);
}

/** How many keys can be used right now. */
export function availableCount(provider: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) n FROM api_keys WHERE provider = ? AND enabled = 1 AND disabled_until <= ?",
    )
    .get(provider, Date.now()) as { n: number };
  return row.n;
}

export function totalCount(provider: string): number {
  const row = db
    .prepare("SELECT COUNT(*) n FROM api_keys WHERE provider = ? AND enabled = 1")
    .get(provider) as { n: number };
  return row.n;
}

/** Record how a call went, so the next pick routes around trouble. */
export function report(id: number, outcome: Outcome, message = ""): void {
  const now = Date.now();
  if (outcome === "ok") {
    db.prepare(
      `UPDATE api_keys SET ok_count = ok_count + 1, last_ok_at = ?, status = 'active',
        last_error = NULL, disabled_until = 0 WHERE id = ?`,
    ).run(now, id);
    return;
  }

  const row = db.prepare("SELECT fail_count, disabled_until FROM api_keys WHERE id = ?").get(id) as
    | { fail_count: number; disabled_until: number }
    | undefined;
  const fails = (row?.fail_count ?? 0) + 1;

  if (outcome === "rate_limit") {
    // Back off harder each consecutive failure, within reason.
    const current = row?.disabled_until ?? 0;
    const base = Math.max(current, now + COOLDOWN_MS);
    const cooldown = Math.min(base * 2 ** Math.min(fails - 1, 6) - now, MAX_COOLDOWN_MS);
    db.prepare(
      `UPDATE api_keys SET fail_count = ?, status = 'rate_limited', disabled_until = ?,
        last_error = ? WHERE id = ?`,
    ).run(fails, now + Math.max(COOLDOWN_MS, cooldown), message.slice(0, 300), id);
    return;
  }

  if (outcome === "auth") {
    // A rejected key does not recover by waiting; take it out of rotation.
    db.prepare(
      `UPDATE api_keys SET fail_count = ?, status = 'invalid', last_error = ? WHERE id = ?`,
    ).run(fails, message.slice(0, 300), id);
    return;
  }

  db.prepare(
    `UPDATE api_keys SET fail_count = ?, last_error = ? WHERE id = ?`,
  ).run(fails, message.slice(0, 300), id);
}

/** Clear cooldown for a provider, e.g. when the student presses Retry now. */
export function revive(provider: string): number {
  const info = db
    .prepare(
      "UPDATE api_keys SET status = 'unknown', disabled_until = 0, fail_count = 0 WHERE provider = ? AND status != 'invalid'",
    )
    .run(provider);
  return info.changes;
}

/**
 * Move the single legacy key into the pool so an existing install keeps working
 * and gains the rotation without the student re-entering anything.
 */
export function adoptLegacyKey(): number {
  if (getSetting("ai.keyInPool", false)) return 0;
  // Mark it done first: if anything below throws, a retry must not duplicate.
  setLegacyCleared();
  const legacy = getSetting("ai.apiKey", "") as string;
  if (!legacy?.trim()) return 0;
  const provider = getSetting("ai.provider", "gemini") as string;
  const exists = db
    .prepare("SELECT id FROM api_keys WHERE provider = ? AND key_value = ?")
    .get(provider, legacy) as { id: number } | undefined;
  if (exists) return 0;
  return addKey(provider, legacy, "migrated");
}

function setLegacyCleared(): void {
  db.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES('ai.keyInPool','true')").run();
}
