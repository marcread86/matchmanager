/* global React */
/* Cloud sync for Match Manager — Cloudflare Access + Pages Functions + D1.
 *
 *  /api/me     GET  → { email, loggedIn, logoutUrl } | { loggedIn:false }
 *  /api/state  GET  → { state, updatedAt }
 *  /api/state  PUT  body:{ state, updatedAt }  → { ok:true, updatedAt }
 *
 *  Strategy:
 *    1. On mount, fetch /api/me. If signed in, fetch /api/state.
 *    2. Server "last write wins": if server.updatedAt > local.updatedAt, apply server.
 *       Otherwise push local up.
 *    3. While signed in, debounce-PUT the full state 1.5s after the last change.
 *
 *  When /api/me is unreachable (running locally, or before Cloudflare setup),
 *  the hook falls back to local-only mode and the badge says "Local".
 */
const { useState, useEffect, useRef } = React;

function useCloudSync(state, setState) {
  const [user, setUser]     = useState(null);
  const [status, setStatus] = useState('checking'); // checking | local | offline | syncing | synced | error
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const pushTimer = useRef(null);
  const skipNextPush = useRef(true); // don't push the very first state we hydrate from server
  const mounted = useRef(true);

  // 1. Sign-in check + initial pull
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch('/api/me', { credentials: 'include' });
        if (cancelled) return;
        if (!meRes.ok) { setStatus('local'); return; }
        const me = await meRes.json();
        if (!me || !me.loggedIn) { setStatus('local'); return; }
        setUser(me);

        const stateRes = await fetch('/api/state', { credentials: 'include' });
        if (cancelled) return;
        if (!stateRes.ok) { setStatus('error'); return; }
        const remote = await stateRes.json();
        if (remote && remote.state && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
          skipNextPush.current = true;
          setState(s => {
            if (remote.state.squads?.length) {
              const active = remote.state.squads.find(sq => sq.id === remote.state.activeSquadId) || remote.state.squads[0];
              if (active?.players) window.SQUAD = active.players;
            }
            return { ...s, ...remote.state, updatedAt: remote.updatedAt };
          });
          setLastSyncAt(remote.updatedAt);
          setStatus('synced');
        } else {
          // Nothing newer on server — push our local up next render
          setStatus('synced');
        }
      } catch (e) {
        if (!cancelled) setStatus('local');
      }
    })();
    return () => { cancelled = true; mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Debounced PUT on every state change (only when signed in)
  useEffect(() => {
    if (!user) return;
    if (skipNextPush.current) { skipNextPush.current = false; return; }
    setStatus('syncing');
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        const now = Date.now();
        const res = await fetch('/api/state', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state, updatedAt: now }),
        });
        if (!mounted.current) return;
        if (!res.ok) throw new Error('PUT ' + res.status);
        const j = await res.json();
        setLastSyncAt(j.updatedAt || now);
        setStatus('synced');
      } catch (e) {
        if (mounted.current) setStatus('offline');
      }
    }, 1500);
    return () => clearTimeout(pushTimer.current);
  }, [state, user]);

  return { user, status, lastSyncAt };
}

// Tiny status pill — embed in the top bar.
function SyncBadge({ sync }) {
  const { user, status } = sync;
  const labels = {
    checking: { txt: '…',         tone: 'mute' },
    local:    { txt: 'Local',     tone: 'mute' },
    offline:  { txt: 'Offline',   tone: 'warn' },
    syncing:  { txt: 'Syncing…',  tone: 'go'   },
    synced:   { txt: user ? 'Synced' : 'Local', tone: user ? 'ok' : 'mute' },
    error:    { txt: 'Error',     tone: 'warn' },
  };
  const v = labels[status] || labels.local;
  const interactive = !!user; // only clickable when there's a logout to fire
  const title = user
    ? `Signed in as ${user.email}${user.logoutUrl ? ' — tap to sign out' : ''}`
    : 'Saved on this device only';
  function onClick(e) {
    e.preventDefault();
    if (user?.logoutUrl) window.location.href = user.logoutUrl;
  }
  return (
    <button
      type="button"
      className={"sync-badge tone-" + v.tone + (interactive ? '' : ' static')}
      onClick={onClick}
      title={title}
      aria-disabled={!interactive}
    >
      <span className="sync-dot"></span>
      <span className="sync-txt">{v.txt}</span>
      {user && <span className="sync-email">{user.email.split('@')[0]}</span>}
    </button>
  );
}

Object.assign(window, { useCloudSync, SyncBadge });
