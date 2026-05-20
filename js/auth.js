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

// Inject the Admin nav link (if admin) and a ⚙ Settings dropdown into the navbar.
function buildSessionNavbar(username, isAdmin) {
    const navbar = document.querySelector('.navbar');
    if (!navbar || document.getElementById('settings-menu')) return;

    // Admin nav link, placed after the last existing nav link
    if (isAdmin && !document.getElementById('admin-nav-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-nav-link';
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-link';
        adminLink.textContent = 'Admin';
        const links = navbar.querySelectorAll('.nav-link');
        if (links.length) {
            links[links.length - 1].insertAdjacentElement('afterend', adminLink);
        } else {
            navbar.appendChild(adminLink);
        }
    }

    const theme = (typeof getSavedTheme === 'function') ? getSavedTheme() : 'light';

    // Settings dropdown: trigger button + panel
    const menu = document.createElement('div');
    menu.id = 'settings-menu';
    menu.className = 'settings-menu';
    menu.innerHTML = `
        <button id="settings-btn" class="settings-btn" aria-label="Settings">⚙ Settings</button>
        <div id="settings-panel" class="settings-panel hidden">
            <div class="settings-row settings-user">👤 ${username}</div>
            <div class="settings-row">
                <label for="theme-select">Theme</label>
                <select id="theme-select">
                    <option value="light">☀️ Light Emerald</option>
                    <option value="dark">🌙 Dark Slate</option>
                    <option value="sepia">🍂 Cozy Sepia</option>
                </select>
            </div>
            <button id="logout-btn" class="settings-logout">Log out</button>
        </div>
    `;
    navbar.appendChild(menu);

    const btn = document.getElementById('settings-btn');
    const panel = document.getElementById('settings-panel');
    const themeSelect = document.getElementById('theme-select');
    const logoutBtn = document.getElementById('logout-btn');

    themeSelect.value = theme;
    themeSelect.addEventListener('change', (e) => {
        if (typeof applyTheme === 'function') applyTheme(e.target.value);
    });

    logoutBtn.addEventListener('click', logout);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('hidden');
    });

    // Close the panel when clicking anywhere outside it
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#settings-menu')) {
            panel.classList.add('hidden');
        }
    });
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
