# Outstanding limitations and honest boundaries

These are the things that are **not** done, **not** verified, or **deliberately** limited.

## The big one
1. **One browser = one home. Two devices cannot talk to each other.** With no server and no stored identity there is nothing to carry a message from one phone to another. Daniel and Vee share *one browser on one device* and hand it over with *Switch person*. Two devices each keep their own separate, unconnected home. If you later want real cross-device messages, something has to sit in the middle (a server, or a peer-to-peer link that needs a rendezvous point); that is a different app shape and would reintroduce storage and identity.
2. Because of (1), anything built for *simultaneous* togetherness (watching a partner's mood arrive live, playback synchronised across two devices, the "partner is here" chip, live heart pulses) only shows its full effect when you hand the page over; the logic exists and is tested, but it cannot be exercised across devices.

## Not provided yet (needs your assets)
3. **The 3D room is placeholder geometry.** No Blender environment, animation clips, textures or final art exist; the app says so on screen. The loading path for a real GLB is built and its fallback behaviour is tested, but it has never loaded a real GLB.
4. **Mood loops (rain / gentle / sleep / reunion / cuddly) and sound-effect samples were not in the supplied files.** Effects use the synthesised sounds from the originals; mood loops are silent until you provide files.
5. **No logo, textures or UI imagery.**
6. **Vee's Spell Table is a themed panel plus a glowing table in the room**, not a separate 3D environment.

## Not implemented
7. **Notifications while the page is closed** (impossible without a server) and installing it as an app (a single file has no manifest or service worker).
8. The original **trip tracker / countdown** and the **stub pages** of the Signal Home prototype were not carried over; the app is deliberately not built around long distance.
9. "Personalised surprises" are name-templated text on the built-in effects, not user-authored pranks.

## Not verified
10. **No real mobile hardware.** WebGL ran in Chromium with a software renderer; frame rate, battery and thermal behaviour on phones are unmeasured. Not tested on iOS Safari or Firefox. Browsers differ on whether a page opened from `file://` may use IndexedDB and whether two different file paths share storage; Chromium (tested) allows it.
11. **Accessibility**: automated axe-core WCAG 2.x A/AA checks pass on every screen; there has been no manual screen-reader or full keyboard-only audit, and the 3D canvas is intentionally hidden from assistive tech in favour of the object list.

## Known behaviours worth knowing
12. **Storage is the browser's, not yours.** Clearing site data, using a private window, or a browser's storage eviction removes everything. There is no backup or export yet.
13. Browser storage limits apply (typically hundreds of MB to GB); the private build uses roughly 15 MB. Songs are limited to 40 MB each, vault files 20 MB, covers and stickers 3 MB.
14. The Time Capsule shows the originals **as archived**, but with their internet access blocked by default (they wanted fonts and a 3D library from Google/unpkg and sound files that no longer exist). They look plainer; a switch in the panel lets them go online.
15. The mood labels preserve the originals' wording, including nicknames, in a **public** repository (`src/domain/moods.ts`). Make the repo private or edit them if that matters.
16. The private build is ~17 MB because it carries your originals, song and art inside the file.
