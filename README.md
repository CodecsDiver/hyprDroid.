# hyprDroid.
hyprland on Android

---

# Python Discovery

A local-first, gamified Python learning editor for Linux. You write every line (no autocomplete). Objectives are verified by real unittest runs, and only verified objectives earn XP. Python runs locally, contained with `bubblewrap` when available.

Tauri 2 (Rust) + Vue 3 + TypeScript + Monaco.

## What is in it

- **Missions**: five projects, three objectives each, checked with `unittest`. Save, Run and Check my work all work in the desktop app and the PWA.
- **XP rules**: XP is paid only for finished, verified work: an objective whose tests pass, and a completed project (harder projects pay more). Typing, saving and running never give XP, so a level-up always means the code was correct. Activity trophies (first run, save streak, typing combo) give no XP.
- **Game layer**: combo meter, keystroke particles, objective/quest/trophy banners, screen shake, synthesized sound, and level-up screens that escalate: normal levels, every 5th level, new ranks, every 10th level (milestone), every 25th (legendary), each bigger, louder and longer than the last.
- **App chrome**: File / Edit / View / Run / Go / Help menus, a command palette (F1 or Ctrl+Shift+P; Ctrl+Shift+P may be reserved by Firefox), keyboard shortcuts (Help > Keyboard shortcuts), **multiple files per mission** (File > New file, Ctrl+Alt+N; tabs, rename, delete; `main.py` is protected because the checks import it; files can import each other), import/export of `.py` files, editor zoom, and resizable, hideable panels (drag the glowing bars; double-click a bar to reset).
- **Free Code**: an open workspace at the top of the Missions panel. Make up to 20 files, import one from another, rename or delete any of them except `main.py` (the entry file), run any file. **Visualize** (Run menu or the button next to Run) runs your program under a tracer and animates the first list of numbers it changes, so your own sorting code plays back whatever it is called.
- **Three strikes**: every failed *Check my work* on a mission is a strike (running code never counts). On the third, the full solution opens in its own window, every function, variable and block commented with what it does, why, and how. Hints stay. A cleared mission keeps its Solution button.
- **Ghostcode**: your active typing time (breaks over 15 s barely count) is recorded for missions and lab courses. Your fastest run is the ghost. Cleared missions and finished courses can be replayed against it (3-2-1-GO, then a ghost types beside you, with a split bar). A replay only replaces the ghost if it is faster. Replays give no XP.
- **Typscryption** (title bar, or Go > Typscryption, Ctrl+Alt+Y): three placement questions (how long you have coded, which sentence sounds like you, how fast you type) put you in one of three libraries, Sprout, Builder or Climber, and one of nine levels from True Beginner to Advancing Learner. Then race a bot at your level: *Guess the next line*, *Fix this block*, and *Speed Coder* (whole block, live timer, glowing shimmering lines, and a pace check against the average for your level). Win two matches in a row to move up a level, lose two to move down. All bot times are estimates kept in `src/typscryption/levels.ts`.
- **Visualizer Lab** (a separate window): the **Beginner Deep End** (the original 12: five sorts, binary search, BFS, DFS, recursion, stack and queue, linked list, Big-O) and **Bigger Algorithms** (heap sort, A*, Dijkstra, topological sort, longest common subsequence, knapsack, coin change, N-Queens). Each pairs an interactive visualizer with a typing course: ten lines at a time, no pasting, exact indentation, the next ten unlock when the current ten are correct. For the sorts, Run & check plays what **your own code** did. Nothing in the lab affects XP.
- **Theme editor** (View > Theme editor, Ctrl+Alt+T, or the Theme button): every colour, the three fonts, corner cuts, panel opacity and glow size are tokens you can change live, including the code editor's syntax colours, the XP bar and combo tiers, the title and menu bars and the visualizer walls and curves; particle and level-up hues follow your accents. Click "Click the app to edit a part" and then any part of the window to see only the settings for it. Presets, named saved themes, and import/export (share link, JSON, CSS variables). The theme is shared live between the main window and the Visualizer Lab.
- **Colour Theme Park link**: "Open the site" opens https://colorthemepark.netlify.app; paste what you make there (a share link, JSON, CSS variables or a list of hex colours) and the importer maps it onto the app. The mapping of that site's own export format is best-effort, because it could not be inspected when this was written.

## Install as a PWA

The same app runs in any modern browser and installs as a standalone app (Chrome/Edge: install icon in the address bar; Firefox/Safari: add to home screen/dock). After the first visit it works fully offline.

```
pnpm build:web       # outputs dist-web/ (app, manifest, service worker, bundled Pyodide ~17 MB)
pnpm preview:web     # serves it on http://localhost:4173
```

Host `dist-web/` on any static server. Service workers need HTTPS (or localhost), and `.wasm` must be served as `application/wasm`. In the PWA, Python runs as WebAssembly (Pyodide) in a Web Worker: no network, 10 s limit (the worker is terminated on timeout), output capped at 64 KB. Files and progress are stored in the browser (localStorage), so clearing site data erases them; the desktop app keeps everything on disk.

## Develop

```
pnpm install
pnpm test          # engine, curriculum (real python3 and Pyodide), lab courses, commands, visualizer algorithms
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri dev     # desktop app
pnpm tauri build --bundles deb
```

`pnpm dev` alone (browser) uses the same web runtime as the PWA.

Linux Mint / Ubuntu build dependencies: `libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libayatana-appindicator3-dev`. Runtime: `python3`, recommended `bubblewrap`.

## Safety model

- Nothing executes until you press Run or Check my work.
- PWA: Python runs in WebAssembly with the network APIs removed from its worker. As in the desktop app, this is not a security boundary against a determined student.
- With bubblewrap: no network, read-only system, only the project directory writable, 10 s wall-clock limit, output capped at 64 KB, CPU/file-size/memory limits.
- Without bubblewrap: you must explicitly approve each unsandboxed run, and the output panel labels it.
- Objective results come back as a nonce-tagged line. This protects against accidents, not a student deliberately forging their own XP: this is not a security boundary.

## Data

App data directory (`~/.local/share/dev.pythondiscovery.app/`): `progression.json`, `settings.json`, `projects/<id>/main.py`. All writes are atomic (temp file then rename).
