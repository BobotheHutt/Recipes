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

// 2. Manage the navbar selection dropdown sync across all pages
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // A. Check if the selector container or theme select already exists to prevent duplicate injections
    let themeSelect = document.getElementById('theme-select');
    
    if (!themeSelect) {
        // Create a basic container for the theme selector if not statically hardcoded in HTML
        const themeContainer = document.createElement('div');
        themeContainer.style.marginLeft = 'auto'; // Keeps elements right-aligned in navbar layout
        themeContainer.style.display = 'flex';
        themeContainer.style.gap = '8px';
        themeContainer.style.alignItems = 'center';
        
        themeContainer.innerHTML = `
            <select id="theme-select" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); cursor: pointer; outline: none;">
                <option value="light">☀️ Light Emerald</option>
                <option value="dark">🌙 Dark Slate</option>
                <option value="sepia">🍂 Cozy Sepia</option>
            </select>
        `;
        navbar.appendChild(themeContainer);
        themeSelect = document.getElementById('theme-select');
    }

    // B. Synchronize theme adjustments directly to the layout background class tags
    if (themeSelect) {
        const savedTheme = localStorage.getItem('site_theme') || 'light';
        themeSelect.value = savedTheme;

        themeSelect.value = savedTheme;
        themeSelect.addEventListener('change', (e) => {
            const selection = e.target.value;
            localStorage.setItem('site_theme', selection);
            document.body.className = selection !== 'light' ? `theme-${selection}` : '';
        });
    }
});
