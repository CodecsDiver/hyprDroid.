# Setup

You need Node 20+. Nothing else: no database, no third-party account. Pick how you want to run it.

## A. Try it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:5173 in two windows. Sign in as `daniel` / `dev` in one and `vee` / `dev` in the other.
Data lives in `./.data` (delete the folder to start over). The dev users only exist outside production.

## B. Deploy on Netlify

1. **Make the accounts.** On your computer run `npm run setup:auth`. It asks for each person's name and a password
   (12+ characters), then prints three values. Passwords are stored only as salted PBKDF2 hashes.
2. **Create the site.** Netlify → *Add new site → Import an existing project* → pick this repository. `netlify.toml`
   already sets the build command (`npm run build`), the publish folder (`dist`) and the functions folder.
3. **Add the three values.** *Site configuration → Environment variables*:
   - `SIGNAL_USERS` — the JSON line (paste it exactly, no extra quotes)
   - `SIGNAL_SESSION_SECRET` — signs the login cookie
   - `SIGNAL_ADMIN_TOKEN` — only for loading your originals (step 5); delete it afterwards if you like
4. **Deploy.** Open the site. If it says "not set up yet", a variable is missing or malformed; the screen lists what.
5. **(Optional) Load your private originals** — see below.

Data is kept in Netlify Blobs (built into your site, nothing to create). The API is one Netlify Function at `/api/*`.

## C. Run it on your own machine or server

```bash
npm install
npm run build && npm run build:standalone
SIGNAL_USERS='…' SIGNAL_SESSION_SECRET=… SIGNAL_ADMIN_TOKEN=… PORT=8080 DATA_DIR=/var/lib/signal-home npm start
```

One Node process serves the app and the API and stores everything in `DATA_DIR`. Put HTTPS in front of it
(Caddy, nginx, a tunnel) — the session cookie is only marked `Secure` over HTTPS. Without the `SIGNAL_*` variables
and with `NODE_ENV` unset it falls back to the dev users, so always set them on a real server.
Run **one** process per data folder (the folder store is not safe across several processes).

## Loading your private originals

Your two original HTML files, sticker sheet, song and written notes must never be committed to this public repository.

```bash
# 1. Pull them out of the two files you uploaded (writes ./private, which git ignores)
npm run assets:extract -- path/to/index1.html path/to/index2.html

# 2. Check the plan
SIGNAL_ADMIN_TOKEN=… node scripts/upload-private-assets.mjs --url https://YOUR-SITE.netlify.app --author daniel --dry-run

# 3. Load them
SIGNAL_ADMIN_TOKEN=… node scripts/upload-private-assets.mjs --url https://YOUR-SITE.netlify.app --author daniel
```

It uploads both originals to the Time Capsule (immutable, SHA-256 recorded), 18 stickers from the sheet, the room song
as a track, and the written notes as love notes authored by `--author`. Safe to re-run; existing items are skipped.
For `npm run dev` use `--url http://localhost:5173`; the dev admin token is `dev-admin-token-` followed by the contents
of `.data/dev-secret`, cut to 64 characters.

## Changing a password or the names

Run `npm run setup:auth` again and replace `SIGNAL_USERS` (and `SIGNAL_SESSION_SECRET` to sign everyone out).
Keep the same lower-case ids (`daniel`, `vee`): data is stored under them.

## Checks before you rely on it

`npm run verify` (types, tests, build, dist safety). Then, on the deployed site, with two real devices: sign in on both, send
a ping each way, put one phone in airplane mode and send to it, then turn it back on. See LIMITATIONS.md for what has not been
exercised on a real Netlify deployment.
