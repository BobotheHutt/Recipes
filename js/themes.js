// js/themes.js

// 1. Run IMMEDIATELY to prevent the white screen flash in dark or sepia mode
(function() {
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

// 2. Manage the navbar selection sync across all pages
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('theme-select');
    if (!themeSelect) return;

    // Set the dropdown to match your saved setting
    const savedTheme = localStorage.getItem('site_theme') || 'light';
    themeSelect.value = savedTheme;

    // When changed, apply globally and save
    themeSelect.addEventListener('change', (e) => {
        const selection = e.target.value;
        localStorage.setItem('site_theme', selection);
        document.body.className = selection !== 'light' ? `theme-${selection}` : '';
    });
});
