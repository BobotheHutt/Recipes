// js/auth.js
// Session storage helpers, token validation, and account preferences.

const AUTH = {
    getToken()   { return localStorage.getItem('auth_token'); },
    getUsername(){ return localStorage.getItem('auth_username'); },
    isAdmin()    { return localStorage.getItem('auth_is_admin') === 'true'; },

    setSession(token, username, isAdmin) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_username', username);
        localStorage.setItem('auth_is_admin', isAdmin ? 'true' : 'false');
    },

    clear() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        localStorage.removeItem('auth_is_admin');
        // note: cached prefs are intentionally kept as an anti-flash fallback
    },

    headers(extra) {
        return Object.assign(
            { 'Authorization': 'Bearer ' + (this.getToken() || '') },
            extra || {}
        );
    }
};

// ---- Account preferences ----
// The account (server) is the source of truth. A local copy is cached only
// so the very next page load can paint the right theme instantly; the
// account value always overrides it once the session validates.

const DEFAULT_PREFS = { theme: 'light', showImages: true, autoShare: true };

let ACCOUNT_PREFS = loadCachedPrefs();

function loadCachedPrefs() {
    try {
        const raw = localStorage.getItem('account_prefs');
        return raw ? Object.assign({}, DEFAULT_PREFS, JSON.parse(raw)) : Object.assign({}, DEFAULT_PREFS);
    } catch (e) {
        return Object.assign({}, DEFAULT_PREFS);
    }
}

function cachePrefs(prefs) {
    ACCOUNT_PREFS = Object.assign({}, DEFAULT_PREFS, prefs || {});
    try {
        localStorage.setItem('account_prefs', JSON.stringify(ACCOUNT_PREFS));
    } catch (e) { /* ignore */ }
}

function getPrefs() {
    return ACCOUNT_PREFS;
}

// Save one or more preference fields to the account, and update the local cache.
async function savePrefs(partial) {
    const merged = Object.assign({}, ACCOUNT_PREFS, partial);
    cachePrefs(merged); // optimistic: cache immediately so UI feels instant
    try {
        const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/auth/preferences`, {
            method: 'POST',
            headers: AUTH.headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(partial)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.preferences) cachePrefs(data.preferences);
        }
    } catch (e) {
        // cache already updated; the next successful sync will reconcile
        console.error('Could not save preferences:', e);
    }
}

// Confirm the saved token is still valid. Returns { username, isAdmin, preferences } or null.
async function validateSession() {
    const token = AUTH.getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/auth/validate`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('invalid');
        const data = await res.json();
        AUTH.setSession(token, data.username, data.isAdmin);
        if (data.preferences) cachePrefs(data.preferences);
        return data;
    } catch (e) {
        AUTH.clear();
        return null;
    }
}

async function logout() {
    const token = AUTH.getToken();
    try {
        if (token) {
            await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
    } catch (e) {
        // clear locally regardless
    }
    AUTH.clear();
    window.location.href = 'login.html';
}
