# Deploying MPB Rangers to Cloudflare Pages

A two-part setup:

1. **Static site** → Cloudflare Pages connected to your GitHub repo.
2. **Sign-in + cloud sync** → Cloudflare Access (auth) + a D1 database (storage) + the two Pages Functions in `/functions/api/`.

You can ship part 1 alone — the app works fully offline-first, using `localStorage`. Add part 2 when you're ready to share with coaches.

---

## 1 · Push the repo

```bash
git init               # if not already
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

Don't commit `MPB Rangers Squad Manager.html` (the bundler export) — it's already in `.gitignore`.

---

## 2 · Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare, pick the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(empty)*
   - **Build output directory:** `/`
4. **Save and Deploy**. First build is ~30 seconds.

You now have a working site at `<project>.pages.dev`. Every push to `main` redeploys.

At this stage the app shows a **`Local`** badge in the top bar — meaning data is saved in the browser only.

---

## 3 · Enable cloud sync

### 3a. Create the D1 database

**Easiest — dashboard:**

1. Cloudflare dashboard → **Workers & Pages** → **D1** → **Create database**.
2. Name: `mpb-rangers`. Create it.
3. Open the database → **Console** tab → paste the contents of `schema.sql` → Run.

**Or by CLI** (if you have `wrangler` installed):

```bash
npx wrangler d1 create mpb-rangers
npx wrangler d1 execute mpb-rangers --remote --file=schema.sql
```

### 3b. Bind the D1 database to the Pages project

1. Cloudflare dashboard → your Pages project → **Settings** → **Functions** → **D1 database bindings**.
2. Click **Add binding**:
   - **Variable name:** `DB`  (must match — Pages Functions read `env.DB`)
   - **D1 database:** `mpb-rangers`
3. Save. You may need to retry one deployment for the binding to attach.

### 3c. Lock the site behind Cloudflare Access

This is the actual login — Cloudflare hosts the sign-in page (Google, email magic link, GitHub, etc.) and stamps an authenticated email header onto every request.

1. Dashboard → **Zero Trust** → if first time, accept the free plan (50 users, no card needed).
2. Note your team domain on the Overview screen — something like `mpb.cloudflareaccess.com`.
3. **Access** → **Applications** → **Add an application** → **Self-hosted**.
   - **Application name:** MPB Rangers
   - **Session duration:** 1 month *(so coaches don't log in every visit)*
   - **Domain:** your Pages domain — either `<project>.pages.dev` or a custom domain if you've set one up
   - **Path:** leave blank to gate the whole site
4. **Identity providers** — tick **One-time PIN** (emails a 6-digit code; no account creation needed). Optionally add **Google** as well.
5. **Policies** → **Add a policy** → **Allow**:
   - **Include** → **Emails** → list each coach's email
   - *(or Email domain — e.g. `@yourclub.co.uk` — to allow anyone at the club)*
6. Save the application.

### 3d. (Optional) Tell the app where the logout endpoint lives

Pages project → **Settings** → **Environment variables** → **Production**:

- **Variable:** `ACCESS_TEAM_DOMAIN`
- **Value:** `mpb.cloudflareaccess.com` *(your team domain from step 3c.2)*

This just makes the sync badge's "Sign out" link work — everything else functions without it.

---

## 4 · How sign-in feels for coaches

1. They visit `<project>.pages.dev`.
2. Cloudflare Access intercepts → shows a clean sign-in page → they pick "Email me a code" → type their email → paste the code from their inbox.
3. They're back on the app. Top bar shows **`Synced  <theirname>`**.
4. Their squads, crests, match state — everything — now follow them across devices.

Sessions last as long as you set in 3c (default a month). Removing access later: delete the Access **policy** entry, or remove the user from the **Users** list under Zero Trust.

---

## How sync behaves

- On every state change the client waits 1.5s, then PUTs the full state to `/api/state`.
- On load it pulls `/api/state`; if the server's `updatedAt` is newer than local, server wins. Otherwise local pushes up.
- Last write wins. If two coaches edit at the same moment, whoever saves last clobbers the other. Good enough for this scale; if you outgrow it, the upgrade path is per-section locks or CRDT.
- D1 row size is hard-capped at 1 MB per user in `/api/state.js`. Real squads are ~10 KB; crests-as-data-URLs push it up but stay well under.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Badge stays on `Local` even after signing in | Access policy doesn't cover this URL — check the **Domain/Path** on the Access app |
| Badge flips to `Offline` after every edit | `DB` binding not attached, or schema not run — recheck step 3a/3b |
| `500 DB binding missing` in browser console | Same as above |
| Browser shows the Access sign-in page in an infinite loop | The browser is blocking 3rd-party cookies for `*.cloudflareaccess.com` — happens in some Safari + private-mode combos. Use a different browser to confirm. |
| Want to wipe a user's state | D1 console: `DELETE FROM user_state WHERE email = 'them@example.com';` |
