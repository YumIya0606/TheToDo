# TheToDo — Productivity Suite

A beautiful, feature-rich desktop productivity app built with **Tauri v2 + React 19 + TypeScript + Tailwind v4 + Zustand**. Tasks, notes, diary, tags, automation, an immersive creative-writing mode (SilentBoy), and a WebGL-powered Focus timer — in one polished package.

---

## ✨ Features

### Tasks
- **Multiple views** — Dashboard (stats), List, Kanban board, and an Eisenhower Matrix.
- **Priority levels** — Low / Medium / High / Urgent with color-coded badges.
- **Due dates & scheduling** — Schedule a task and get an **OS notification + in-app toast** exactly once when it's due.
- **Subtasks, tags & filtering.**

### Notes
- Rich notes with folders, tags, and full-text search.

### Diary
- Calendar + list of entries, optional password lock, and mood tagging.

### SilentBoy (creative writing mode)
- A distraction-free, pitch-black writing environment for poetry and lyrics.
- Mood tags (Sad / Reflective / Silent / Deep / Happy), serif/mono/typewriter font toggle, and chrome that fades away while you type.

### Focus Mode (study stopwatch)
- A **WebGL fluid shader** (raw GLSL, no libraries) fills a circular tank as you study — with caustics, specular crests, and a drain animation every hour.
- Stopwatch (counts up), per-subject study analytics by day, stars per hour studied, and manual H:M:S add/edit.
- Quick **TASKS / ANALYTICS / NOTES** buttons hug the timer's right edge — each tab's left corner is clipped to follow the circle's curve, with a glow that traces the cut shape on hover.

### Study Planner 📅
Built for A/L maths-stream students (Combined Maths, Physics, Chemistry, English):
- **Onboarding wizard** logs your school hours, sleep, and tuition classes — all fully editable afterward.
- **Free-time engine**: computes what's left of each day after your commitments, then splits it across subjects. **Weak subjects get a double share.**
- **Day-by-day breakdown** — per-day free time, a 7-day bar chart, and a live "studied vs planned" progress per subject.
- **One tap into Focus Mode** — "Start Focus Session" on any subject card jumps straight into the timer with that subject pre-selected.
- **Study reminders** — set a daily "study X at HH:mm" nudge; fires as an OS notification + in-app toast once per day.

### Quick Capture overlay ⚡
- Press **`Ctrl + Shift + X`** from **anywhere on your PC** — a glassmorphic overlay appears.
- Instantly capture a **Task** (with priority) or a **Note**. Press **`Enter`** to save, **`Esc`** or click away to dismiss.
- **Pin** the overlay to keep it open while you click around; drag it by its header to reposition anywhere.
- Captures land in the main app instantly, with a confirmation toast.

### Automation
- Launch `cmd` / `powershell` scripts natively from the Rust backend (bypasses execution policy with `-ExecutionPolicy Bypass`), with a `.ps1` path guard, edit support, and toast feedback.

### Data
- **Export / Import** a complete JSON backup (tasks, notes, diary, automation, settings) via a native dialog, with a browser-download fallback.
- Optional **auto-backup** path in Settings.

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Shift + X` | Open the **Quick Capture** overlay (works anywhere on your PC) |
| `Ctrl + K` | Command palette |
| `Enter` | Capture the current overlay item |
| `Esc` | Dismiss the overlay |

---

## 🚀 Getting started

### Prerequisites
- **Node.js 18+** and **npm**
- **Rust** (install via https://rustup.rs) — required by Tauri
- On Windows: the **WebView2 runtime** (preinstalled on Windows 10/11)

### Install & run

```bash
# 1. Install frontend dependencies
npm install

# 2. Run in development mode (launches the Vite dev server + Tauri window)
npm run tauri dev
```

### Build the final app (production)

```bash
# Type-check + bundle the frontend, then compile a release binary
npm run tauri build
```

The output lives in `src-tauri/target/release/`:
- **`thetodo.exe`** — the standalone executable (no console window; this is the one to use)
- `bundle/msi/TheToDo_2.0.0_x64_en-US.msi` — Windows installer

> **Note:** the file at `src-tauri/target/debug/thetodo.exe` is a **debug** build. It opens a console window and points at the dev server, so it appears blank when the dev server isn't running. Always use the **release** build above for daily use.

---

## 🎨 Tech stack

| Area | Technology |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (persisted to localStorage) |
| Animation | Framer Motion + raw WebGL/GLSL |
| Icons | Lucide React |
| Bundler | Vite |

---

## 📁 Project structure

```
thetodo/
├── src/
│   ├── components/
│   │   ├── common/       # Sidebar, modals, CommandPalette, QuickCaptureOverlay,
│   │   │                 # FocusWaterShader (WebGL), InAppToast, AutoBackup
│   │   ├── todo/         # ListView, KanbanView, MatrixView, TaskCard, TaskModal
│   │   ├── notes/        # NotesView, NoteTree, NoteEditor (TipTap), NoteModal
│   │   ├── diary/        # DiaryView, DiaryModal
│   │   ├── silentboy/    # SilentBoyView (immersive writing)
│   │   ├── planner/      # PlannerView + onboarding wizard (free-time engine)
│   │   ├── tags/         # TagsView (unified tag browser)
│   │   ├── automation/   # AutomationView (native script runner)
│   │   ├── settings/     # SettingsView, ImportExportView
│   │   └── analytics/    # DashboardView (stats)
│   ├── stores/           # Zustand stores (task, note, diary, focus, ui, …)
│   ├── lib/              # utils, backup (export/import)
│   └── types/            # Shared TypeScript types
├── src-tauri/
│   ├── src/main.rs       # Tauri commands, plugins, global shortcut
│   ├── capabilities/     # Permission sets (main + quick-capture windows)
│   └── tauri.conf.json   # Windows, bundle config
└── package.json
```

---

## 🛠️ How the Quick Capture overlay works

1. A second Tauri window (`quick-capture`) is declared in `tauri.conf.json` — frameless, transparent, always-on-top, and hidden on startup.
2. A **global shortcut** (`Ctrl+Shift+X`) is registered in Rust (`main.rs`) via `tauri-plugin-global-shortcut`, so it works even when the app is in the background.
3. The overlay loads the same frontend bundle under the `#/quick-capture` hash (`main.tsx` swaps in `QuickCaptureOverlay`).
4. On capture it emits a Tauri `quick-capture` event; the main window listens (`App.tsx`), writes to the task/note stores, and shows a confirmation toast.

---

## 🎯 Roadmap

1. Cloud sync
2. Mobile app (iOS/Android)
3. Collaboration features
4. Calendar integration

---

## 📄 License

MIT — see `LICENSE`.

Made with ❤️ for productive people everywhere.
