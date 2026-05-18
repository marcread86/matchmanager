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

const PREV_USER_KEY = 'mm.lastSignedInEmail';

function useCloudSync(state, setState) {
  const [user, setUser]     = useState(null);
  const [status, setStatus] = useState('checking'); // checking | local | offline | syncing | synced | error | expired
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const pushTimer = useRef(null);
  const skipNextPush = useRef(true);
  const mounted = useRef(true);

  // 1. Sign-in check + initial pull
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch('/api/me', { credentials: 'include' });
        if (cancelled) return;

        let me = null;
        try { me = await meRes.json(); } catch (e) {}

        const prevEmail = (() => { try { return localStorage.getItem(PREV_USER_KEY); } catch (e) { return null; } })();

        if (!meRes.ok || !me || !me.loggedIn) {
          // Session is dead. If the user had been signed in before, surface
          // an "expired" state so we can prompt them to sign back in.
          if (prevEmail) {
            setStatus('expired');
            setUser({ email: prevEmail, expired: true });
          } else {
            setStatus('local');
          }
          return;
        }

        setUser(me);
        try { localStorage.setItem(PREV_USER_KEY, me.email); } catch (e) {}

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
          setStatus('synced');
        }
      } catch (e) {
        if (!cancelled) setStatus('local');
      }
    })();
    return () => { cancelled = true; mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Debounced PUT on every state change (only when actually signed in)
  useEffect(() => {
    if (!user || user.expired) return;
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
        if (res.status === 401 || res.status === 302 || !res.ok) {
          // Session died mid-session — surface expired state
          setStatus('expired');
          setUser(u => u ? { ...u, expired: true } : { email: 'unknown', expired: true });
          return;
        }
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

// Tiny status pill — embed in the top bar. When the user is a guest, it
// becomes a "Sign in" call-to-action instead of a passive status indicator.
function SyncBadge({ sync, onShowWelcome }) {
  const { user, status } = sync;
  const isSignedIn = !!user && !user.expired;
  const labels = {
    checking: { txt: '…',         tone: 'mute' },
    local:    { txt: 'Sign in',   tone: 'cta'  },
    offline:  { txt: 'Offline',   tone: 'warn' },
    syncing:  { txt: 'Syncing…',  tone: 'go'   },
    synced:   { txt: isSignedIn ? 'Synced' : 'Sign in', tone: isSignedIn ? 'ok' : 'cta' },
    expired:  { txt: 'Sign in',   tone: 'cta'  },
    error:    { txt: 'Error',     tone: 'warn' },
  };
  const v = labels[status] || labels.local;
  const isCta = !isSignedIn;
  const title = isSignedIn
    ? `Signed in as ${user.email}${user.logoutUrl ? ' — tap to sign out' : ''}`
    : status === 'expired'
      ? 'Your sign-in expired — tap to sign in again'
      : 'Tap to sign in and sync across devices';
  function onClick(e) {
    e.preventDefault();
    if (isSignedIn && user.logoutUrl) {
      window.location.href = user.logoutUrl;
    } else if (status === 'expired') {
      window.triggerSignIn?.();
    } else if (onShowWelcome) {
      onShowWelcome();
    } else if (typeof window.triggerSignIn === 'function') {
      window.triggerSignIn();
    }
  }
  return (
    <button
      type="button"
      className={"sync-badge tone-" + v.tone + (isCta ? ' cta' : '')}
      onClick={onClick}
      title={title}
    >
      <span className="sync-dot"></span>
      <span className="sync-txt">{v.txt}</span>
      {isSignedIn && <span className="sync-email">{user.email.split('@')[0]}</span>}
    </button>
  );
}

// Banner that appears when a previously-signed-in user's Cloudflare Access
// session has expired (after ~30 days). Dismissible, but non-disruptive — the
// app stays usable as a guest while showing the prompt.
function SessionExpiredBanner({ sync }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  if (sync.status !== 'expired') return null;
  const email = sync.user?.email;
  return (
    <div className="session-expired-banner">
      <div className="seb-icon" aria-hidden="true">🔑</div>
      <div className="seb-body">
        <div className="seb-title">Your sign-in expired</div>
        <div className="seb-sub">
          {email
            ? `Tap to sign in again as ${email}. Your data is safe.`
            : 'Tap to sign in again. Your data is safe.'}
        </div>
      </div>
      <button className="seb-btn" onClick={() => window.triggerSignIn?.()}>
        Sign in
      </button>
      <button className="seb-close" aria-label="Dismiss" onClick={() => setDismissed(true)}>×</button>
    </div>
  );
}

Object.assign(window, { useCloudSync, SyncBadge, SessionExpiredBanner });
