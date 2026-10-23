# Implementation report

## Verdict

**Not production-ready yet.** The application architecture, all ten feature interfaces, the live/offline machinery, the security model and the
Time Capsule are implemented and verified to the extent listed below, including two real browsers talking through the real server.
It has **not** been deployed to Netlify or run on real devices, and the 3D art is placeholder. Do the two-device test on your deployed
site (LIMITATIONS 9–12) before relying on it.

## What changed in this revision

The first version depended on Supabase. That dependency is **gone**: the backend is now part of this repository (`server/`), needs no
external service or account, and runs as a Netlify Function, inside `npm run dev`, or as a plain Node server. Real-time delivery is
long-polling instead of a websocket (see ARCHITECTURE.md).

## What was built

| Brief | Delivered |
|---|---|
| Vue 3 · TS strict · Vite · Three.js · tokens · PWA | Yes. `strict` + `noUncheckedIndexedAccess`; tokens in `src/styles/tokens.css`; manifest, service worker, offline page, installable. Browser runtime deps: `vue`, `three`. |
| Interactive isometric house | Raycast picking (real geometry beats hit boxes), touch/mouse/pinch/wheel/keyboard, animated camera focus with panel inset, hover/focus/selected highlighting, dynamic lighting, rain/stars/motes/hearts weather, unread-note beacons, reduced motion, 3 quality tiers. |
| Replaceable GLB assets; declarative registry; placeholders | `interactionRegistry.ts` maps Blender ids → behaviour; manifest covers GLB, per-object GLB, clips, sfx, mood loops, textures, UI images; placeholders for every object; failures degrade per object. |
| Love Ping | Live, offline-safe; 8 built-in reactions + custom reactions; messages; shared rose growth; history. |
| Listening Together | Own songs, playlists (reorder), cover art, Media Session; server-clock-synchronised playback with drift correction **only while both opted in**. |
| Mood Garden | 10 moods (the original six + four) → weather; one seed/person/day; watering; persisted; deterministic layout; SVG + 3D planter. |
| Date Jar | Add, weighted random draw by category, favourites, complete with note/rating, starter ideas. |
| Hidden Notes | Pinned to objects, unread envelopes, offline delivery, 5 reveal styles, "open when…", author sees read state. |
| Mischief Mode | 9 effects; opt-in + second opt-in for disruptive; pause switch; always-visible stop; Esc cancels; consent enforced server-side **and** on-device. |
| Vee's Spell Table | Recipes (ingredients, effect, colour, whisper), 6 magical effects, cast/preview, reactions, themed palette. |
| Love Universe | Rebuilt heart, hugs, sparkles, bubbles, floating words, shooting stars, original synth sounds, sticker sheet **and custom stickers**, hearts-synced detection, notes, offline delivery. Original wording kept. |
| Memory Vault | Photos (resized, EXIF-stripped), recorded voice messages, notes, milestones; private-to-author option. |
| Time Capsule | Both originals byte-for-byte, SHA-256 verified, isolated sandbox, kept out of git and the bundle. |
| Two identities, persistent shared state, live events, offline delivery, idempotency, server timestamps, expiry, per-user notification settings | Two fixed accounts, cookie sessions, folder/Blobs-backed store with conditional writes, long-poll sync, outbox/inbox, idempotency keys, TTLs, per-user settings. |
| Quality | Accessible UI, semantic HTML, safe areas, error boundaries, validation, loading/offline states, cleanup of GL/audio/timers/mic. |

## Verification performed

| Check | Result |
|---|---|
| `vue-tsc` strict (app + tests + server) | clean |
| API security & behaviour tests against the real handler (auth, lockout, CSRF, events, consent, idempotency, notes, files, capsule immutability, sync) | **49 tests pass** |
| Client ↔ server contract: every API call in `src/` is matched to a real route and method; every watched collection is one the server bumps | **4 tests pass** |
| Unit tests (domain, outbox, inbox, dispatcher, registry, manifest, scene math/picking, headers, integrity, private-asset scripts, secrets scan) | **108 tests pass** |
| Production build; `verify-dist` (no private files, no secrets, required files, same-origin-only CSP) | pass |
| Two-browser end-to-end test against the **real standalone server**: sign-in and cookie flags, live delivery, no replay after reload, offline receive, offline send → queued → delivered, two-way Date Jar sync, garden, consent refusal and persistence, upload script (and its re-run), Time Capsule (both originals render in the sandbox, inert download headers, anonymous access refused), sign-out, mobile layout | **34 / 34 checks** |
| `npm run dev` serves the API through the Vite middleware; both Netlify functions bundle with esbuild | confirmed |
| axe-core WCAG 2.x A/AA on sign-in, home, note reveal and all 11 panels (against the real server) | **0 violations** (automated only) |

The 49 + 4 + 108 = **161** automated tests run with `npm test`. The browser test is optional (`npm run test:e2e`; needs Playwright, which is not a project dependency).

## Files you should know about

`docs/SETUP.md` (do this first) · `docs/ASSET_SPEC.md` (what to hand your Blender artist) · `docs/SECURITY.md` · `docs/LIMITATIONS.md` ·
`docs/ARCHITECTURE.md` · `server/` · `src/registry/interactionRegistry.ts` · `src/assets/manifest.ts`.
