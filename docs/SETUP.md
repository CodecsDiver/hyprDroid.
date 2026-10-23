# Setup

You need: Node 20+, a Supabase project (free tier is fine), and a host that can set HTTP headers (Netlify, Cloudflare Pages, nginx…).

## 1. Create the Supabase project

1. Create a project at supabase.com. Note the **Project URL** and the **anon (public) key** (Settings → API).
2. **Keep the service-role key out of the app.** It is only ever used by `npm run assets:upload` in your own terminal.

## 2. Lock down sign-up and create the two accounts

Signal Home is a two-person app; nobody else should be able to register.

1. Authentication → Sign In / Providers → **disable “Allow new users to sign up”**.
2. Authentication → Providers → Email: keep **Confirm email** on.
3. Authentication → Users → **Add user** twice (Daniel and Vee): their real emails, a strong password each,
   “Auto Confirm User” ticked.
4. Authentication → URL Configuration: set **Site URL** to where you will host the app (needed for email sign-in links).

## 3. Apply the database

Run the five files in `supabase/migrations/` **in order** — either paste each into the SQL editor, or with the CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

This creates every table with Row Level Security, the RPC functions, the five **private** storage buckets with size/type
limits and their policies, and adds the tables to the `supabase_realtime` publication.

Optional but recommended: Database → Extensions → enable **pg_cron** *before* running `…0002_events.sql`, and the hourly
expired-event purge is scheduled automatically. Otherwise call `select public.purge_expired_events();` yourself now and then
(expired events are already invisible to everyone; the purge only reclaims space).

## 4. Realtime authorisation (for live presence and the “tap the heart together” pulse)

Database changes (pings, notes, moods…) work out of the box. The *ephemeral* signals use private Realtime channels, which
need **Realtime → Settings → turn off “Allow public access”** so the policies on `realtime.messages` (migration 5) apply.
If you skip this, everything still works except the “partner is here” chip and the live heart pulse.

## 5. Configure and run the app

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://<ref>.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon key>
npm install
npm run dev
```

The app refuses to start if the key you provide is a service-role/secret key.

## 6. First run

1. Daniel signs in → **Create our home** → creates the household and an **invite code** for Vee's email.
2. Send Vee the code privately. It works once, only for Vee's verified email address, and expires in 7 days.
3. Vee signs in → **I have an invite code** → joins. The household is now exactly two people (enforced by the database).

## 7. Time Capsule and your private content

Your two original HTML files, the sticker sheet, the room song and the written notes must stay private.

```bash
# 1. Extract (writes ./private — gitignored)
npm run assets:extract -- path/to/signal-home.html path/to/love-universe.html

# 2. Preview what will be uploaded (no network)
npm run assets:upload -- --household <household-uuid> --author-email daniel@example.com --dry-run

# 3. Upload (runs on YOUR machine; the key never goes in the web app or a VITE_ variable)
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service key> \
  npm run assets:upload -- --household <household-uuid> --author-email daniel@example.com --yes
```

`--author-email` is the person who wrote the notes and owns the song/stickers (Daniel). The household id is shown in
Table editor → `households`. The script is safe to re-run; it refuses to overwrite a Time Capsule item whose fingerprint differs.

What this creates: both originals in the private `time-capsule` bucket (read-only for the two of you, fingerprint recorded in
`time_capsule_items`), 18 stickers from the sticker sheet, the room song as a track, and the notes in `love_notes`.

## 8. Deploy

```bash
npm run verify        # typecheck + tests + build + dist safety check
```

Deploy `dist/` over **HTTPS** (required for the service worker, microphone and notifications) and make sure the headers in
`dist/_headers` are applied (Netlify and Cloudflare Pages read that file automatically; for nginx/Caddy copy the values).
They include the Content-Security-Policy — tighten `https://*.supabase.co` to your exact project origin.
Test locally with the real headers: `npm run build && npm run serve:dist`.

## Troubleshooting

- **“needs a backend” screen** — `.env.local` missing or wrong; restart `npm run dev` after editing it.
- **Invite says “not valid for this account”** — the signed-in email must equal the invited email; the code is single-use.
- **No sound from mood loops / effects** — the loops are not provided (see ASSET_SPEC); effects use synthesised sounds until you add samples.
- **Large song upload fails** — the bucket allows 50 MB, but your Supabase plan may set a lower global upload limit.
