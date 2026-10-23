# hyprDroid.
hyprland on Android

---

# Python Discovery

A local-first, gamified Python learning editor for Linux. You write every line (no autocomplete). Objectives are verified by real unittest runs, and only verified objectives earn XP. Python runs locally, contained with `bubblewrap` when available.

Tauri 2 (Rust) + Vue 3 + TypeScript + Monaco.

## What is in it

- **Missions**: five projects, three objectives each, checked with `unittest`. Save, Run and Check my work all go through the Rust backend.
- **Game layer**: combo meter, keystroke particles, objective/quest/trophy banners, screen shake, synthesized sound, and a full-screen level-up sequence. The XP bar always derives level and fill from total XP, and climbs through every level.
- **Lesson Lab**: a separate window with seven interactive visualizers (sorting x5, binary search, BFS/DFS pathfinding, recursion tree, stacks and queues, linked lists, Big-O growth). Finishing a visualizer earns XP in the main window.
- **Settings**: animation intensity (off/low/medium/high), sound, screen shake, focus mode (dims side panels).

## Develop

```
pnpm install
pnpm test          # frontend tests (engine, curriculum against real python3, visualizer algorithms)
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri dev     # desktop app
pnpm tauri build --bundles deb
```

Linux Mint / Ubuntu build dependencies: `libwebkit2gtk-4.1-dev build-essential libssl-dev librsvg2-dev libayatana-appindicator3-dev`. Runtime: `python3`, recommended `bubblewrap`.

`pnpm dev` alone opens a browser preview: progress and files use browser storage, and running Python is deliberately unavailable there.

## Safety model

- Nothing executes until you press Run or Check my work.
- With bubblewrap: no network, read-only system, only the project directory writable, 10 s wall-clock limit, output capped at 64 KB, CPU/file-size/memory limits.
- Without bubblewrap: you must explicitly approve each unsandboxed run, and the output panel labels it.
- Objective results come back as a nonce-tagged line. This protects against accidents, not a student deliberately forging their own XP: this is not a security boundary.

## Data

App data directory (`~/.local/share/dev.pythondiscovery.app/`): `progression.json`, `settings.json`, `projects/<id>/main.py`. All writes are atomic (temp file then rename).
