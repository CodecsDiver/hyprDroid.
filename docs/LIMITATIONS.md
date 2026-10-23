# Outstanding limitations and honest boundaries

These are the things that are **not** done, **not** verified, or **deliberately** limited.

## Not provided yet (needs your assets)
1. **The 3D room is placeholder geometry.** No Blender environment, animation clips, textures or final art exist; the app says so on screen. The *loading* path for a real GLB (ids, clips, per-object overrides) is built and its failure/fallback behaviour is tested, but it has never loaded a real GLB because none exists — expect to do a first integration pass when you have one (see ASSET_SPEC.md).
2. **Mood loops (rain / gentle / sleep / reunion / cuddly) and sound-effect samples were not in the supplied files.** Effects use the synthesised sounds from the originals; mood loops are silent until you provide files.
3. **No logo, textures or UI imagery.**
4. **Vee's Spell Table is a themed panel plus a glowing table in the room**, not a separate 3D environment.
5. **Private GLB hosting** needs a new bucket (the existing ones restrict file types). Public hosting works today.

## Not implemented
6. **Push notifications while the app is fully closed.** That needs VAPID keys and a server-side sender (e.g. an Edge Function). What exists: per-user notification settings, quiet hours, browser notifications while the app is open or backgrounded, and guaranteed delivery on next open.
7. The original **trip tracker / countdown** and the **stub pages** of the Signal Home prototype (promises, date-night prompts, voice-note placeholders) were not carried over as such: the app is deliberately not built around long distance. Their intent lives on in Date Jar, the Vault (real voice messages) and the mood signals; promises have no feature.
8. No flow for leaving or transferring a household (an administrator can do it in the dashboard); one household per person.
9. "Personalised surprises" are name-templated text on the built-in effects, not user-authored pranks.

## Not verified (could be wrong in ways the tests cannot show)
10. **Never run against a hosted Supabase project.** Database logic/RLS ran on real Postgres via PGlite with an emulated Supabase shim; a contract test checks that every table, column, privilege and RPC argument the client uses exists in that schema; the browser flows ran against a *stubbed* Supabase (HTTP + realtime websocket) that enforces nothing, so the exact PostgREST query strings and response shapes are untested against the real service. The real Storage API (uploads, signed URLs), Realtime server (including private channels/RLS on `realtime.messages`) and email flows are unexercised. A two-device test on a real project is the first thing to do.
11. `assets:upload` was verified only in `--dry-run` (plan, hashes, paths); the live path is unexecuted.
12. **Synchronised playback** has tested maths (position, drift, clock offset) but no real two-device, real-latency test.
13. **No real mobile hardware.** WebGL ran in Chromium with a software renderer; frame rate, battery and thermal behaviour on phones are unmeasured; the quality tiers are heuristics. Not tested on iOS Safari.
14. **Accessibility**: automated axe-core WCAG 2.x A/AA checks pass on every screen; there has been no manual screen-reader or full keyboard-only audit, and the 3D canvas is intentionally hidden from assistive tech in favour of the object list.

## Known behaviours worth knowing
15. Supabase Realtime cannot filter DELETE events, so deletions made by your partner (a date idea, a note) appear when you next foreground the app or reconnect, not instantly.
16. If Realtime "public access" is not turned off, private presence/broadcast channels will not join: pings and notes still work live; the "partner is here" chip and live heart pulse do not.
17. The Time Capsule shows the originals **exactly as archived**. They request files that no longer exist (Signal Home's GLB models and sound loops) and load three.js from a CDN; the room falls back to its own simple shapes, and the capsule viewer's CSP therefore allows that CDN (isolated from the app — see SECURITY.md).
18. The mood labels preserve the originals' wording, including nicknames, in a **public** repository (`src/domain/moods.ts`). Make the repo private or edit them if that matters.
19. Dependency versions were chosen conservatively (Vite 6, Vitest 3, TypeScript 5.7, Three 0.170) rather than the newest majors.
