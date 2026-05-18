/* /api/me — report the signed-in Cloudflare Access user, if any.
 *
 * Cloudflare Access stamps two headers on every authenticated request:
 *   Cf-Access-Authenticated-User-Email   — the verified user email
 *   Cf-Access-Jwt-Assertion              — the signed JWT (we don't verify here;
 *                                          Access already enforces sign-in at the edge)
 *
 * Locally (no Access in front of the dev server) both headers are absent,
 * so this returns { loggedIn: false } and the app stays in local-only mode.
 */

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  // Force re-auth by redirecting through Access's login endpoint
  if (url.searchParams.get('login') === '1') {
    return Response.redirect(url.origin, 302);
  }

  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) {
    return json({ loggedIn: false });
  }

  // Access logout endpoint is on the Cloudflare team domain — when configured,
  // env.ACCESS_TEAM_DOMAIN is set (e.g. "myteam.cloudflareaccess.com").
  const team = env.ACCESS_TEAM_DOMAIN;
  const logoutUrl = team
    ? `https://${team}/cdn-cgi/access/logout`
    : '/cdn-cgi/access/logout';

  return json({
    loggedIn: true,
    email,
    logoutUrl,
  });
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
