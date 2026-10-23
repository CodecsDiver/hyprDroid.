# Setup

You need Node 20+ only to *build* the file. The result is a single HTML file that needs no server.

## Public build (no personal content)

```bash
npm install
npm run build      # dist/index.html
```

Open it from disk, or put it on any static host. It makes no network requests, sets no cookies and identifies no device.

## Your private copy

1. `npm run assets:extract -- path/to/index1.html path/to/index2.html` reads your two original HTML files and writes
   `./private/` (the byte-exact originals, the sticker sheet, the room song, your written notes, a manifest of hashes).
   Git ignores `./private`.
2. `npm run build:private` builds `private/signal-home.html` with all of that baked in.
3. Open that file. The first time, it copies the content into the browser's storage (a couple of seconds);
   after that it opens instantly. You get: both originals in the Time Capsule, 18 stickers, the room song, your written notes.

**Do not publish `private/signal-home.html`** and do not put it in the repo. It is yours.

## How "two people" works

There is no sign-in. The first screen asks **Who is here?** (Daniel or Vee). Everything either of you does is saved in this
browser. To hand the page over: Settings → **Switch person**. Anything the other person sent (pings, hidden notes, spells…)
is waiting for them, exactly as if they had been away.

The choice is **not remembered**: close the page and it asks again.

## Where the data lives, and getting rid of it

Everything is in this browser's IndexedDB for this file/site. It is the browser's own storage, cleared whenever you clear
site data. In-app: Settings → **Erase everything in this browser** wipes it for both of you.

Different browsers, profiles and devices each have their own separate home. Opening the file at a different address or
path may be a different home as well (browsers key storage by origin; for `file://` this varies by browser).

## Checks

`npm run verify` (types, tests, build, dist safety). `npm run test:e2e` opens the built file in a real browser:
`PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/e2e/smoke.mjs [dist/index.html | private/signal-home.html]`.
