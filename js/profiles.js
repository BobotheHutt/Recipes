// js/profiles.js

function initializeProfileDropdown() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Check if the dropdown already exists to prevent duplicate injections
    if (document.getElementById('profile-select')) return;

    // 1. Build and append the profile select dropdown dynamically into the navigation bar
    const profileSelect = document.createElement('select');
    profileSelect.id = 'profile-select';
    profileSelect.style.cssText = 'margin-left: auto; padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); cursor: pointer; outline: none;';
    
    // Put it right before the theme selector box if the theme box is already attached to the navbar
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && themeSelect.parentNode) {
        themeSelect.parentNode.insertBefore(profileSelect, themeSelect);
    } else {
        navbar.appendChild(profileSelect);
    }

    // 2. Build the pop-up name input modal window container invisibly inside the page body
    createProfileModalMarkup();

    // 3. Set up the baseline data structures inside your browser memory cache
    if (!localStorage.getItem('uploader_name')) {
        localStorage.setItem('uploader_name', 'Guest');
    }
    if (!localStorage.getItem('site_profiles')) {
        localStorage.setItem('site_profiles', JSON.stringify([]));
    }

    // 4. Render options structure tree layout array data
    renderProfileOptions(profileSelect);

    // 5. Setup dynamic selection menu click triggers
    profileSelect.addEventListener('change', (e) => {
        const selection = e.target.value;

        if (selection === 'ADD_NEW_PROFILE_ACTION') {
            const modal = document.getElementById('custom-profile-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.getElementById('new-profile-name-input').focus();
            }
            profileSelect.value = localStorage.getItem('uploader_name') || "Guest";
        } else {
            localStorage.setItem('uploader_name', selection);
            triggerPageGridUpdates();
        }
    });

    setupProfileModalActions(profileSelect);
}

// Ensure the code fires regardless of script tag loading speeds
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfileDropdown);
} else {
    initializeProfileDropdown();
}

function renderProfileOptions(selectEl) {
    const savedActiveName = localStorage.getItem('uploader_name') || 'Guest';
    const profilesList = JSON.parse(localStorage.getItem('site_profiles')) || [];
    
    selectEl.innerHTML = `
        <option value="Guest" ${savedActiveName === 'Guest' ? 'selected' : ''}>👤 Guest</option>
        ${profilesList.map(name => `<option value="${name}" ${savedActiveName === name ? 'selected' : ''}>👤 ${name}</option>`).join('')}
        <option value="ADD_NEW_PROFILE_ACTION" style="font-weight: 600; color: var(--primary);">➕ Add New Profile</option>
    `;
}

function createProfileModalMarkup() {
    if (document.getElementById('custom-profile-modal')) return;
    
    const modalDiv = document.createElement('div');
    modalDiv.id = 'custom-profile-modal';
    
    modalDiv.style.position = 'fixed';
    modalDiv.style.top = '0';
    modalDiv.style.left = '0';
    modalDiv.style.width = '100%';
    modalDiv.style.height = '100%';
    modalDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalDiv.style.backdropFilter = 'blur(4px)';
    modalDiv.style.display = 'none'; 
    modalDiv.style.justifyContent = 'center';
    modalDiv.style.alignItems = 'center';
    modalDiv.style.zIndex = '9999';

    modalDiv.innerHTML = `
        <div style="background: var(--bg-card, #ffffff); color: var(--text-main, #1f2937); padding: 32px; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
            <h3 style="margin-bottom: 12px; font-size: 1.4rem;">➕ Add New Profile</h3>
            <div style="margin-bottom: 20px;">
                <label style="display:block; margin-bottom:6px; font-weight:600; font-size:0.9rem;">Profile Name</label>
                <input type="text" id="new-profile-name-input" placeholder="e.g., Sarah, Mom" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:1rem; background: var(--bg-main, #f9fafb); color: var(--text-main, #1f2937);">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" id="cancel-profile-modal-btn" style="padding: 10px 20px; border-radius: 8px; cursor: pointer; border: none; background: transparent; color: #4b5563;">Cancel</button>
                <button type="button" id="save-profile-modal-btn" style="padding: 10px 20px; border-radius: 8px; cursor: pointer; border: none; background: #10b981; color: white; font-weight: 500;">Create</button>
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

    if (!modal || !cancelBtn || !saveBtn) return;

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        input.value = "";
    });

    saveBtn.addEventListener('click', () => {
        const cleanName = input.value.trim();
        if (!cleanName || cleanName.toLowerCase() === 'guest') return;

        const currentProfiles = JSON.parse(localStorage.getItem('site_profiles')) || [];
        if (!currentProfiles.includes(cleanName)) {
            currentProfiles.push(cleanName);
            localStorage.setItem('site_profiles', JSON.stringify(currentProfiles));
        }

        localStorage.setItem('uploader_name', cleanName);
        renderProfileOptions(profileSelectEl);
        triggerPageGridUpdates();

        modal.style.display = 'none';
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
