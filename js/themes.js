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

    // FIXED: Moved this into the DOMContentLoaded block so document.body is guaranteed to exist!
    createProfileModalMarkup();

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
        if (!localStorage.getItem('site_profiles')) {
            localStorage.setItem('site_profiles', JSON.stringify([]));
        }

        renderProfileOptions(profileSelect);

        profileSelect.addEventListener('change', (e) => {
            const selection = e.target.value;

            if (selection === 'ADD_NEW_PROFILE_ACTION') {
                // Open our custom clean overlay modal box layout framework safely
                document.getElementById('custom-profile-modal').classList.remove('hidden');
                document.getElementById('new-profile-name-input').focus();
                profileSelect.value = localStorage.getItem('uploader_name') || "";
            } else {
                localStorage.setItem('uploader_name', selection);
                triggerPageGridUpdates();
            }
        });
    }

    setupProfileModalActions(profileSelect);
});

function renderProfileOptions(selectEl) {
    const savedActiveName = localStorage.getItem('uploader_name') || '';
    const profilesList = JSON.parse(localStorage.getItem('site_profiles')) || [];
    
    selectEl.innerHTML = `
        <option value="" disabled ${!savedActiveName ? 'selected' : ''}>👤 Select Profile</option>
        ${profilesList.map(name => `<option value="${name}" ${savedActiveName === name ? 'selected' : ''}>👤 ${name}</option>`).join('')}
        <option value="ADD_NEW_PROFILE_ACTION" style="font-weight: 600; color: var(--primary);">➕ Add New Profile</option>
    `;
}

function createProfileModalMarkup() {
    if (document.getElementById('custom-profile-modal')) return;
    
    const modalDiv = document.createElement('div');
    modalDiv.id = 'custom-profile-modal';
    modalDiv.className = 'modal-overlay hidden';
    modalDiv.innerHTML = `
        <div class="modal-content" style="padding: 24px;">
            <h3 style="margin-bottom: 12px;">➕ Add New Profile</h3>
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="display:block; margin-bottom:6px; font-weight:600; font-size:0.9rem;">Profile Name</label>
                <input type="text" id="new-profile-name-input" placeholder="e.g., Sarah, Mom" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--bg-main); color:var(--text-main); outline:none;">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" id="cancel-profile-modal-btn" class="text-btn" style="padding: 8px 16px;">Cancel</button>
                <button type="button" id="save-profile-modal-btn" class="primary-btn" style="padding: 8px 16px;">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
}

function setupProfileModalActions(profileSelectEl) {
    const modal = document.getElementById('custom-profile-modal');
    const input = document.getElementById('new-profile-name-input');
    const cancelBtn = document.getElementById('cancel-profile-modal-btn');
    const saveBtn = document.getElementById('save-profile-modal-btn');

    // Prevent crashing bugs if the script triggers layout render errors
    if (!modal || !cancelBtn || !saveBtn) return;

    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        input.value = "";
    });

    saveBtn.addEventListener('click', () => {
        const cleanName = input.value.trim();
        if (!cleanName) return;

        const currentProfiles = JSON.parse(localStorage.getItem('site_profiles')) || [];
        if (!currentProfiles.includes(cleanName)) {
            currentProfiles.push(cleanName);
            localStorage.setItem('site_profiles', JSON.stringify(currentProfiles));
        }

        localStorage.setItem('uploader_name', cleanName);
        renderProfileOptions(profileSelectEl);
        triggerPageGridUpdates();

        modal.classList.add('hidden');
        input.value = "";
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        }
    });
}

function triggerPageGridUpdates() {
    if (typeof renderPrivateRecipes === 'function') renderPrivateRecipes();
    if (typeof renderCommunityRecipes === 'function') renderCommunityRecipes();
}
