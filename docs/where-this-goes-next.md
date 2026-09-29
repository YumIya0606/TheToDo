# Where this app can go next

An honest look at what is worth building, roughly in the order it would pay
off. Written after working in both codebases, so it is based on what is actually
there rather than on a wish list.

---

## 1. Make the reading engine a first-class part of the app

Right now the engine is a separate process that TheToDo reaches over HTTP. That
works, and it keeps the two codebases independent, but it means a student has to
know that two programs exist.

**Bundle it as a Tauri sidecar.** `engine_start` is already in `main.rs` and
Tauri supports declaring a sidecar binary; what is missing is the packaging step
and a launch policy. Concretely:

- Emit the engine as a single executable (Node's single-executable build, or a
  tiny Rust wrapper that spawns the bundle it ships beside).
- Declare it in `tauri.conf.json` under `externalBin`.
- Start it on launch, stop it on quit, and show one state: running or not.
- Put the engine's data folder inside TheToDo's app data, so there is one
  backup to take rather than two.

That turns "ClassRadar is a separate app you also run" into a feature of this
app. It is the single highest-value change on this list.

## 2. Keep the engine's improvements in the app, not beside it

The engine holds genuinely valuable logic — the key pool, the model ranking for
Sinhala, the cross-check, the prompt. None of it is UI. When the sidecar step
above lands, the natural end state is:

- `engine/` moves inside this repository as a workspace package.
- The extraction prompt, the ranking table and the key pool are imported by
  tests in *this* repo, so a change to the Sinhala handling cannot regress
  unnoticed on the other side of a process boundary.

Right now `tools/check-sync.mjs` is the only thing holding the two file formats
together, and it can only check names, not meaning.

## 3. A study planner that knows the actual week

The planner already models recurring blocks and alternate weeks. What it cannot
do yet is *discover* the week. Given the readings already coming in, the obvious
next step is a reconciliation view:

- Compare each commitment against what the channels actually announced.
- Flag: a class the timetable has but the channels have not mentioned this week.
- Flag: a class the channels announced that the timetable has no block for.
- Suggest the update, never apply it.

This is the feature that makes the two halves worth having together, and it is
the reason the readings are worth storing with their original message attached.

## 4. Turn postponed classes into a real change

A postponement is currently a message that says so. The useful version is a
diff: this Thursday's physics theory moved to Friday 8pm. That implies a
one-off override of a recurring commitment for that week only — which is exactly
the shape the `offThisWeek` flag already models for alternate weeks.

## 5. Make the booster tracker a syllabus

The pointer currently carries the newest study-plan post. Two additions that would
earn their keep:

- **A question-to-tute map.** The readings already capture which questions come
  from which tute. Over a term that is a map of what has been covered and what is
  still outstanding, which is more useful than an episode counter.
- **Catch-up ordering.** Given four unanswered episodes and a paper on Saturday,
  which three should be watched? That is a small scheduling problem the planner
  already has the primitives for.

## 6. The global shortcut system is under-used

`spawn_external_terminal` and a global shortcut are wired. A natural use:

- Hotkey to capture a thought straight into SilentBoy.
- Hotkey to record "attended 40 minutes of chemistry" without leaving the app.
- Hotkey to mark a booster episode watched while it plays.

The store actions already exist; only the binding is missing.

## 7. Test the parts that cannot fail silently

The test suite covers the fortnightly maths, the backup round-trip, the engine
file contract, the grid-isolation guarantee and the reducer's cost. The gaps that
would hurt:

- **Restore from a real backup file.** The unit test uses a synthetic one. A
  fixture that is an actual export from a previous version would catch format
  changes that quietly lose data.
- **The engine's prompt.** Nothing pins what the model is asked to return, so a
  prompt edit can change the shape of the output with no test failing. A fixture
  message with its expected extraction would catch that.
- **Store migrations.** A backup written on version N restored on version N+1 is
  the scenario that actually loses data, and it is the one never tested.

## 8. Smaller things worth doing

- The engine's `advice` banner and this app's banner were two independent
  mechanisms for the same message. One renderer would be cleaner.
- The engine keeps an in-memory model catalogue cache and a disk copy. The disk
  copy is the only one worth keeping.
- `runAnalysisQueue` retries rate-limited work forever, in principle. A cap with
  an honest "I will try again tomorrow" would be better than a queue that
  always looks busy.

---

## What I would not do

- **Move the engine's UI into this app.** The reading screens and the productivity
  screens are different jobs; merging them would make both worse.
- **Make TheToDo depend on the engine's database.** It reads a file, and should
  keep doing so. A direct database dependency would couple two things that
  currently fail independently.
- **Add a second AI abstraction inside this app.** The engine's is tested and
  works. Duplicating it would mean maintaining the same key-pool and fallback
  logic in two places.
