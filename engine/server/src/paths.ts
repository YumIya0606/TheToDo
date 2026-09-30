import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where this module lives, in both module systems the engine runs under.
 *
 * `engine/server/src` is executed as ESM through tsx during development but is
 * bundled into a single CommonJS file for the desktop app, where `import.meta`
 * does not exist and `__dirname` does. Probing for both keeps one codebase
 * working in both places.
 */
export function moduleDir(): string {
  const metaUrl = (import.meta as unknown as { url?: string })?.url;
  if (typeof metaUrl === "string" && metaUrl.startsWith("file:")) {
    return path.dirname(fileURLToPath(metaUrl));
  }
  // Published by the CommonJS bundle's banner, which is the only place the
  // module-scoped __dirname is actually in scope.
  const bundled = (globalThis as unknown as { __engineDir?: string }).__engineDir;
  if (typeof bundled === "string" && bundled.length > 0) return bundled;
  return process.cwd();
}

/**
 * Root of the engine, in both layouts:
 *   from source   <project>/engine/server/src/paths.ts -> <project>/engine
 *   bundled       <project>/engine/dist/server.cjs    -> <project>/engine
 *
 * The data folder sits beside the bundle, inside the engine's own folder, so it
 * is never confused with the app's data and the two can be backed up together.
 */
export const APP_ROOT: string = process.env.CLASSRADAR_APP_ROOT
  ? path.resolve(process.env.CLASSRADAR_APP_ROOT)
  : path.resolve(moduleDir(), "..");

/** Folder holding messages, the database, the Telegram session and downloads. */
export const DATA_DIR: string = process.env.CLASSRADAR_DATA_DIR
  ? path.resolve(process.env.CLASSRADAR_DATA_DIR)
  : path.join(APP_ROOT, "data");

/** Folder the desktop app reads the exported schedule from. */
export const SCHEDULE_FILE: string = path.join(DATA_DIR, "schedule.json");

/**
 * Keep the engine quiet.
 *
 * The MTProto client writes an INFO banner on every connect. Launched as a
 * background process by the desktop app, that is noise in a log nobody is
 * watching, and it is easy to mistake for something going wrong. Suppressed
 * unless something is genuinely wrong, and restorable with THETODO_DEBUG=1 when
 * a connection problem needs tracing.
 */
export function quietenEngine(): void {
  if (process.env.THETODO_DEBUG === "1") return;
  const realWarn = console.warn.bind(console);
  const realError = console.error.bind(console);
  const isLibraryNoise = (args: unknown[]) =>
    typeof args[0] === "string" &&
    /^\[INFO\]/.test(args[0]) &&
    args.some((a) => typeof a === "string" && /teleproto|LAYER|version/.test(a));
  console.warn = (...args: unknown[]) => {
    if (isLibraryNoise(args)) return;
    realWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (isLibraryNoise(args)) return;
    realError(...args);
  };
}
