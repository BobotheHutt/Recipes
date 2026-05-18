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

// 2. Manage the navbar selection dropdowns sync across all pages
document.addEventListener('DOMContentLoaded', () => {
    const themeSelect = document.getElementById('theme-select');
    const profileSelect = document.getElementById('profile-select');

    // --- Theme Syncing ---
    if (themeSelect) {
        const savedTheme = localStorage.getItem('site_theme') || 'light';
        themeSelect.value = savedTheme;

        themeSelect.addEventListener('change', (e) => {
            const selection = e.target.value;
            localStorage.setItem('site_theme', selection);
            document.body.className = selection !== 'light' ? `theme-${selection}` : '';
        });
    }

    // --- Profile Syncing ---
    if (profileSelect) {
        const savedProfile = localStorage.getItem('uploader_name') || 'Guest';
        profileSelect.value = savedProfile;

        profileSelect.addEventListener('change', (e) => {
            const selection = e.target.value;
            localStorage.setItem('uploader_name', selection);
            
            // Automatically refresh layout grids if they exist on the page
            if (typeof renderPrivateRecipes === 'function') renderPrivateRecipes();
            if (typeof renderCommunityRecipes === 'function') renderCommunityRecipes();
        });
    }
});
