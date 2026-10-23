# Security

## Threat model

Two trusted people, one shared household, on a public static website backed by Supabase. The things that matter:
**other people must never read or write the household's data; one partner must not be able to impersonate, flood or surprise the other against their wishes;
private personal content must never be public.** The repository itself is public, and the web bundle and the anon key are public by design.

## Controls, and how each is verified

| Control | Where it is enforced | Verified by |
|---|---|---|
| Every table has RLS; no table is readable by `anon`; blanket default grants are revoked and re-granted per table/column | migrations | `tests/db/security.test.ts` — anon denied on all 24 tables; outsider sees 0 rows on 16 shared tables |
| Exactly two household members; one household per person | trigger + unique key | DB tests (`household_full`, `already_in_household`) |
| Membership only changes through RPC: invite token stored **hashed**, bound to the invited **verified email**, single-use, 7-day expiry, generic error | `invite_partner` / `accept_invite` | DB tests (wrong email, replay, expiry, hash never readable) |
| Events are server-stamped, idempotent, expiring, rate-limited (60/min), payload-sanitised; no direct writes; only the recipient can acknowledge | `send_event` + `emit_event` | DB tests + client unit tests (dispatcher, inbox, outbox) |
| Mischief only with the recipient's opt-in; disruptive effects need a second opt-in; recipient's device re-checks | `emit_event` + client | DB tests (consent matrix); unit test of the client check |
| Hidden notes readable only by author and recipient; note body never copied into the event; only recipient can mark read | RLS + RPC | DB tests |
| Private memories visible only to their author; media bound to the author's folder | RLS + CHECK | DB tests |
| Storage: every bucket private with size/MIME limits; read = household members; write/delete = own folder; no updates; Time Capsule read-only | storage policies | DB tests against a `storage.objects` shim |
| Time Capsule rows immutable to clients; archive bytes SHA-256-verified before display | grants + `capsule/integrity.ts` | DB tests; unit tests; browser test (tampered file refused) |
| Legacy pages run in a sandbox without `allow-same-origin`, in a separate page with its own CSP; nothing from them reaches the app origin | `capsule-viewer.*`, `_headers` | browser test: no storage leak; unit tests on headers and sandbox |
| Strict CSP for the app (`script-src 'self'`, no inline/eval, no framing); security headers; HTTPS assumed | `public/_headers` | unit tests on the policy; whole UI exercised under it in a browser |
| The app refuses a service-role/secret key; the service key is only used by a local script | `config/env.ts`, scripts | unit tests; a test fails if a JWT/secret-shaped string is committed |
| Private files never published | `.gitignore`, `scripts/verify-dist.mjs` | test: nothing under `private/` is tracked; verifier proven to fail on a planted copy |
| Uploads validated (type/size); photos re-encoded (EXIF/location stripped); SVG refused | `data/storage.ts`, `imageTools.ts`, bucket limits | unit tests |
| No `v-html`; all user text rendered as text; payloads validated on send **and** receive | UI + `domain/events.ts` | unit tests with hostile payloads |

## Secrets

- Browser: only `VITE_SUPABASE_URL` and the **anon** key — public by design and useless without a valid session + RLS.
- Never in the browser or repo: the service-role key (used only by `npm run assets:upload`, from your shell).
- supabase-js keeps the user's session token in `localStorage`. That is the standard Supabase arrangement; the CSP above is the main defence against script injection.
- Unsent events wait in IndexedDB on the device until delivered; they remain there after sign-out until sent. Use a device you trust.

## Operational checklist

Disable public sign-ups · keep email confirmation on · enable MFA on your Supabase account · turn off Realtime "public access" (see SETUP) ·
tighten the CSP's `*.supabase.co` to your project origin · keep the repository private if you can · rotate keys if one is ever exposed.

## Not covered (be honest with yourself)

No third-party penetration test or formal code audit. The database is tested against real Postgres (PGlite) with an emulation of Supabase's
auth/storage/realtime helpers, not against a hosted Supabase project. Trust in Supabase's own platform is assumed. See LIMITATIONS.md.
