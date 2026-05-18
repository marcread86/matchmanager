/* global React */
/* Welcome screen — first thing users see on a fresh visit.
 *
 * Two paths:
 *   • "Sign in" → redirects to /api/me?login=1, which is gated by Cloudflare
 *     Access; after sign-in, Access redirects back to /api/me?login=1, the
 *     Pages Function then redirects to '/', and the app loads in synced mode.
 *   • "Continue without signing in" → stamps a flag in localStorage so the
 *     welcome screen doesn't reappear; the app loads in local-only mode.
 *
 * The screen is also reachable from the sync badge (when "Local") so a guest
 * can promote themselves later.
 */

const WELCOME_KEY = 'mm.welcome.dismissed';

function welcomeDismissed() {
    try { return localStorage.getItem(WELCOME_KEY) === '1'; }
    catch (e) { return false; }
}
function dismissWelcome() {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) {}
}
function resetWelcome() {
    try { localStorage.removeItem(WELCOME_KEY); } catch (e) {}
}

function triggerSignIn() {
    // Dismiss welcome before bouncing — when they return after Cloudflare's
    // auth flow they should land directly on the app, not the welcome screen.
    dismissWelcome();
    // /api/me is protected by Access. Hitting it un-authed bounces to the
    // Cloudflare sign-in page, then back here. The ?login=1 query asks the
    // Function to redirect to '/' after auth completes (see functions/api/me.js).
    window.location.href = '/api/me?login=1';
}

function Welcome({ onDismiss }) {
    return (
        <div className="welcome-screen">
            <div className="welcome-card">
                <div className="welcome-mark" aria-hidden="true">
                    <video
                        className="welcome-video"
                        src="assets/welcome.mp4"
                        poster="assets/logo.png"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                    />
                </div>
                <p className="welcome-sub">
                    Track squads, run subs, manage matches — pitch-side on your phone.
                </p>

                <button className="welcome-btn primary" onClick={triggerSignIn}>
                    <span className="welcome-btn-label">Sign in to sync</span>
                    <span className="welcome-btn-sub">Your squads follow you across devices</span>
                </button>

                <button
                    className="welcome-btn"
                    onClick={() => { dismissWelcome(); onDismiss && onDismiss(); }}
                >
                    <span className="welcome-btn-label">Continue without signing in</span>
                    <span className="welcome-btn-sub">Data stays on this device only</span>
                </button>

                <div className="welcome-foot">
                    Signing in uses a one-time code emailed to you — no password needed.
                </div>
            </div>
        </div>
    );
}

Object.assign(window, {
    Welcome,
    welcomeDismissed,
    dismissWelcome,
    resetWelcome,
    triggerSignIn,
});
