// js/themes.js
// Theme application. Account preferences (incl. theme) are managed in auth.js;
// this file just applies a theme to the page and reads the cached value for
// the instant first paint.

// Read the theme from the cached account prefs (anti-flash fallback before
// the live account data arrives). Falls back to 'light'.
function getCachedTheme() {
    try {
        const raw = localStorage.getItem('account_prefs');
        if (raw) {
            const p = JSON.parse(raw);
            if (p && typeof p.theme === 'string') return p.theme;
        }
    } catch (e) { /* ignore */ }
    return 'light';
}

// Apply a theme to the page (does not save it — saving is auth.js savePrefs).
function applyTheme(theme) {
    document.body.className = (theme && theme !== 'light') ? `theme-${theme}` : '';
}

// Apply the cached theme immediately on load to avoid a flash.
(function () {
    const t = getCachedTheme();
    if (t !== 'light') {
        if (document.body) {
            document.body.className = `theme-${t}`;
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.className = `theme-${t}`;
            });
        }
    }
})();
