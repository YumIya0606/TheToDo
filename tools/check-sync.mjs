import fs from 'node:fs';
import path from 'node:path';

/**
 * Consistency check across the two halves of the system.
 *
 * TheToDo reads schedule.json from the engine, and the two are separate programs
 * with separate type definitions. Nothing in either language links them, so the
 * only thing that catches a drift is this check: every field the Classes screen
 * reads has to exist in the engine's export, or that column silently renders
 * empty. It also guards the two performance and data-safety invariants that are
 * easy to break by accident.
 */

const ROOT = process.cwd();
const ENGINE_ROOT = process.env.ENGINE_ROOT ?? 'D:\\PROJECTS\\Class msg Filter\\ClassRadar';

const reports = [];
const add = (name, ok, detail) => reports.push({ name, ok, detail });

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

/* ---------------------------------------------- 1. the file they share */

const classes = read(path.join(ROOT, 'src', 'lib', 'classRadar.ts'));
add('classRadar.ts exists', classes !== null, 'cannot read src/lib/classRadar.ts');

if (classes) {
  // [field name, comment describing where it lives]
  const SHARED = [
    ['RadarEvent', 'events'],
    ['date', 'date'],
    ['startTime', 'startTime'],
    ['endTime', 'endTime'],
    ['classType', 'classType'],
    ['isFullSyllabus', 'isFullSyllabus'],
    ['questions', 'questions'],
    ['questionCount', 'questionCount'],
    ['episode', 'episode'],
    ['kind', 'kind'],
    ['tute', 'tute'],
    ['headline', 'headline'],
    ['original', 'original'],
    ['postedAt', 'postedAt'],
    ['counts', 'counts'],
    ['boosterPlan', 'boosterPlan'],
    ['range', 'range'],
    ['timezone', 'timezone'],
  ];

  for (const [uiField] of SHARED) {
    add(`UI declares: ${uiField}`, classes.includes(uiField), `missing from src/lib/classRadar.ts`);
  }

  // The superseded range shape must be gone: a leftover would mean the type
  // still promises a range the engine no longer sends.
  for (const gone of ['questionStart', 'questionEnd', 'questionRange']) {
    add(
      `superseded field removed: ${gone}`,
      !new RegExp(`\\b${gone}\\b`).test(classes),
      `${gone} is still declared but the engine no longer sends it`
    );
  }
}

/* --------------------------------------- 2. the engine actually agrees */

const engineExport = read(path.join(ENGINE_ROOT, 'server', 'src', 'pipeline', 'export.ts'));
if (engineExport) {
  for (const f of [
    'date',
    'startTime',
    'endTime',
    'classType',
    'isFullSyllabus',
    'questions',
    'questionCount',
    'episode',
    'kind',
    'tute',
    'headline',
    'original',
    'postedAt',
    'counts',
    'boosterPlan',
    'range',
    'timezone',
  ]) {
    add(`engine emits: ${f}`, new RegExp(`\\b${f}\\b`).test(engineExport), `not found in export.ts`);
  }
} else {
  add('engine source reachable', false, `no engine at ${ENGINE_ROOT}`);
}

/* ---------------------------- 3. no whole-store subscriptions at the root */

const app = read(path.join(ROOT, 'src', 'App.tsx'));
if (app) {
  // Comments are stripped first: the explanation of why this matters names the
  // very calls it is complaining about, and matching those would flag the fix.
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const whole = code.match(/use\w+Store\(\)/g) ?? [];
  add(
    'no whole-store subscriptions in App',
    whole.length === 0,
    `found ${whole.join(', ')} — re-renders the whole tree on any change`
  );
}

/* --------------------------------- 4. the persisted stores are all backed up */

const backup = read(path.join(ROOT, 'src', 'lib', 'backup.ts'));
const storeDir = path.join(ROOT, 'src', 'stores');
if (backup && fs.existsSync(storeDir)) {
  const persisted = new Set();
  for (const file of fs.readdirSync(storeDir)) {
    const text = read(path.join(storeDir, file)) ?? '';
    for (const m of text.matchAll(/name:\s*'(thetodo-[\w-]+)'/g)) persisted.add(m[1]);
  }
  for (const key of [...persisted].sort()) {
    add(`backup covers ${key}`, backup.includes(key), 'a store is persisted but not backed up');
  }
}

/* ----------------------------------------------- 5. engine-side storage */

const engineSchema = read(path.join(ENGINE_ROOT, 'server', 'src', 'db', 'schema.ts'));
if (engineSchema) {
  for (const col of ['tute_name', 'question_numbers', 'booster_episode', 'crosscheck']) {
    add(`engine column: ${col}`, engineSchema.includes(col), 'not in the engine schema');
  }
  add(
    'engine dropped the superseded range columns',
    !/question_range|question_start|question_end/.test(engineSchema),
    'the old range shape is still present, but the export has no fallback for it'
  );
}

const envExample = read(path.join(ROOT, '.env.example'));
if (envExample) {
  add('env documents TG_API_ID', /TG_API_ID\s*=/.test(envExample), 'not documented');
  add('env documents TG_API_HASH', /TG_API_HASH\s*=/.test(envExample), 'not documented');
}

/* ------------------------------------------------------- 6. the 460 tiles */

const grid = read(path.join(ROOT, 'src', 'components', 'boosters', 'BoosterGrid.tsx'));
if (grid) {
  add('booster tile is memoised', /memo\(function Chip/.test(grid), 'the grid lost its memo');
  add(
    'booster tile skips off-screen rendering',
    grid.includes('contentVisibility'),
    'off-screen tiles are being laid out'
  );
  add(
    'booster tile props unchanged',
    /num,\s*minutes,\s*watched/.test(grid),
    'a prop was added to the tile, which widens every memo comparison'
  );
}

/* ------------------------------------------------------------- report */

const failed = reports.filter((r) => !r.ok);
console.log(`\nconsistency check — ${reports.length - failed.length}/${reports.length} passed\n`);
for (const r of failed) console.log(`  FAIL  ${r.name}\n        ${r.detail}`);
if (!failed.length) console.log('  everything lines up');
process.exit(failed.length ? 1 : 0);
