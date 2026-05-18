/* /api/state — per-user state storage, keyed by Cloudflare Access email.
 *
 *   GET  /api/state            → { state, updatedAt }   (404 if no row yet)
 *   PUT  /api/state  body:{state, updatedAt} → { ok:true, updatedAt }
 *
 * Authoritative: the email header from Cloudflare Access. Anyone bypassing
 * Access can't reach this — Access enforces sign-in at the edge.
 *
 * D1 binding name: DB  (configure in the Pages project → Settings → Functions
 * → D1 database bindings). Schema lives in /schema.sql.
 *
 * "Last write wins" — every PUT overwrites the row. The client compares
 * updatedAt on load and applies whichever side is newer.
 */

export async function onRequestGet({ request, env }) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) return json({ error: 'not signed in' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  const row = await env.DB
    .prepare('SELECT state, updated_at FROM user_state WHERE email = ?')
    .bind(email)
    .first();

  if (!row) return json({ state: null, updatedAt: 0 });

  let parsed = null;
  try { parsed = JSON.parse(row.state); } catch (e) {}
  return json({ state: parsed, updatedAt: row.updated_at });
}

export async function onRequestPut({ request, env }) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) return json({ error: 'not signed in' }, 401);
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ error: 'invalid JSON body' }, 400); }

  if (!body || typeof body.state !== 'object' || body.state === null) {
    return json({ error: 'expected {state, updatedAt}' }, 400);
  }

  const now = body.updatedAt || Date.now();
  const stateStr = JSON.stringify(body.state);

  // Refuse anything wildly oversized to avoid eating D1 quota
  if (stateStr.length > 1_000_000) {
    return json({ error: 'state too large (>1MB)' }, 413);
  }

  await env.DB
    .prepare(`
      INSERT INTO user_state (email, state, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE
        SET state = excluded.state,
            updated_at = excluded.updated_at
    `)
    .bind(email, stateStr, now)
    .run();

  return json({ ok: true, updatedAt: now });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
