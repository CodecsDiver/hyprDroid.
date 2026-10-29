# Signal Home

A private, cozy home for two people — **Daniel and Vee** — as **one HTML file**. It rebuilds two earlier prototypes
(*Signal Home* and *Our Little Love Universe*) into one app: an interactive isometric house where the rose sends love
pings, the guitar plays music, the window grows a mood garden, the heart opens the Love Universe, and so on.

| | |
|---|---|
| Stack | Vue 3 (Composition API) · TypeScript strict · Vite · Three.js · CSS design tokens |
| Shape | One self-contained `index.html` (~1 MB). Open it from disk or host it anywhere static. |
| Storage | **Only this browser's own storage** (IndexedDB), the same place a web page keeps its cache. Nothing is sent anywhere, with one opt-in exception: an entrance album you link from SoundCloud. |
| Accounts / devices | None. No sign-in, no cookies, no device ids, no fingerprinting. The first screen just asks "Who is here?" and forgets the answer when the page closes. |

> **Read this first: one browser = one home.** With no server there is nothing to carry a message from your phone to
> Vee's phone. Daniel and Vee share *one browser on one device*: Daniel sends a ping, taps *Switch person*, and it is
> waiting for Vee. Different devices each keep their own separate home. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
>
> The 3D room is still **placeholder geometry** (no Blender art was supplied) and the app says so on screen.

## Use it

```bash
npm install
npm run build          # → dist/index.html  (public build: no personal content)
```

Open `dist/index.html` in a browser. To try it while editing: `npm run dev`.

### Your private copy (with your originals)

The two original apps, the sticker sheet, the room song and your written notes are personal, so they are never in the repo.

```bash
npm run assets:extract -- path/to/index1.html path/to/index2.html   # writes ./private (git ignores it)
npm run build:private                                               # → private/signal-home.html (~17 MB)
```

Open `private/signal-home.html`. On first open it loads everything into the browser's storage (about two seconds).
**Do not publish that file.** More in [docs/SETUP.md](docs/SETUP.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + build the single public `dist/index.html` |
| `npm run build:private` | Build your private copy with your originals inside |
| `npm run verify` | Typecheck + tests + build + **dist safety check** (no private content, no network calls) |
| `npm test` | 216 tests (backend behaviour incl. sealed notes / daily question / dates, SHA, backups, postcards, seasons, SoundCloud link checks, "no network / no device ids" source guards, domain, scene) |
| `npm run test:e2e` | Opens the built file from disk in a real browser (needs Playwright; see the file header) |
| `npm run assets:extract` | Pull the private originals/art/song/notes out of your two HTML files into `./private` |

## The features

- **Love Ping** — hearts, kisses, hugs, comfort, goodnight, and your own custom reactions. The shared rose grows with them.
- **Listening Together** — your own songs, playlists, cover art; synchronised playback only while *both* opt in.
- **Mood Garden** — both moods shape the room's weather; each day's first mood plants a seed; watering grows it; it persists.
- **Date Jar** — add, draw at random, favourite, complete with a note and rating.
- **Hidden Notes** — private notes pinned to objects, unread envelopes floating over them, reveal animations.
- **Mischief Mode** — playful surprises that only work after the recipient opts in (disruptive ones need a second opt-in; always stoppable).
- **Vee's Spell Table** — brew spells, save recipes, cast effects at each other, react.
- **Love Universe** — the original heart rebuilt: notes, hugs, sparkles, stickers (including your own).
- **Memory Vault** — private photos, voice messages, notes and milestones.
- **Time Capsule** — the two original apps, kept byte-for-byte and verified by SHA-256, in an isolated sandbox with no internet access unless you switch it on.
- **Calendar** — anniversaries, birthdays, countdowns and milestones; "days together"; the room celebrates on the day.
- **Question of the day** — one question each day for both of you; each answer stays secret until you have both answered; past days are kept.
- **Postbox** — "postcards": a short code (or link) that carries a heart, kiss or hug from one device's copy to the other's, with no server. Importing the same one twice does nothing.
- **Sealed notes** — Hidden Notes can be sealed until a date; until then the text is not even in the data the other person's side receives.
- **Our songs** — heart a song; when you both do, it becomes an Our Song.
- **Photo wall** — your shared Vault photos hang in frames on the back wall.
- **Seasons** — snow in winter, blossom in spring, fireflies on summer evenings, falling leaves in autumn, from the real date.
- **Mood history** — the Mood Garden keeps a four-week grid of the moods you each chose.
- **Backup** — save everything to one file and restore it (browser storage can be cleared).
- **Entrance album** — paste a SoundCloud link in Settings and it plays when you come in.

## Where things live

```
src/domain/      pure logic (moods→environment, garden, events, sync maths…) — no Vue, no I/O
src/local/       the in-page backend: browser store (IndexedDB), SHA, startup, first-run seeding
server/          the backend's request handling (router, rules, routes) — runs inside the page, and on Node in tests
src/data/        API client, outbox/inbox, repositories
src/scene/       Three.js: picking, camera rig, weather, lighting, GLB loader, placeholders
src/registry/    interactionRegistry.ts — Blender object id → behaviour (declarative)
src/assets/      manifest.ts — every replaceable asset
src/features/    one folder per feature panel
scripts/         extract, private build, dist verification
tests/           api · unit · e2e (optional)
docs/            setup, architecture, asset spec, security, limitations, report
```

## ⚠ This repository is public

Your originals, sticker art, song and notes are **never committed**: `./private/` is gitignored, a test fails if anything
under it is tracked, and `npm run verify` fails if any of it (even re-encoded) appears in the public build. If you would
rather the nicknames in the mood labels (`src/domain/moods.ts`) were not in a public repo, make the repository private.
