// js/auth.js
// Handles login session, page guarding, and the navbar account display.

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

    // Standard headers for an authenticated request
    headers(extra) {
        return Object.assign(
            { 'Authorization': 'Bearer ' + (this.getToken() || '') },
            extra || {}
        );
    }
};

// Guard a page. Returns { username, isAdmin } or redirects to login and returns null.
async function requireLogin() {
    const token = AUTH.getToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/auth/validate`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Session invalid');

        const data = await res.json();
        AUTH.setSession(token, data.username, data.isAdmin);
        buildSessionNavbar(data.username, data.isAdmin);
        return data;
    } catch (e) {
        AUTH.clear();
        window.location.href = 'login.html';
        return null;
    }
}

// Inject "logged in as X", an Admin link (if admin), and a Logout button into the navbar.
function buildSessionNavbar(username, isAdmin) {
    const navbar = document.querySelector('.navbar');
    if (!navbar || document.getElementById('session-box')) return;

    // Admin nav link
    if (isAdmin && !document.getElementById('admin-nav-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-nav-link';
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-link';
        adminLink.textContent = 'Admin';
        // place it after the last existing nav link
        const links = navbar.querySelectorAll('.nav-link');
        if (links.length) {
            links[links.length - 1].insertAdjacentElement('afterend', adminLink);
        } else {
            navbar.appendChild(adminLink);
        }
    }

    const box = document.createElement('div');
    box.id = 'session-box';
    box.style.cssText = 'display:flex; align-items:center; gap:10px; margin-left:16px;';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = '👤 ' + username;
    nameSpan.style.cssText = 'font-size:0.85rem; font-weight:600; color:var(--text-muted);';

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Log out';
    logoutBtn.className = 'text-btn';
    logoutBtn.style.cssText = 'font-size:0.8rem; padding:6px 12px; border:1px solid var(--border); border-radius:6px;';
    logoutBtn.addEventListener('click', logout);

    box.appendChild(nameSpan);
    box.appendChild(logoutBtn);
    navbar.appendChild(box);
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
        // even if the server call fails, clear the local session
    }
    AUTH.clear();
    window.location.href = 'login.html';
}
