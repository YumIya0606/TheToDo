# TheToDo

**A study planner for an A/L student in Sri Lanka, and the reading engine that
feeds it.**

Your teachers post 20–30 Telegram messages a day, mostly in Sinhala: class
times, last-minute postponements, Zoom links, YouTube recordings, papers to
attempt before class, and a daily "which questions, which tute" note for the
physics theory channel. The engine reads all of it and explains it in English.
Everything lands in the app as a class calendar, a to-do list, a study plan and
a link library.

---

## One project

The reading engine used to be a separate app. It now lives here, in
`engine/`, and is started by the app itself. There is nothing extra to install
and nothing extra to run.

```
test/
  src/            the interface
  src-tauri/      the Rust shell, windows and commands
  engine/         the reading engine
    server/src/     Telegram, AI, database, the schedule it exports
    tools/          diagnostics for the engine
    dist/           built bundle (generated)
  shared/         types both halves agree on
  tools/          checks across the whole project
  docs/
```

One `npm install`, one `npm run build`, one repository, one set of tests.

## Getting started

```bash
npm install          # once
npm run tauri dev    # develop
npm run tauri build  # a desktop app
```

The reading engine is built as part of `npm run build`; you never start it by
hand. Settings → **API keys & connections** starts it if it is not running.

---

## What it does

| Screen | |
|---|---|
| **Dashboard** | List, Kanban and Matrix over your tasks |
| **Today** | The next class, your to-do list, what the channels are saying |
| **Study Planner** | Recurring time commitments, alternate weeks, and a free-time engine that splits what is left across your subjects, weak ones getting more |
| **Classes** | The schedule read from your tuition channels, with per-channel coverage, Zoom and video links, and the original Sinhala behind each reading |
| **Boosters** | Speed and Theory episode trackers, plus what the channel says to work on next |
| **Notes · Diary · Tags** | |
| **SilentBoy** | A writing mode that gets out of the way, and gets out of the way of you |
| **Focus Mode** | A WebGL water shader and real study-time analytics |
| **Quick Capture** | `Ctrl+Shift+X` anywhere, from a floating 44×44 window |

---

## The reading engine

It is API-only; the app renders everything. The two meet over a loopback port
and one exported file, `schedule.json`.

```
Telegram  →  SQLite  →  AI extraction  →  schedule.json  →  the app
```

- **Telegram** over MTProto with your own account, or the public web preview
  where one exists. Three of your channels need an account; the rest do not.
- **Extraction** is one message per call, oldest first, with no conversation
  history: about 1,500 tokens each, so context length is never a concern. The
  model returns the class type, the date and time, whether a class moved, what
  you must do, and — for the daily theory posts — the tute, the exact question
  numbers, and the booster episode.
- **Media is never sent to a model.** A file's name goes into the prompt; a PDF
  is read on this machine and only a short excerpt is used. Images are not sent
  at all.
- **Keys rotate.** Free tiers cap requests per key, so several keys for one
  connection multiply your allowance. Throttled keys are parked with a growing
  cooldown and the queue moves on; rejected keys are taken out of rotation.
- **A second opinion** is optional. Reading a date or a time twice with
  different models, and showing only the messages where they disagree, is a
  better guard than a single confident answer.

### Channels

| Channel | Subject | Public preview |
|---|---|---|
| `@RD27T` | Combined Maths theory | yes |
| `@RD_27REVISION` | Combined Maths revision | yes |
| `@DU27PPR` | Physics paper | yes |
| `@RD27PAPERONLINE` | Combined Maths paper | no — needs your account |
| `@DU27T` | Physics theory | no — needs your account |
| `@DU27BNRe` | Physics revision | no — needs your account |

---

## Checks

```bash
npm test              # 53 tests
npm run check:sync    # the app and the engine agree
npm run check:sinhala # the Sinhala text survived every edit
npm run check:encoding
npm run check:perf    # the booster grid's cost
npm run check:all
```

`check:sync` matters most: the app and the engine are separate processes with
separate type definitions for the same file, so nothing in either language would
otherwise notice a drift.

## Your data

Everything is local, in the app's own data folder. One backup covers all of it —
tasks, notes, diary, planner, boosters, study analytics, and the engine's channels.
`Backup` in Settings writes the lot to a file you choose.

The engine keeps its messages, database and Telegram session separately under
`engine/`, so a restore of the app's data never disturbs what has been read.
