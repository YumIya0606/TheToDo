import { DatabaseSync } from "node:sqlite";

/**
 * Thin adapter over Node's built-in SQLite (node:sqlite).
 *
 * TheToDo deliberately avoids a native database module: a prebuilt .node binary has
 * to match the exact ABI of the Node or Electron build that loads it, which
 * forces a rebuild step on every runtime change and stops the desktop app from
 * being self-contained. node:sqlite ships inside Node itself, so there is
 * nothing to compile and nothing to break.
 *
 * The surface below mirrors the subset of better-sqlite3 this project uses, so
 * the calling code reads like ordinary SQL.
 */

export type SqlValue = string | number | bigint | boolean | null | Uint8Array;
export type NamedParameters = Record<string, any>;
export type BindParameters = SqlValue | NamedParameters | SqlValue[];
/** Rows are cast by callers to the shape each query selects. */
export type Row = any;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export class Statement {
  constructor(
    private readonly stmt: ReturnType<DatabaseSync["prepare"]>,
    private readonly sql: string = "",
  ) {}

  run(...params: BindParameters[]): RunResult {
    try {
      const args = bind(params);
      const res = this.stmt.run(...(Array.isArray(args) ? (args as never[]) : ([args] as never[])));
      return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
    } catch (err) {
      this.guard(err);
    }
  }

  get(...params: BindParameters[]): Row | undefined {
    try {
      const args = bind(params);
      return this.stmt.get(...(Array.isArray(args) ? (args as never[]) : ([args] as never[]))) as
        | Row
        | undefined;
    } catch (err) {
      this.guard(err);
    }
  }

  all(...params: BindParameters[]): Row[] {
    try {
      const args = bind(params);
      return this.stmt.all(...(Array.isArray(args) ? (args as never[]) : ([args] as never[]))) as Row[];
    } catch (err) {
      this.guard(err);
    }
  }

  /**
   * node:sqlite throws when a statement is given a named parameter it never
   * references. That strictness is useful — it catches a filter object leaking
   * pagination keys into a COUNT query — but the message is opaque, so it is
   * rewritten here to name the offending query and key.
   */
  private guard(err: unknown): never {
    const m = /Unknown named parameter '([^']+)'/.exec((err as Error)?.message ?? "");
    if (m) {
      const key = m[1];
      const where = /namedParameters\s*=\s*\{([^}]*)\}/.exec(this.sql)?.[1] ?? "";
      throw new Error(
        `SQLite rejected unused parameter @${key} in: ${this.sql.replace(/\s+/g, " ").trim().slice(0, 160)}` +
          (where ? ` — available: ${where.trim()}` : ""),
      );
    }
    throw err;
  }
}

/**
 * Turn a better-sqlite3 style argument list into what node:sqlite expects.
 *
 * Returns an array to be spread positionally, or a single object to be passed
 * whole for named parameters. `undefined` is normalised to NULL on every path,
 * because node:sqlite rejects it outright — and an optional column that is
 * simply absent is normal, not an error.
 */
function bind(params: BindParameters[]): SqlValue[] | NamedParameters {
  if (params.length === 0) return [];
  if (params.length === 1 && Array.isArray(params[0])) {
    return (params[0] as SqlValue[]).map(clean);
  }
  if (params.length === 1 && params[0] !== null && typeof params[0] === "object") {
    // A single object means named parameters. Sanitise its values too: passing it
    // straight through is how an absent optional column turns into
    // "Provided value cannot be bound to SQLite parameter 10".
    const named = params[0] as NamedParameters;
    const out: NamedParameters = {};
    for (const key of Object.keys(named)) out[key] = clean(named[key]);
    return out;
  }
  return params.map(clean);
}

function clean(v: any): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" && !Number.isFinite(v)) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && !(v instanceof Uint8Array)) {
    // Objects that are not a blob cannot be stored; stringify rather than throw.
    try {
      return JSON.stringify(v);
    } catch {
      return null;
    }
  }
  return v as SqlValue;
}

export class Database {
  private readonly inner: DatabaseSync;
  private readonly cache = new Map<string, Statement>();
  private depth = 0;

  constructor(filename: string) {
    this.inner = new DatabaseSync(filename);
  }

  prepare(sql: string): Statement {
    let s = this.cache.get(sql);
    if (!s) {
      s = new Statement(this.inner.prepare(sql), sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  exec(sql: string): void {
    this.inner.exec(sql);
  }

  /** better-sqlite3 compatible pragma helper. */
  pragma(statement: string): Row[] {
    return this.inner.prepare(`PRAGMA ${statement}`).all() as Row[];
  }

  /**
   * better-sqlite3 compatible transaction wrapper. Re-entrant: a nested call
   * joins the outer transaction rather than failing.
   */
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      if (this.depth > 0) return fn(...args);
      this.inner.exec("BEGIN");
      this.depth++;
      try {
        const out = fn(...args);
        this.inner.exec("COMMIT");
        return out;
      } catch (err) {
        try {
          this.inner.exec("ROLLBACK");
        } catch {
          /* rolling back a finished transaction is not fatal */
        }
        throw err;
      } finally {
        this.depth--;
      }
    };
  }

  close(): void {
    this.cache.clear();
    try {
      this.inner.close();
    } catch {
      /* already closed */
    }
  }
}
