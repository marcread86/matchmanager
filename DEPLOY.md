# Deploying Match Manager to Cloudflare Pages

Two-part setup:

1. **Static site** — Cloudflare Pages connected to your GitHub repo. Gives you a public URL; everything works offline-first using `localStorage`.
2. **Sign-in + cloud sync** — Cloudflare Access (auth) + a D1 database (storage) + the two Pages Functions in `/functions/api/`. Lets coaches share data across devices.

You can ship part 1 alone and add part 2 later.

---

## 1 · Push the repo

On GitHub:

1. Open the repo.
2. **Add file** → **Upload files** → drag every project file in (preserve the `assets/` and `functions/` subfolders).
3. **Commit changes**.

Don't commit any bundler exports (`*.bundled.html`, `Match Manager.html`) — they're already in `.gitignore`.

---

## 2 · Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Authorize Cloudflare, pick the repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(empty)*
   - **Build output directory:** `/`
4. **Save and Deploy**. First build takes ~30s.

You now have a working site at `<project>.pages.dev`. Every push to `main` auto-redeploys.

At this stage the app shows a **Local** badge in the top bar — data is browser-only.

---

## 3 · Enable cloud sync

### 3a. Create the D1 database

**Dashboard route (easiest):**

1. Cloudflare dashboard → **Storage & databases** → **D1** → **Create database**.
2. Name: `matchmanager`. Create.
3. Open the database → **Console** tab → paste the contents of `schema.sql` → **Execute**.

**Or via CLI** (`wrangler` installed):

```bash
npx wrangler d1 create matchmanager
npx wrangler d1 execute matchmanager --remote --file=schema.sql
```

### 3b. Bind D1 to the Pages project

1. Pages project → **Settings** → **Bindings** (or **Functions → D1 database bindings**, depending on dashboard version).
2. **Add** → **D1 database**:
   - **Variable name:** `DB`  ← exactly two letters, capitalised (Pages Functions read `env.DB`)
   - **D1 database:** `matchmanager`
3. Save.
4. **Trigger a re-deploy** so the binding takes effect: Deployments tab → ⋯ on the latest deployment → **Retry deployment**.

### 3c. Lock the site behind Cloudflare Access

1. Dashboard → **Zero Trust**. First time: accept the free plan (50 users, no card), pick a team name (e.g. `matchmanager`) — your team domain becomes `<team>.cloudflareaccess.com`.
2. **Access** → **Applications** → **Add an application** → **Self-hosted**.
   - **Application name:** Match Manager
   - **Session duration:** 1 month
   - **Application domain:** subdomain `<your-project>`, domain `pages.dev`, path blank
   - **Next**.
3. **Identity providers** → tick **One-time PIN** (emails a 6-digit code; zero account setup for coaches). Optionally add **Google**.
4. **Policies** → **Add a policy**:
   - **Action:** Allow
   - **Configure rules:** Selector `Emails` → list each coach's email
   - *(or **Emails ending in** with `@yourclub.co.uk` to allow everyone at the club)*
5. **Add application**.

### 3d. (Optional) Show a working "Sign out" link

Pages → **Settings** → **Environment variables** → **Production**:

- **Variable:** `ACCESS_TEAM_DOMAIN`
- **Value:** `<team>.cloudflareaccess.com` *(your team domain from 3c.1)*

Without this the sync badge still works; the logout link just falls back to the relative path.

---

## How sign-in feels for coaches

1. Visit `<project>.pages.dev`.
2. Cloudflare Access intercepts → sign-in page → "Email me a code" → paste the code from their inbox.
3. Back on the app. Top bar shows **Synced  <name>**.
4. Their squads, crests, match state all follow them across devices.

Sessions last as long as you set (default 1 month). Revoking access: remove the email from the Access policy, or remove the user under Zero Trust → Users.

---

## How sync behaves

- On every change the client waits 1.5s, then PUTs the whole state to `/api/state`.
- On load it pulls `/api/state`; if the server's `updatedAt` is newer than local, server wins. Otherwise local pushes up.
- Last write wins. Two coaches editing simultaneously: whoever saves last clobbers the other. Fine at this scale.
- Per-user row capped at 1 MB in `/api/state.js`. Real squads are ~10 KB; crests-as-data-URLs push it up but stay well under.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Badge stays on **Local** after signing in | Access app's domain doesn't match your Pages URL exactly. Edit the Access app. |
| Badge flips to **Offline** after every edit | `DB` binding not picked up — go to Deployments → Retry deployment. |
| `500 DB binding missing` in browser console | Same as above. |
| Access sign-in loops | Browser blocking third-party cookies for `*.cloudflareaccess.com` — try a different browser to confirm. |
| Wipe a single user | D1 Console: `DELETE FROM user_state WHERE email = 'them@example.com';` |
| Wipe everything | D1 Console: `DELETE FROM user_state;` |
