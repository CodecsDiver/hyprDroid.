# Shawn Tanner Website Prototype Studio

A review studio around three working website prototypes. Shawn can browse each design, compare two, point at parts of a page, record Keep / Change / Remove choices and favorites, and send a notes file back. Everything runs in the browser. There is no backend, build step or database.

Every business interaction is a demonstration. Nothing is sent, booked, reserved or purchased.

## What is in here

| Path | Purpose |
| --- | --- |
| `index.html`, `studio/` | The review studio (toolbar, preview frames, review panel, walkthrough, saving, import and export) |
| `prototypes/p1` | Version 1, Warm coast (the original prototype, kept in its look) |
| `prototypes/p2` | Version 2, Conversation-first |
| `prototypes/p3` | Version 3, Service-first |
| `prototypes/shared` | Business content, the pop-up windows, small shared behaviours and the review bridge |
| `tools/check-catalog.cjs` | Optional check that the list of reviewable parts matches the pages |
| `netlify.toml` | Publish settings for Netlify |

Review data (`studio/js/catalog.js`), prototype content (`prototypes/shared/content.js`) and presentation (each prototype's `style.css`) are kept separate.

## Run it on your own computer

The studio shows the prototypes in frames, so it needs a web server (opening `index.html` directly from disk will not work).

```
cd shawn-tanner-studio
python3 -m http.server 8080
```

Then open http://localhost:8080. Each prototype can also be opened alone, for example `prototypes/p2/index.html`.

## How reviewing works

- Each reviewable part of a page carries a stable id such as `p2.home.hero` (prototype, page, part). Ids never depend on position or wording.
- The studio talks to each frame through a small message channel (`prototypes/shared/review-bridge.js`). Messages are accepted only from the studio, from this same site, with a private per-frame token, and with a checked shape.
- Notes are saved in the browser's local storage. Nothing is uploaded. Sharing the studio link does not share notes.
- Notes keep a snapshot of their context (design, page, part, version, revision). If a part is later removed or its revision number is raised in `catalog.js`, the note is kept as written and flagged "needs another look". It is never silently attached to something else.
- Export gives a readable Markdown report and a JSON file. Import checks the file (format, allowed values, 1 MB limit), shows a preview, and offers Merge or Replace. A copy of the previous notes is kept so the import can be undone. Imported text is only ever shown as text.

## Changing the prototypes

1. Edit wording and facts once in `prototypes/shared/content.js`.
2. Add `data-review-id="pN.page.part"` to any new reviewable element and add it to `studio/js/catalog.js`.
3. Raise a prototype's `version` in `studio/js/config.js` (and the `REVISIONS` entry in `catalog.js` for a part whose content changed meaningfully).
4. Run the catalog check with the site being served:

```
npm root -g   # Playwright must be installed
NODE_PATH=$(npm root -g) node tools/check-catalog.cjs http://localhost:8080
```

## Placeholders that must be replaced before any public launch

- The business name ("Shawn Tanner" is a working name), services (proposed only), credentials (none are claimed), real testimonials and attribution permission, contact details, and the real consultation process.
- Not included on purpose: database, CRM, visitor identification, analytics, lead research, email campaigns, ad buying, payments, document uploads, client portal.

See `DEPLOY.md` to publish to Netlify.
