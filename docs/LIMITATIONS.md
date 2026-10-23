# Outstanding limitations and honest boundaries

These are the things that are **not** done, **not** verified, or **deliberately** limited.

## Not provided yet (needs your assets)
1. **The 3D room is placeholder geometry.** No Blender environment, animation clips, textures or final art exist; the app says so on screen. The *loading* path for a real GLB (ids, clips, per-object overrides) is built and its failure/fallback behaviour is tested, but it has never loaded a real GLB because none exists — expect to do a first integration pass when you have one (see ASSET_SPEC.md).
2. **Mood loops (rain / gentle / sleep / reunion / cuddly) and sound-effect samples were not in the supplied files.** Effects use the synthesised sounds from the originals; mood loops are silent until you provide files.
3. **No logo, textures or UI imagery.**
4. **Vee's Spell Table is a themed panel plus a glowing table in the room**, not a separate 3D environment.

## Not implemented
5. **Push notifications while the app is fully closed.** That needs VAPID keys and a server-side sender. What exists: per-user notification settings, quiet hours, browser notifications while the app is open or backgrounded, and guaranteed delivery on next open.
6. The original **trip tracker / countdown** and the **stub pages** of the Signal Home prototype were not carried over as such: the app is deliberately not built around long distance. Their intent lives on in Date Jar, the Vault (real voice messages) and the mood signals; promises have no feature.
7. No in-app way to change a password or a name: re-run `npm run setup:auth` and update the environment variable.
8. "Personalised surprises" are name-templated text on the built-in effects, not user-authored pranks.

## Not verified (could be wrong in ways the tests cannot show)
9. **Never run on Netlify itself.** The Netlify Function and the Netlify Blobs store are compiled and type-checked, and they share every line of request handling with the server the tests exercise, but the Blobs adapter (`server/store-netlify.ts`) and the function wrapper have not executed against Netlify's runtime. Deploy, then run the two-device check in SETUP.md first.
10. `assets:upload` was run end to end against the real standalone server (including re-runs); it has not been run against a deployed site.
11. **Synchronised playback** has tested maths (position, drift, clock offset) but no real two-device, real-latency test.
12. **No real mobile hardware.** WebGL ran in Chromium with a software renderer; frame rate, battery and thermal behaviour on phones are unmeasured; the quality tiers are heuristics. Not tested on iOS Safari.
13. **Accessibility**: automated axe-core WCAG 2.x A/AA checks pass on every screen; there has been no manual screen-reader or full keyboard-only audit, and the 3D canvas is intentionally hidden from assistive tech in favour of the object list.

## Known behaviours worth knowing
14. **"Live" is long-polling, not a push socket.** Typical delivery is within about 1.5 s plus network time; each open app makes one request per ~6 s. That is well inside Netlify's free allowances for two people, but it is metered (function invocations and Blobs operations) — check your plan if the app stays open on many devices all day. A hidden tab checks every 30 s.
15. **Netlify request limits.** Request and response bodies are capped at about 6 MB, so uploads go in 3 MiB chunks and downloads are served one chunk per Range request. Songs are limited to 40 MB, vault files to 20 MB, covers and stickers to 3 MB.
16. The standalone/dev folder store is **not safe across several processes**; run one.
17. The Time Capsule shows the originals **exactly as archived**. They request files that no longer exist (Signal Home's GLB models and sound loops) and load three.js from a CDN; the room falls back to its own simple shapes, and the capsule viewer's CSP therefore allows that CDN (isolated from the app — see SECURITY.md).
18. The mood labels preserve the originals' wording, including nicknames, in a **public** repository (`src/domain/moods.ts`). Make the repo private or edit them if that matters.
19. Dependency versions were chosen conservatively (Vite 6, Vitest 3, TypeScript 5.7, Three 0.170) rather than the newest majors.
