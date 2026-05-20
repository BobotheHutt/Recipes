// js/profiles.js

function initializeProfileDropdown() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    if (document.getElementById('profile-select')) return;

    const profileSelect = document.createElement('select');
    profileSelect.id = 'profile-select';
    profileSelect.style.cssText = 'margin-left: auto; padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); cursor: pointer; outline: none;';

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect && themeSelect.parentNode) {
        themeSelect.parentNode.insertBefore(profileSelect, themeSelect);
    } else {
        navbar.appendChild(profileSelect);
    }

    createProfileModalMarkup();

    if (!localStorage.getItem('uploader_name')) {
        localStorage.setItem('uploader_name', 'Guest');
    }
    if (!localStorage.getItem('site_profiles')) {
        localStorage.setItem('site_profiles', JSON.stringify([]));
    }

    renderProfileOptions(profileSelect);

    profileSelect.addEventListener('change', async (e) => {
        const selection = e.target.value;

        if (selection === 'ADD_NEW_PROFILE_ACTION') {
            const modal = document.getElementById('custom-profile-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.getElementById('new-profile-name-input').focus();
            }
            profileSelect.value = localStorage.getItem('uploader_name') || "Guest";
        } else if (selection === 'ADMIN_LOGIN_ACTION') {
            await handleAdminLogin(profileSelect);
        } else {
            // Switching to a non-admin profile clears any admin session
            if (sessionStorage.getItem('admin_password')) {
                sessionStorage.removeItem('admin_password');
            }
            localStorage.setItem('uploader_name', selection);
            renderProfileOptions(profileSelect);
            triggerPageGridUpdates();
        }
    });

    setupProfileModalActions(profileSelect);
}

async function handleAdminLogin(profileSelect) {
    const previous = localStorage.getItem('uploader_name') || 'Guest';
    const password = prompt("Enter admin password:");

    if (!password) {
        profileSelect.value = previous;
        return;
    }

    try {
        const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            sessionStorage.setItem('admin_password', password);
            localStorage.setItem('uploader_name', 'Admin');
            renderProfileOptions(profileSelect);
            triggerPageGridUpdates();
        } else {
            alert("Wrong password.");
            profileSelect.value = previous;
        }
    } catch (err) {
        alert("Couldn't reach the server to verify the password: " + err.message);
        profileSelect.value = previous;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfileDropdown);
} else {
    initializeProfileDropdown();
}

function renderProfileOptions(selectEl) {
    const savedActiveName = localStorage.getItem('uploader_name') || 'Guest';
    const adminActive = !!sessionStorage.getItem('admin_password');
    const profilesList = JSON.parse(localStorage.getItem('site_profiles')) || [];

    // If profile is "Admin" but session was cleared (e.g. browser closed), drop back to Guest
    if (savedActiveName === 'Admin' && !adminActive) {
        localStorage.setItem('uploader_name', 'Guest');
    }

    const activeName = localStorage.getItem('uploader_name') || 'Guest';

    selectEl.innerHTML = `
        <option value="Guest" ${activeName === 'Guest' ? 'selected' : ''}>👤 Guest</option>
        ${profilesList.map(name => `<option value="${name}" ${activeName === name ? 'selected' : ''}>👤 ${name}</option>`).join('')}
        <option value="ADD_NEW_PROFILE_ACTION" style="font-weight: 600; color: var(--primary);">➕ Add New Profile</option>
        <option value="ADMIN_LOGIN_ACTION" ${activeName === 'Admin' ? 'selected' : ''} style="font-weight: 600;">${activeName === 'Admin' ? '🔐 Admin (active)' : '🔐 Admin Mode'}</option>
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
        if (!cleanName) return;

        const lower = cleanName.toLowerCase();
        if (lower === 'guest' || lower === 'admin') {
            alert("That profile name is reserved. Try another.");
            return;
        }

        const currentProfiles = JSON.parse(localStorage.getItem('site_profiles')) || [];
        if (!currentProfiles.includes(cleanName)) {
            currentProfiles.push(cleanName);
            localStorage.setItem('site_profiles', JSON.stringify(currentProfiles));
        }

        // Switching profile clears any admin session
        sessionStorage.removeItem('admin_password');
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
