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
- **Visualizer Lab**: a separate window with 12 courses: the five sorting algorithms plus binary search, BFS, DFS, recursion, stacks and queues, linked lists and Big-O. Each pairs an interactive visualizer with a typing course: the lab shows ten lines at a time, you type them into your own file (no pasting, exact indentation), and the next ten unlock as soon as the current ten are correct. Finish the file and run it. Nothing in the lab affects XP.

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
