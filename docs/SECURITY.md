# Security and privacy

## Threat model

Two people sharing one browser. There is no server, no account and no network traffic, so the things that matter are:
**nothing leaves the page; the page does not identify or remember a device; private personal content never ends up in the public
repository or the public build; the archived legacy pages cannot touch the app.**

## Controls, and how each is verified

| Control | Where it is enforced | Verified by |
|---|---|---|
| The app makes no network requests (no `fetch`, XHR, WebSocket, beacon, EventSource, external URLs), **except** the optional SoundCloud entrance player | the source; a policy blocks the archived originals unless you opt in | unit test scans all of `src/` and allows one file to name one host; browser test records every request while using the file and shows none until a link is saved, then only `w.soundcloud.com` |
| No device identification: no user-agent/platform/plugin reads, no device ids, no canvas fingerprinting, no cookies | the source | unit test scans `src/`; browser test checks the cookie jar is empty |
| Nothing remembered about who you are: "Who is here?" is asked every time the page opens | `src/state/session.ts` | browser test (reload → asked again) |
| Everything stored lives only in this browser's IndexedDB; one button erases all of it | `src/local/localStore.ts`, `backend.ts` | browser test (erase → data gone) |
| Rules still enforced in-page: events are idempotent, expiring, rate-limited and sanitised; mischief needs the recipient's opt-in (disruptive ones a second); hidden notes and private memories visible only to the right person | `server/` | 49 backend tests on the real handler; unit tests; browser test (mischief refused) |
| Files: type allow-list, size limits, magic-byte sniff, SHA-256, SVG refused | `server/routes/files.ts` | backend tests; unit tests |
| Time Capsule: items are immutable once archived; the bytes are SHA-256-verified before display | `server/routes/media.ts`, `capsule/integrity.ts` | backend tests; unit tests; browser test (verified, renders) |
| Legacy pages run in an iframe sandboxed **without** `allow-same-origin`, inside a second sandboxed frame, so they cannot reach the app or its storage; and, by default, under a policy that forbids all network access | `capsule/viewer.js`, `integrity.ts` | unit tests; browser test (sandbox attribute; blocked requests never reach the network) |
| Private files never published | `.gitignore`, `scripts/verify-dist.mjs` | test: nothing under `private/` is tracked; verifier searches the public build for the originals, the sticker sheet, the song and the notes (also base64-encoded) |
| No `v-html`; all user text rendered as text; payloads validated on send **and** receive | UI + `domain/events.ts` | unit tests with hostile payloads |

| The entrance player only ever loads SoundCloud's own player: the link must be an `https` soundcloud.com address (look-alike hosts, other schemes, credentials and ports are refused), it is passed as an encoded parameter, and the frame is created only from a tap | `src/audio/entrance.ts` | unit tests with hostile links; source guard that no other file can create a frame |
| Postcards are plain text anyone could forge or read, so they can only carry heart/kiss/hug-style messages, go through the normal validation, expire, and are idempotent; they never carry mischief, spells or notes | `src/local/postcards.ts`, message route | unit tests (forged kinds, bad payloads, expiry); browser test |
| Backups are checked before anything is replaced: right app and version, safe record names, readable data | `src/local/backup.ts` | unit tests (path tricks, damage); browser test (a non-backup is refused, a real one restores) |
| A sealed note's text is never sent to its recipient before the day | `server/routes/content.ts` | backend tests (the text is absent from the response; reading is refused) |
| Daily answers stay secret until both have answered | `server/routes/keepsakes.ts` | backend tests |

## What is stored, and where

- In this browser's IndexedDB: the shared home's data (pings, notes, moods, plants, ideas, recipes, memories, files…) and each person's unsent-message queue.
- In `localStorage`: small display preferences (volume, reduced motion, quality).
- Nowhere else. No cookies of this app's own. Clearing the site's data (or the in-app erase button) removes all of it.
- If you use the entrance album, SoundCloud's player (loaded in a hidden frame) can see this browser's address and may set its own cookies. The app tells you so where you turn it on.
- Anyone who can open this browser profile can read it: there are no passwords. Use a browser profile you trust.

- A backup file contains everything in plain form (including private notes and photos). Keep it as private as the originals. Only restore backups you made yourself.

## Not covered

No third-party audit. Browsers' private windows may refuse storage (the page says so and then forgets everything on close).
The private build contains your personal content in plain form: treat that file like the originals.
