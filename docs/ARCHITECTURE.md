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
 │ src/registry  │ id → behaviour (declarative)       │ src/data       │  outbox · inbox · realtime hub · repos · storage
 │ src/assets    │ manifest: GLB/clips/sfx/music/…    └───────┬────────┘
 └───────────────┘                                            │  anon key + user JWT only
                                                     ┌────────▼─────────────────────────────┐
                                                     │ Supabase: Auth · Postgres+RLS · Storage│
                                                     │ (private buckets) · Realtime           │
                                                     └────────────────────────────────────────┘
```

## Layers and their rules

- **`domain/`** — pure TypeScript. No Vue, no network, no clock except passed in. This is where behaviour that must be *right* lives
  (mood→environment priority, garden layout, event validation, sync maths, date-jar draw) and where most unit tests are.
- **`data/`** — everything that talks to Supabase, plus the delivery machinery. Repositories map rows to domain types and turn failures
  into typed `AppError`s. `outbox.ts`, `inbox.ts` and `realtime.ts` are the multiplayer core.
- **`state/`** — small module-level reactive stores (`session`, `household`, `live`, `moods`, `notes`, `prefs`, `toasts`…). No Pinia: the
  surface is small and explicit.
- **`scene/`** — Three.js only. It reports *which registry id was selected* and is driven by plain data. It never imports a feature.
- **`features/`** — one folder per panel, lazy-loaded; each talks to `data/` through `useResource` (load + realtime refresh) and `useAction`
  (mutate, de-duplicate submits, friendly errors).

## Event lifecycle (Love Ping, hugs, spells, mischief, …)

```
sender UI ─▶ outbox.enqueue(kind, payload)         validate (same rules as the database) → persist in IndexedDB → try to send
          └▶ rpc send_event(client_event_id, …)    server: auth + household + partner, rate limit, sanitise payload, consent check,
                                                    idempotent insert, server created_at/expires_at, bond XP (daily-capped)
                    ▼ INSERT on public.events (RLS: only sender/recipient, only unexpired)
recipient ◀─ Realtime postgres_changes ─▶ inbox.receive ─▶ dispatcher (dedupe by id, order by server time, skip expired,
             flag "stale")  ─▶ handlers (effect + sound + toast + notification)  ─▶ rpc ack_events (seen_at)
offline recipient: nothing is lost — on (re)subscribe, on foreground and at start-up `inbox.catchUp()` fetches every unseen,
             unexpired event; old ones are summarised ("While you were away, Daniel sent 3 pings, 1 hug").
offline sender: the outbox keeps the item (same id) and retries with back-off in order; the server de-duplicates on the id.
```

Guarantees: **idempotent** (client id + unique constraint, client-side seen set), **ordered** (server timestamps), **expiring**
(`expires_at` clamped server-side, hidden from RLS once past, purged by cron), **consent-aware** (mischief refused unless the recipient opted in; re-checked on their device),
**bounded** (60 events/minute/sender, payload size and shape limits).

Durable content (notes, moods, plants, recipes, memories…) is ordinary tables with Realtime refresh; events are only *notifications* about it.
Ephemeral signals (partner presence, live heart pulse) use a private Realtime channel and are never stored.

## The 3D layer

- `SceneController` owns the `WebGLRenderer`, a render loop that **draws only when something changed** (camera, light, weather, highlight, animation),
  pauses when hidden or covered by a full-screen panel, caps frame rate on the low tier, scales pixel ratio and particle counts by quality,
  and disposes geometry/materials/textures/renderer/listeners on teardown.
- **Picking**: raycast against the registered objects; real geometry wins over padded invisible hit boxes. Taps vs drags vs pinches are separated.
- **Camera**: orthographic isometric rig with limited orbit, zoom, animated focus on an object, and a panel inset so the focused object stays visible
  above a bottom sheet or beside a side card. Reduced motion → instant.
- **Environment**: `deriveEnvironment()` (domain) turns both people's moods + time of day into weather, lamp, window light, fog and ambient loop;
  `LightingRig` and `WeatherSystem` ease toward it. Rain, stars, motes and hearts are single draw calls.
- **Accessibility**: the canvas is `aria-hidden`; every object is reachable from the keyboard/screen-reader "Go to…" list, with descriptions and unread counts.

## Database (supabase/migrations)

| File | Contents |
|---|---|
| `…01_foundation` | profiles, households (exactly two members), invites (hashed token, email-bound), user settings (notification + consent), bond state, membership helpers, `create_household` / `invite_partner` / `accept_invite` |
| `…02_events` | `events` + `send_event` / `ack_events` / `purge_expired_events`, payload sanitiser, consent, rate limit, XP |
| `…03_features` | moods + garden, date ideas, hidden notes, spell recipes, reaction presets |
| `…04_media` | tracks, playlists, listening consent + session (server-clock sync), memories, love notes, stickers, time-capsule items |
| `…05_storage_realtime` | private buckets + storage policies, realtime publication and channel policies |

Client code only ever sees the anon key and the signed-in user's JWT. Writes that must be atomic or must be stamped by the server go through
`SECURITY DEFINER` functions with a fixed `search_path`; everything else is column-restricted table access under RLS.
