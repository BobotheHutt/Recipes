// js/auth.js
// Session storage helpers and token validation. Navbar + routing live in app.js.

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
    },

    headers(extra) {
        return Object.assign(
            { 'Authorization': 'Bearer ' + (this.getToken() || '') },
            extra || {}
        );
    }
};

// Confirm the saved token is still valid. Returns { username, isAdmin } or null.
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
