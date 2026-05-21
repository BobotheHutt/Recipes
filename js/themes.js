// js/themes.js
// Theme application. Account preferences (incl. theme) are managed in auth.js;
// this file applies a theme to the page and reads the cached value for the
// instant first paint.
//
// The theme class lives on the <html> element (document.documentElement) so
// the themed background — set on html in style.css — covers the whole
// viewport regardless of page content.

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
    document.documentElement.className =
        (theme && theme !== 'light') ? `theme-${theme}` : '';
}

// Apply the cached theme immediately on load to avoid a flash.
applyTheme(getCachedTheme());
