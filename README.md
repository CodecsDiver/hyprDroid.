# Signal Home

A private, cozy shared home for two people — **Daniel and Vee**. It rebuilds two earlier prototypes
(*Signal Home* and *Our Little Love Universe*) into one cohesive, live, installable web app.

The landing screen opens straight into an interactive isometric house. Tap the rose to send a love ping,
the guitar to listen together, the window to tend the mood garden, the heart for the Love Universe — and so on.

| | |
|---|---|
| Stack | Vue 3 (Composition API) · TypeScript strict · Vite · Three.js · CSS design tokens · PWA |
| Runtime dependencies | `vue`, `three` in the browser · `@netlify/blobs` on Netlify only |
| Backend | **Built in.** One small API (`server/`) that runs as a Netlify Function, inside `npm run dev`, or as a plain Node server. No database, no third-party service, no account anywhere. |

> **Status — read before calling it done.** Everything below the 3D layer is real and tested, including two real browsers
> talking through the real server. The 3D room itself is **placeholder geometry**: the final Blender environment, sound
> effects and mood-loop audio have not been provided, and the app says so on screen. The Netlify deployment path has **not**
> been run on Netlify itself. See [docs/REPORT.md](docs/REPORT.md) for exactly what is verified and what is not, and
> [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the open items.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 — sign in as  daniel / dev   or   vee / dev
```

That is all. `npm run dev` runs the API in the same process and keeps its data in `./.data`. Open it in two browser
windows (one per person) to see everything work live. A backend-free 3D preview is at `http://localhost:5173/#/scene-preview`.

## Put it online (Netlify)

1. `npm run setup:auth` — asks for the two names and passwords, prints three values.
2. Netlify → your site → *Site configuration → Environment variables*: add `SIGNAL_USERS`, `SIGNAL_SESSION_SECRET`, `SIGNAL_ADMIN_TOKEN`.
3. Deploy (connect the repo; `netlify.toml` already says how to build).

Or run it on any machine with Node: `npm run build && npm run build:standalone && npm start`.
Step by step, including loading your private originals: **[docs/SETUP.md](docs/SETUP.md)**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server **with the API built in** (dev users `daniel` / `vee`, password `dev`) |
| `npm run typecheck` | `vue-tsc` in strict mode for the app, the tests and the server |
| `npm test` | 161 tests: 49 API security/behaviour tests against the real handler, 4 client↔server contract tests, 108 unit tests |
| `npm run build` | Typecheck + production build |
| `npm run verify` | Typecheck + tests + build + **dist safety check** (no private files, no secrets) |
| `npm run setup:auth` | Create the two accounts and secrets for a real deployment |
| `npm run build:standalone` / `npm start` | Build and run the self-contained Node server (serves the app and the API) |
| `npm run test:e2e` | Two-browser end-to-end test against the real server (needs Playwright; see the file header) |
| `npm run assets:extract` | Pull the private originals/art/song/notes out of your two HTML files into `./private` |
| `npm run assets:upload` | Load that private content into your running app through its own API |

## The features

- **Love Ping** — private live hearts, kisses, hugs, comfort, goodnight, and your own custom reactions. The shared rose grows with them.
- **Listening Together** — your own songs, playlists, cover art; synchronised playback only while *both* of you opt in.
- **Mood Garden** — both moods shape the room's weather; each day's first mood plants a seed; watering grows it; it persists.
- **Date Jar** — add, draw at random, favourite, complete with a note and rating.
- **Hidden Notes** — private notes pinned to objects, unread envelopes floating over them, delivery while offline, reveal animations.
- **Mischief Mode** — playful surprises that only work after the recipient opts in (disruptive ones need a second opt-in; always stoppable).
- **Vee's Spell Table** — brew spells, save recipes, cast effects at each other, react.
- **Love Universe** — the original heart rebuilt: notes, hugs, sparkles, stickers (including your own), synchronised hearts.
- **Memory Vault** — private photos, voice messages, notes and milestones.
- **Time Capsule** — the two original apps, kept byte-for-byte and verified by SHA-256, in an isolated sandbox.

## Where things live

```
src/domain/      pure logic (moods→environment, garden, events, sync maths…) — no Vue, no network
src/data/        API client, long-poll sync hub, outbox (durable queue), inbox (exactly-once), repositories
src/scene/       Three.js: picking, camera rig, weather, lighting, GLB loader, placeholders
src/registry/    interactionRegistry.ts — Blender object id → behaviour (declarative)
src/assets/      manifest.ts — every replaceable asset (GLB, clips, sfx, music, textures, images)
src/features/    one folder per feature panel (code-split)
src/shared/      wire types shared by browser and server
server/          the backend: router, auth, store, routes — pure Request → Response
netlify/         the Netlify Function entry points
scripts/         setup:auth, private-content extract/upload, dist verification, standalone build
tests/           api (security + contract on the real handler) · unit · e2e (two real browsers, optional)
docs/            setup, architecture, asset spec, security, limitations, report
```

## ⚠ This repository is public

Your two original HTML files, the sticker artwork, the room song and the written notes are personal. They are **never
committed**: `./private/` is gitignored, a test fails if anything under it is tracked, and `npm run verify` fails the
build if any private file (even renamed) would be published. They live only in your app's private storage, readable
by the two of you after signing in. If you would rather the nicknames in the mood labels (`src/domain/moods.ts`) were
not in a public repo either, make the repository private.
