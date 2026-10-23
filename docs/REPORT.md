# Implementation report

## Verdict

**Not production-ready yet.** The application architecture, all ten feature interfaces, the real-time/offline machinery, the security model and the
Time Capsule are implemented and verified to the extent listed below. It has **not** been run against a hosted Supabase project or on real devices,
and the 3D art is placeholder. Do the two-device test on a real project (LIMITATIONS 10–13) before relying on it.

## What was built

| Brief | Delivered |
|---|---|
| Vue 3 · TS strict · Vite · Three.js · Supabase · tokens · PWA | Yes. `strict` + `noUncheckedIndexedAccess`; tokens in `src/styles/tokens.css`; manifest, service worker, offline page, installable. Runtime deps: `vue`, `three`, `@supabase/supabase-js` only. |
| Interactive isometric house | Raycast picking (real geometry beats hit boxes), touch/mouse/pinch/wheel/keyboard, animated camera focus with panel inset, hover/focus/selected highlighting, dynamic lighting, rain/stars/motes/hearts weather, unread-note beacons, reduced motion, 3 quality tiers. |
| Replaceable GLB assets; declarative registry; placeholders | `interactionRegistry.ts` maps Blender ids → behaviour; manifest covers GLB, per-object GLB, clips, sfx, mood loops, textures, UI images; placeholders for every object; failures degrade per object. |
| Love Ping | Real-time, offline-safe; 8 built-in reactions + custom reactions; messages; shared rose growth; history. |
| Listening Together | Own songs, playlists (reorder), cover art, Media Session; server-clock-synchronised playback with drift correction **only while both opted in**. |
| Mood Garden | 10 moods (the original six + four) → weather; one seed/person/day; watering; persisted; deterministic layout; SVG + 3D planter. |
| Date Jar | Add, weighted random draw by category, favourites, complete with note/rating, starter ideas. |
| Hidden Notes | Pinned to objects, unread envelopes, offline delivery, 5 reveal styles, "open when…", author sees read state. |
| Mischief Mode | 9 effects; opt-in + second opt-in for disruptive; pause switch; always-visible stop; Esc cancels; consent enforced server-side **and** on-device; reduced-motion suppresses disruptive motion. |
| Vee's Spell Table | Recipes (ingredients, effect, colour, whisper), 6 magical effects, cast/preview, reactions, themed palette. |
| Love Universe | Rebuilt heart, hugs, sparkles, bubbles, floating words, shooting stars, original synth sounds, sticker sheet **and custom stickers**, hearts-synced detection, notes, offline delivery. Original wording kept. |
| Memory Vault | Photos (resized, EXIF-stripped), recorded voice messages, notes, milestones; private-to-author option. |
| Time Capsule | Both originals byte-for-byte, SHA-256 verified, isolated sandbox, kept out of git and the bundle. |
| Multiplayer architecture | Two identities, explicit invite-based household, RLS, persistent state, realtime events, offline delivery, connection recovery, idempotency, server timestamps, expiry, per-user notification settings. |
| Quality | Accessible UI, semantic HTML, safe areas, error boundaries, validation, loading/offline states, cleanup of GL/audio/timers/mic. |

## Verification performed

| Check | Result |
|---|---|
| `vue-tsc` strict (app + tests) | clean |
| Database security & behaviour on real Postgres (PGlite), under `anon` / `authenticated` roles | **83 tests pass** |
| Client ↔ database contract: every table, column, privilege and RPC argument name the client uses is checked against the migrated schema (proven to catch injected typos) | **9 tests pass** |
| Unit tests (domain, outbox, inbox, dispatcher, registry, manifest, scene math/picking, headers, integrity, private-asset scripts) | **113 tests pass** |
| Production build; `verify-dist` (no private files, no secrets, required files, CSP) | pass; verifier shown to fail on a planted leak |
| Browser smoke test of the production build **under its real CSP**, against a stubbed backend: sign-in, every panel, realtime delivery, ack, offline queue → flush, consent, Time Capsule (both originals render; tampered archive refused), mobile layout | **44 / 44 checks** |
| axe-core WCAG 2.x A/AA on sign-in, home, note reveal and all 11 panels | **0 violations** (automated only) |

The 83 + 9 + 113 = **205** automated tests run with `npm test`. The browser smoke test is optional (`tests/e2e/smoke.mjs`; needs Playwright, which is not a project dependency).

## Files you should know about

`docs/SETUP.md` (do this first) · `docs/ASSET_SPEC.md` (what to hand your Blender artist) · `docs/SECURITY.md` · `docs/LIMITATIONS.md` ·
`docs/ARCHITECTURE.md` · `supabase/migrations/*` · `src/registry/interactionRegistry.ts` · `src/assets/manifest.ts`.
