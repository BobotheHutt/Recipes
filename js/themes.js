// js/themes.js

// 1. Run immediately to stop the white unstyled screen flash in dark/sepia modes
(function() {
    const savedTheme = localStorage.getItem('site_theme') || 'light';
    if (savedTheme !== 'light') {
        document.body.className = `theme-${savedTheme}`;
    }
})();

// 2. Automatically set up the dropdown selection box once the elements load
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('theme-select');
    if (!themeSelect) return;

    const savedTheme = localStorage.getItem('site_theme') || 'light';
    themeSelect.value = savedTheme;

    themeSelect.addEventListener('change', (e) => {
        const selection = e.target.value;
        localStorage.setItem('site_theme', selection);
        document.body.className = selection !== 'light' ? `theme-${selection}` : '';
    });
});
