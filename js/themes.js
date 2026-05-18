// js/themes.js

// 1. Safe Immediate Function to apply theme styles as early as humanly possible
(function() {
    const savedTheme = localStorage.getItem('site_theme') || 'light';
    if (savedTheme !== 'light') {
        // Check if body is ready; if not, wait for the DOM to prevent null errors
        if (document.body) {
            document.body.className = `theme-${savedTheme}`;
        } else {
            document.addEventListener("DOMContentLoaded", () => {
                document.body.className = `theme-${savedTheme}`;
            });
        }
    }
})();

// 2. Automatically sync up dropdown interactive logic 
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
