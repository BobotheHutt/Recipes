// js/themes.js
// Applies the saved theme immediately to avoid a flash of the wrong colors.
// The theme PICKER now lives in the Settings dropdown (see auth.js).

(function () {
    const savedTheme = localStorage.getItem('site_theme') || 'light';
    if (savedTheme !== 'light') {
        if (document.body) {
            document.body.className = `theme-${savedTheme}`;
        } else {
            document.addEventListener("DOMContentLoaded", () => {
                document.body.className = `theme-${savedTheme}`;
            });
        }
    }
})();

// Apply a theme choice and remember it.
function applyTheme(theme) {
    localStorage.setItem('site_theme', theme);
    document.body.className = theme !== 'light' ? `theme-${theme}` : '';
}

function getSavedTheme() {
    return localStorage.getItem('site_theme') || 'light';
}

// ---- Image display preference (per device, like theme) ----

function getShowImages() {
    // default: images ON
    return localStorage.getItem('show_images') !== 'false';
}

function setShowImages(show) {
    localStorage.setItem('show_images', show ? 'true' : 'false');
}
