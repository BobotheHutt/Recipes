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

    // --- Theme Syncing Setup ---
    if (themeSelect) {
        const savedTheme = localStorage.getItem('site_theme') || 'light';
        themeSelect.value = savedTheme;

        themeSelect.addEventListener('change', (e) => {
            const selection = e.target.value;
            localStorage.setItem('site_theme', selection);
            document.body.className = selection !== 'light' ? `theme-${selection}` : '';
        });
    }

    // --- Dynamic Profile Engine Setup ---
    if (profileSelect) {
        // Initialize dynamic profile array tracker if empty
        if (!localStorage.getItem('site_profiles')) {
            localStorage.setItem('site_profiles', JSON.stringify([]));
        }

        // Render the option elements dynamically
        renderProfileOptions(profileSelect);

        // When a user updates the selection dropdown box
        profileSelect.addEventListener('change', (e) => {
            const selection = e.target.value;

            if (selection === 'ADD_NEW_PROFILE_ACTION') {
                // Trigger browser popup prompt to capture user's input string
                const newName = prompt("Enter the name for the new profile:");
                
                if (newName && newName.trim()) {
                    const cleanName = newName.trim();
                    const currentProfiles = JSON.parse(localStorage.getItem('site_profiles'));
                    
                    // Prevent duplicate profile entries
                    if (!currentProfiles.includes(cleanName)) {
                        currentProfiles.push(cleanName);
                        localStorage.setItem('site_profiles', JSON.stringify(currentProfiles));
                    }
                    
                    // Activate and save the newly created name string
                    localStorage.setItem('uploader_name', cleanName);
                }
                
                // Refresh dropdown elements across the active tab interface
                renderProfileOptions(profileSelect);
            } else {
                // Save the selected standard profile string
                localStorage.setItem('uploader_name', selection);
            }

            // Sync layout grids instantly if rendering engines exist on tab
            if (typeof renderPrivateRecipes === 'function') renderPrivateRecipes();
            if (typeof renderCommunityRecipes === 'function') renderCommunityRecipes();
        });
    }
});

/**
 * Builds the inner option markup elements dynamically based on user's storage records.
 * @param {HTMLSelectElement} selectEl - The target layout dropdown element.
 */
function renderProfileOptions(selectEl) {
    const savedActiveName = localStorage.getItem('uploader_name') || '';
    const profilesList = JSON.parse(localStorage.getItem('site_profiles')) || [];
    
    // Wipe hardcoded values and build a clean dynamic baseline template framework layout
    selectEl.innerHTML = `
        <option value="" disabled ${!savedActiveName ? 'selected' : ''}>👤 Select Profile</option>
        ${profilesList.map(name => `<option value="${name}" ${savedActiveName === name ? 'selected' : ''}>👤 ${name}</option>`).join('')}
        <option value="ADD_NEW_PROFILE_ACTION" style="font-weight: 600; color: var(--primary);">➕ Add New Profile</option>
    `;
}
