# Security and privacy

## Threat model

Two people sharing one browser. There is no server, no account and no network traffic, so the things that matter are:
**nothing leaves the page; the page does not identify or remember a device; private personal content never ends up in the public
repository or the public build; the archived legacy pages cannot touch the app.**

## Controls, and how each is verified

| Control | Where it is enforced | Verified by |
|---|---|---|
| The app makes no network requests (no `fetch`, XHR, WebSocket, beacon, EventSource, external URLs) | the source; a CSP blocks the archived originals unless you opt in | unit test scans all of `src/`; browser test records every request while using the file |
| No device identification: no user-agent/platform/plugin reads, no device ids, no canvas fingerprinting, no cookies | the source | unit test scans `src/`; browser test checks the cookie jar is empty |
| Nothing remembered about who you are: "Who is here?" is asked every time the page opens | `src/state/session.ts` | browser test (reload → asked again) |
| Everything stored lives only in this browser's IndexedDB; one button erases all of it | `src/local/localStore.ts`, `backend.ts` | browser test (erase → data gone) |
| Rules still enforced in-page: events are idempotent, expiring, rate-limited and sanitised; mischief needs the recipient's opt-in (disruptive ones a second); hidden notes and private memories visible only to the right person | `server/` | 49 backend tests on the real handler; unit tests; browser test (mischief refused) |
| Files: type allow-list, size limits, magic-byte sniff, SHA-256, SVG refused | `server/routes/files.ts` | backend tests; unit tests |
| Time Capsule: items are immutable once archived; the bytes are SHA-256-verified before display | `server/routes/media.ts`, `capsule/integrity.ts` | backend tests; unit tests; browser test (verified, renders) |
| Legacy pages run in an iframe sandboxed **without** `allow-same-origin`, inside a second sandboxed frame, so they cannot reach the app or its storage; and, by default, under a policy that forbids all network access | `capsule/viewer.js`, `integrity.ts` | unit tests; browser test (sandbox attribute; blocked requests never reach the network) |
| Private files never published | `.gitignore`, `scripts/verify-dist.mjs` | test: nothing under `private/` is tracked; verifier searches the public build for the originals, the sticker sheet, the song and the notes (also base64-encoded) |
| No `v-html`; all user text rendered as text; payloads validated on send **and** receive | UI + `domain/events.ts` | unit tests with hostile payloads |

## What is stored, and where

- In this browser's IndexedDB: the shared home's data (pings, notes, moods, plants, ideas, recipes, memories, files…) and each person's unsent-message queue.
- In `localStorage`: small display preferences (volume, reduced motion, quality).
- Nowhere else. No cookies. Clearing the site's data (or the in-app erase button) removes all of it.
- Anyone who can open this browser profile can read it: there are no passwords. Use a browser profile you trust.

## Not covered

No third-party audit. Browsers' private windows may refuse storage (the page says so and then forgets everything on close).
The private build contains your personal content in plain form: treat that file like the originals.
