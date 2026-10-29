# Implementation report

## Verdict

**Not production-ready.** The app is complete as one offline HTML file and passes everything below, but it is single-device by design
(see LIMITATIONS 1), the 3D art is placeholder, and it has only been exercised in Chromium.

## What changed in this revision

The earlier versions depended on Supabase, then on a Netlify-hosted backend. Both are gone. The backend's rules (`server/`) now run
*inside the page*, over a store that lives in the browser's own IndexedDB. The result builds to a single `index.html`: no server, no
accounts, no cookies, no network requests, no device identification. The price is that two different devices cannot exchange messages.

## Second revision: ten additions

Backup and restore · postcards (a code that carries a message between two devices) · calendar with days-together and a celebration on the day · sealed notes · question of the day · our songs · photo wall in the room · seasons · mood history · SoundCloud entrance album (opt-in, the one use of the internet). Real room art was **not** done: it needs a Blender file that does not exist yet.

## What was built

| Brief | Delivered |
|---|---|
| Vue 3 · TS strict · Vite · Three.js · tokens | Yes. `strict` + `noUncheckedIndexedAccess`; tokens in `src/styles/tokens.css`; built into one file. |
| Interactive isometric house | Raycast picking, touch/mouse/pinch/wheel/keyboard, animated camera focus, highlighting, dynamic lighting, weather, unread-note beacons, reduced motion, 3 quality tiers. |
| Replaceable GLB assets; declarative registry; placeholders | `interactionRegistry.ts`, `manifest.ts`, placeholders for every object, per-object fallback. |
| Love Ping · Listening Together · Mood Garden · Date Jar · Hidden Notes · Mischief · Spell Table · Love Universe · Memory Vault · Time Capsule | All present (see README). |
| Two identities, persistent shared state, events, offline delivery, idempotency, timestamps, expiry, per-user settings | Two people chosen on the first screen; shared state persisted in the browser; outbox/inbox, idempotency keys, expiry, per-person settings. Across devices: **not possible** (see above). |
| Private originals preserved, not publicly exposed | Byte-exact, hash-verified, only in your private build; public build verified free of them. |
| Accessibility, tests, docs | Below. |

## Verification performed

| Check | Result |
|---|---|
| `vue-tsc` strict (app + tests + server code) | clean |
| Backend behaviour tests on the real handler (events, consent, idempotency, notes, files, capsule immutability, sync…) | **49 pass** |
| Browser SHA-1/SHA-256 equal Node's for edge-case sizes and awkward chunking | pass |
| Source guards: no network APIs, no device-identifying APIs, no external URLs in `src/` | pass |
| Backend tests for the additions: sealed notes (text withheld, reading refused, opens on the day, bad dates), question of the day (secret until both answer, locks after), dates (limits, validation), song hearts | **12 pass** |
| Unit tests for the additions: date maths (leap days, years, sorting), postcard codec (forgery, expiry, non-ASCII, unknown kinds), backups (round trip of 3 MB files, path tricks, damage), seasons (particles by season/time/rain), SoundCloud link checking and the player frame | **40 pass** |
| Whole suite (everything above plus the earlier tests) | **216 tests pass** |
| Public build: exactly one file (1.0 MB), none of your private content in it (searched raw and base64) | pass |
| Browser test, public build opened from `file://`: who-is-here screen, hand-over delivery, consent refusal, persistence, no cookies; calendar; question of the day (secret, then both); sealed note (no text, no Open button); postcards (own refused, delivered, repeat harmless, damage refused); photo wall; mood history; backup → erase → restore (and a non-backup refused); entrance album (bad link refused, frame with autoplay created, pause button, only `w.soundcloud.com` contacted); **nothing reaches the internet before a link is saved**; no console errors | **36 / 36** |
| Browser test, private build: the above plus both originals verified and rendering in the sandbox, original wording, room song, and an Our Song hearted by both | **43 / 43** |
| axe-core WCAG 2.x A/AA on the picker, home, note reveal and all panels including the new ones (private build, with a track present) | **0 violations** (automated only) |
| Scripted keyboard-only pass over all 13 panels: opens from the menu, Escape closes, focus returns to the menu button | clean after fixing one real bug (focus was lost when a panel closed). Remaining notes: native date-picker icon and the Love Universe heart's glow-style focus indicator |

## Not verified in this revision

The SoundCloud player against the real SoundCloud (the environment it was built in cannot reach it). See LIMITATIONS 11.

## Files you should know about

`docs/SETUP.md` · `docs/LIMITATIONS.md` · `docs/SECURITY.md` · `docs/ARCHITECTURE.md` · `docs/ASSET_SPEC.md` · `src/local/` · `server/`.
