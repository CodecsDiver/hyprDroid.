# Security

## Threat model

Two trusted people on a public website. The things that matter: **other people must never read or write your data; one partner must not
be able to impersonate, flood or surprise the other against their wishes; private personal content must never be public.** The repository
itself is public, and the web bundle is public by design.

## Controls, and how each is verified

| Control | Where it is enforced | Verified by |
|---|---|---|
| Exactly two fixed accounts from environment variables; no sign-up route exists | `server/config.ts`, `routes/auth.ts` | API tests (login, unknown user, config validation) |
| Passwords: salted PBKDF2-SHA256 (310 000 iterations), constant-time compare, same work for unknown users | `server/crypto.ts` | API tests; `setup:auth` output loaded and verified in a test |
| Session: HMAC-signed token in an **HttpOnly, SameSite=Strict** cookie (`Secure` over HTTPS), 30 days; the token never reaches page scripts | `server/app.ts`, `http.ts` | API tests + browser test (cookie flags, `document.cookie`) |
| Login lockout: 8 failures → 15 minutes | `routes/auth.ts` | API tests |
| CSRF: every state-changing call needs `x-requested-with: signal-home` and must not be flagged cross-site | `server/app.ts` | API tests |
| Every route authenticated except `/auth/login`, `/status`; everything is scoped to the caller or the pair | router `auth` flag | API tests walk the route table as anonymous |
| Events: server-stamped, idempotent, expiring, rate-limited (60/min), payload-sanitised, only the recipient can acknowledge | `routes/events.ts` | API tests + unit tests (dispatcher, inbox, outbox) |
| Mischief only with the recipient's opt-in; disruptive effects need a second opt-in; recipient's device re-checks | `routes/events.ts` + client | API consent matrix; unit test of the client check; browser test |
| Hidden notes readable only by author and recipient; body never copied into the event | `routes/state.ts` | API tests |
| Private memories visible only to their author until shared; vault files likewise | `routes/content.ts`, `routes/files.ts` | API tests |
| Files: type allow-list, size limits, magic-byte sniff, server-side SHA-256, Range reads, owner-only delete; SVG refused | `routes/files.ts`, `sniff.ts` | API tests; unit tests |
| Time Capsule items are admin-written, immutable (409 on change), files served as inert downloads with a sandboxing CSP; bytes SHA-256-verified in the browser before display | `routes/media.ts`, `capsule/integrity.ts` | API tests; unit tests; browser test (inert headers, tampered file refused) |
| Legacy pages run in a sandbox without `allow-same-origin`, in a separate page with its own CSP | `capsule-viewer.*`, `_headers` | browser test; unit tests on headers and sandbox |
| Strict CSP for the app (`script-src 'self'`, no inline/eval, no framing, `connect-src 'self'`); security headers | `public/_headers` | unit tests on the policy; whole UI exercised under it |
| The admin token only lets the owner's setup script act as a user; it is optional and can be deleted after loading content | `server/app.ts` | API tests |
| Private files never published | `.gitignore`, `scripts/verify-dist.mjs` | test: nothing under `private/` is tracked; verifier proven to fail on a planted copy |
| No secrets or password hashes in the repo or the bundle | tests, `verify-dist.mjs` | unit test over tracked files; dist check |
| No `v-html`; all user text rendered as text; payloads validated on send **and** receive | UI + `domain/events.ts` | unit tests with hostile payloads |

## Secrets

- Server environment only: `SIGNAL_USERS` (password hashes), `SIGNAL_SESSION_SECRET`, `SIGNAL_ADMIN_TOKEN`. None are in the browser or the repo.
- Anyone who obtains `SIGNAL_SESSION_SECRET` can sign in as either of you. Rotate it (and everyone is signed out) if it leaks.
- Unsent events wait in IndexedDB on the device until delivered; they remain there after sign-out until sent. Use a device you trust.

## Operational checklist

Use long passwords · keep the repository private if you can · delete `SIGNAL_ADMIN_TOKEN` after loading your content · serve over HTTPS ·
rotate the session secret if it is ever exposed · on a standalone server, run one process per data folder.

## Not covered (be honest with yourself)

No third-party penetration test or formal code audit. The API security tests run against the real handler with an in-memory store, and the
browser test against the real standalone server with a folder store — not against Netlify's runtime or Netlify Blobs. See LIMITATIONS.md.
