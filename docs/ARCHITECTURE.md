# Architecture

```
                      ┌────────────── Vue 3 UI (src/screens, src/features, src/components) ──────────────┐
                      │  HomeScene ▸ ObjectNavigator ▸ PanelShell ▸ feature panels (code-split)          │
                      └───────▲───────────────────────────────▲──────────────────────────▲───────────────┘
                              │ reactive state                │ commands                  │ derived data
 ┌──────────────┐   select    │                       ┌───────┴────────┐          ┌──────┴────────┐
 │ src/scene    │───(by id)───┘                       │ src/state      │          │ src/domain    │ pure, tested
 │ Three.js     │◄── environment, rose, notes, garden │ live · session │          │ moods→weather │
 │ picking·rig  │                                     │ household · …  │          │ events·garden │
 └──────▲───────┘                                     └───────┬────────┘          │ sync maths    │
        │ node names = registry ids                           │                   └───────────────┘
 ┌──────┴────────┐                                    ┌───────▼────────┐
 │ src/registry  │ id → behaviour (declarative)       │ src/data       │  api · sync hub · outbox · inbox · repos · files
 │ src/assets    │ manifest: GLB/clips/sfx/music/…    └───────┬────────┘
 └───────────────┘                                            │  same-origin fetch, HttpOnly session cookie
                                                     ┌────────▼─────────────────────────────┐
                                                     │ server/  createApi(ctx): Request → Response │
                                                     │ router · auth · routes · Store         │
                                                     └───┬───────────┬───────────┬───────────┘
                                          Netlify Function   Vite dev middleware   Node server / tests
                                          (Netlify Blobs)    (./.data folder)      (folder / memory)
```

## Layers and their rules

- **`domain/`** — pure TypeScript. No Vue, no network, no clock except passed in. This is where behaviour that must be *right* lives
  (mood→environment priority, garden layout, event validation, sync maths, date-jar draw) and where most unit tests are.
  The event validators here are shared by the browser and the server, so both sides enforce the same rules.
- **`data/`** — everything that talks to the server, plus the delivery machinery. `api.ts` is the only door (same-origin, cookie
  session, anti-CSRF header). Repositories are thin typed wrappers. `sync.ts`, `outbox.ts` and `inbox.ts` are the multiplayer core.
- **`state/`** — small module-level reactive stores (`session`, `household`, `live`, `moods`, `notes`, `prefs`, `toasts`…). No Pinia.
- **`scene/`** — Three.js only. It reports *which registry id was selected* and is driven by plain data. It never imports a feature.
- **`features/`** — one folder per panel, lazy-loaded; each talks to `data/` through `useResource` (load + refresh when the partner changes
  something) and `useAction` (mutate, de-duplicate submits, friendly errors).
- **`server/`** — a pure `Request → Response` function (`createApi`). Because it touches nothing but a `Store` interface and a clock,
  the same code runs as a Netlify Function, inside `npm run dev`, as the standalone Node server, and directly in the tests.

## The Store

`server/store.ts` is a tiny key/value interface (`get`, `put`, `remove`, `list`, bytes) with two conditional writes:
`ifNew` (create only if absent) and `ifMatch` (compare-and-set on an etag). Everything that must not happen twice or concurrently
is built on those: idempotent events, the daily-capped bond XP, one-seed-per-day gardens, immutable Time Capsule items, the listening session.
Implementations: `MemoryStore` (tests), `FileStore` (dev and standalone; atomic temp-file + rename), `NetlifyStore` (Netlify Blobs, strong consistency).

## Event lifecycle (Love Ping, hugs, spells, mischief, …)

```
sender UI ─▶ outbox.enqueue(kind, payload)         validate (same rules as the server) → persist in IndexedDB → try to send
          └▶ POST /api/events {clientEventId, …}   server: auth + partner, rate limit, sanitise payload, consent check,
                                                    idempotency key written FIRST (carries the event, so a crash cannot lose it),
                                                    server timestamps, expiry, bond XP (daily-capped)
                    ▼ stored under events/<recipient>/… plus an "unseen" index entry
recipient ◀─ GET /api/sync (long-poll) returns it within ~1.5 s ─▶ inbox.receive ─▶ dispatcher (dedupe by id, order by server time,
             skip expired, flag "stale") ─▶ handlers (effect + sound + toast + notification) ─▶ POST /api/events/ack
offline recipient: nothing is lost — the first sync after reconnecting returns every unseen, unexpired event;
             old ones are summarised ("While you were away, Daniel sent 3 pings, 1 hug").
offline sender: the outbox keeps the item (same id) and retries with back-off in order; the server de-duplicates on the id.
```

Guarantees: **idempotent**, **ordered** (server timestamps), **expiring** (default per kind, clamped to 30 days, purged hourly),
**consent-aware** (mischief refused unless the recipient opted in; re-checked on their device), **bounded** (60 events/minute/sender,
payload size and shape limits).

## "Live" without WebSockets

Netlify Functions cannot hold a socket open, so the app long-polls. `GET /api/sync?hold=6&v=<versions>` waits up to 6 seconds on the
server, checking about every 1.5 s, and returns the moment something is new for the caller: an unseen event, a change in any watched
collection (each write bumps a version in `meta/versions`), or the partner's heart pulse. The first call returns immediately with
everything. After any failure the client backs off and retries; the next successful call is a full catch-up. A hidden tab polls only
every 30 s. The response also carries the server clock (for synchronised playback) and the partner's last-seen time (the "Vee is here" chip).

Durable content (notes, moods, plants, recipes, memories…) is ordinary stored records with the same refresh signal; events are only
*notifications* about it.

## Files

Uploads are chunked (3 MiB) because serverless request bodies are limited: `POST /files` → `PUT /files/:id/chunks/:n` →
`POST /files/:id/complete`. Completion checks the size, sniffs the magic bytes against the declared type, and records a server-computed SHA-256.
Reads are Range-aware, one chunk per response, so `<audio>` can seek and no response exceeds the function limit. Private vault files are
visible to the partner only when shared; Time Capsule files are served as `application/octet-stream` + `attachment` with a sandboxing CSP.

## The 3D layer

- `SceneController` owns the `WebGLRenderer`, a render loop that **draws only when something changed**, pauses when hidden or covered by a
  full-screen panel, caps frame rate on the low tier, scales pixel ratio and particle counts by quality, and disposes everything on teardown.
- **Picking**: raycast against the registered objects; real geometry wins over padded invisible hit boxes. Taps vs drags vs pinches are separated.
- **Camera**: orthographic isometric rig with limited orbit, zoom, animated focus on an object, and a panel inset. Reduced motion → instant.
- **Environment**: `deriveEnvironment()` (domain) turns both people's moods + time of day into weather, lamp, window light, fog and ambient loop.
- **Accessibility**: the canvas is `aria-hidden`; every object is reachable from the keyboard/screen-reader "Go to…" list.
