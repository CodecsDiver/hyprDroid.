# Signal Home

A private, cozy shared home for two people — **Daniel and Vee**. It rebuilds two earlier prototypes
(*Signal Home* and *Our Little Love Universe*) into one cohesive, real-time, installable web app.

The landing screen opens straight into an interactive isometric house. Tap the rose to send a love ping,
the guitar to listen together, the window to tend the mood garden, the heart for the Love Universe — and so on.

| | |
|---|---|
| Stack | Vue 3 (Composition API) · TypeScript strict · Vite · Three.js · Supabase · CSS design tokens · PWA |
| Runtime dependencies | `vue`, `three`, `@supabase/supabase-js` (nothing else) |
| Backend | Supabase Auth, Postgres + Row Level Security, Storage (private buckets), Realtime |

> **Status — read before calling it done.** Everything below the 3D layer is real and tested. The 3D room itself
> is **placeholder geometry**: the final Blender environment, final sound effects and mood-loop audio have not been
> provided, and the app says so on screen. See [docs/REPORT.md](docs/REPORT.md) for exactly what is verified and
> what is not, and [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the open items.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL + ANON key (never the service-role key)
npm run dev
```

Without `.env.local` the app opens a "needs a backend" screen. A **backend-free 3D preview** is available in
development at `http://localhost:5173/#/scene-preview` (placeholder room, demo data, no accounts).

Full backend setup (Auth, migrations, storage, realtime, deployment): **[docs/SETUP.md](docs/SETUP.md)**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `vue-tsc` in strict mode for the app and for tests |
| `npm test` | 205 tests: 92 database tests on real Postgres (PGlite) — 83 security + 9 client↔schema contract — and 113 unit tests |
| `npm run build` | Typecheck + production build |
| `npm run verify` | Typecheck + tests + build + **dist safety check** (no private files, no secrets) |
| `npm run serve:dist` | Serve `dist/` with the real security headers (CSP) applied |
| `npm run assets:extract` | Pull the private originals/art/song/notes out of your two HTML files into `./private` |
| `npm run assets:upload` | Load that private content into your Supabase project (service-role key, run locally) |

## The features

- **Love Ping** — private real-time hearts, kisses, hugs, comfort, goodnight, and your own custom reactions. The shared rose grows with them.
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
src/data/        Supabase access, outbox (durable queue), inbox (exactly-once), realtime hub
src/scene/       Three.js: picking, camera rig, weather, lighting, GLB loader, placeholders
src/registry/    interactionRegistry.ts — Blender object id → behaviour (declarative)
src/assets/      manifest.ts — every replaceable asset (GLB, clips, sfx, music, textures, images)
src/features/    one folder per feature panel (code-split)
supabase/        migrations (schema + RLS + RPCs + storage + realtime) and the test shim
scripts/         private-content extract/upload, dist verification, header-aware preview server
tests/           db (RLS on real Postgres) · unit · e2e (browser smoke test, optional)
docs/            setup, architecture, asset spec, security, limitations, report
```

## ⚠ This repository is public

Your two original HTML files, the sticker artwork, the room song and the written notes are personal. They are **never
committed**: `./private/` is gitignored, a test fails if anything under it is tracked, and `npm run verify` fails the
build if any private file (even renamed) would be published. They live only in *private* Supabase buckets and tables,
readable by the two of you. If you would rather the nicknames in the mood labels (`src/domain/moods.ts`) were not in
a public repo either, make the repository private.
