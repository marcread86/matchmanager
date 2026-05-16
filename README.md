# Match Manager

Pitch-side mobile app for managing a football squad during a game.
Track playing time, run substitutions by position fit, log cards and goals,
switch formations on the fly, save multiple squads, import a CSV roster,
optionally sync everything across devices via Cloudflare Access + D1.

**Live:** `https://<your-project>.pages.dev`

## Stack

- Plain HTML + in-browser Babel/JSX. No build step.
- Cloudflare Pages for hosting + auto-deploy on push.
- Cloudflare Pages Functions (`/functions/api/`) for the sync API.
- Cloudflare D1 (SQLite) for per-user state.
- Cloudflare Access for sign-in (One-Time PIN over email, Google, etc.).

Without the optional cloud-sync setup, the app still works fully offline using `localStorage`.

## Local development

Just open `index.html` in a browser. There's no build step. Babel transpiles JSX in-browser.

The cloud-sync features are dormant locally — the app falls back to local-only mode when `/api/me` is unreachable.

## Deploy

See [`DEPLOY.md`](DEPLOY.md).

## Project layout

```
index.html          entry HTML, loads scripts + styles
app.jsx             main app (state, sheets, sub flow)
data.js             formations, position-compatibility helpers,
                    optional sample squad (window.SAMPLE_SQUAD)
styles.css          all styles
tweaks-panel.jsx    in-app tweaks panel (theme, accent, density)
cloud-sync.jsx      useCloudSync hook + SyncBadge component
functions/api/me.js          → /api/me        (Pages Function)
functions/api/state.js       → /api/state     (Pages Function)
schema.sql          D1 schema
wrangler.toml       optional, for `wrangler` CLI usage
```
