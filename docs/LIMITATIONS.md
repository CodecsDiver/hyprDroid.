# Outstanding limitations and honest boundaries

These are the things that are **not** done, **not** verified, or **deliberately** limited.

## The big one
1. **One browser = one home. Two devices cannot talk to each other.** With no server and no stored identity there is nothing to carry a message from one phone to another. Daniel and Vee share *one browser on one device* and hand it over with *Switch person*. Two devices each keep their own separate, unconnected home. If you later want real cross-device messages, something has to sit in the middle (a server, or a peer-to-peer link that needs a rendezvous point); that is a different app shape and would reintroduce storage and identity.
2. Because of (1), anything built for *simultaneous* togetherness (watching a partner's mood arrive live, playback synchronised across two devices, the "partner is here" chip, live heart pulses) only shows its full effect when you hand the page over; the logic exists and is tested, but it cannot be exercised across devices.

3. **Postcards are manual.** They bridge two devices without a server, but a person has to send the code and the other has to paste it. Nothing arrives by itself.

## Not provided yet (needs your assets)
4. **The 3D room is placeholder geometry.** No Blender environment, animation clips, textures or final art exist; the app says so on screen. The loading path for a real GLB is built and its fallback behaviour is tested, but it has never loaded a real GLB.
5. **Mood loops (rain / gentle / sleep / reunion / cuddly) and sound-effect samples were not in the supplied files.** Effects use the synthesised sounds from the originals; mood loops are silent until you provide files.
6. **No logo, textures or UI imagery.**
7. **Vee's Spell Table is a themed panel plus a glowing table in the room**, not a separate 3D environment.

## Not implemented
8. **Notifications while the page is closed** (impossible without a server) and installing it as an app (a single file has no manifest or service worker).
9. The original **trip tracker / countdown** and the **stub pages** of the Signal Home prototype were not carried over; the app is deliberately not built around long distance.
10. "Personalised surprises" are name-templated text on the built-in effects, not user-authored pranks.

## Not verified
11. **The SoundCloud entrance album has never played against the real SoundCloud.** The sandbox this was built in cannot reach it. What is tested: the link checking, that the right player frame (with autoplay) is created on the tap, the pause button, and that nothing else is contacted. Whether it actually starts depends on SoundCloud and on your browser's autoplay rules; Safari and iOS are the strictest and may need a second tap on the 🎵 button. A SoundCloud album that disallows embedding will not play. SoundCloud's pause/volume messages are sent by the documented postMessage protocol but are also untested against the real player.
12. **No real mobile hardware.** WebGL ran in Chromium with a software renderer; frame rate, battery and thermal behaviour on phones are unmeasured. Not tested on iOS Safari or Firefox. Browsers differ on whether a page opened from `file://` may use IndexedDB and whether two different file paths share storage; Chromium (tested) allows it.
13. **Accessibility**: automated axe-core WCAG 2.x A/AA checks pass on every screen (including the new ones), and a scripted keyboard-only pass opens every panel from the menu, closes it with Escape and returns focus to the menu button. Known gaps: the browser's own date-picker icon shows no focus ring (a native control), the Love Universe heart shows a glow rather than a ring, and there has been no manual screen-reader audit. The 3D canvas is intentionally hidden from assistive tech in favour of the object list.

## Known behaviours worth knowing
14. **Storage is the browser's, not yours.** Clearing site data, using a private window, or a browser's storage eviction removes everything. There is no backup or export yet.
15. Browser storage limits apply (typically hundreds of MB to GB); the private build uses roughly 15 MB. Songs are limited to 40 MB each, vault files 20 MB, covers and stickers 3 MB.
16. The Time Capsule shows the originals **as archived**, but with their internet access blocked by default (they wanted fonts and a 3D library from Google/unpkg and sound files that no longer exist). They look plainer; a switch in the panel lets them go online.
17. The mood labels preserve the originals' wording, including nicknames, in a **public** repository (`src/domain/moods.ts`). Make the repo private or edit them if that matters.
18. The private build is ~17 MB because it carries your originals, song and art inside the file.
19. **The photo wall shows up to 8 shared photos** (newest first) in the placeholder room; private photos never appear on it. A real Blender wall would replace it.
20. **Seasons follow the calendar in the northern hemisphere**; there is no hemisphere setting. Summer fireflies only come out at dusk, night and dawn.
21. **Sealed notes and the daily question use the day in UTC / this device's local date** respectively; a note can open up to a few hours early or late relative to your own midnight.
