// js/app.js
// Single-page controller: builds the navbar once, then swaps tab content
// into #app-content without ever reloading the page.

let SESSION = null;          // { username, isAdmin }
let editContext = null;      // { mode: 'collection'|'explore', id }

// In-memory caches for the current session
let myRecipes = [];
let communityRecipes = [];
let adminAccounts = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Guard: must be logged in
    SESSION = await validateSession();
    if (!SESSION) {
        window.location.href = 'login.html';
        return;
    }

    // The cached theme was applied instantly on page load; now that we have
    // the live account preferences, apply the authoritative theme (corrects
    // the rare case where the cache was stale, e.g. first load on a device).
    applyTheme(getPrefs().theme || 'light');

    setupNavbar();
    setupEditModal();
    setupPasswordModal();

    window.addEventListener('hashchange', renderRoute);
    renderRoute();
}

// ---- Navbar (built once, never re-rendered) ----

function setupNavbar() {
    document.getElementById('settings-username').textContent = '👤 ' + SESSION.username;

    if (SESSION.isAdmin) {
        document.getElementById('admin-nav-link').style.display = '';
    }

    const prefs = getPrefs();

    // Theme
    const themeSelect = document.getElementById('theme-select');
    themeSelect.value = prefs.theme || 'light';
    themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        savePrefs({ theme: e.target.value });
    });

    // Show images
    const imagesToggle = document.getElementById('images-toggle');
    imagesToggle.checked = prefs.showImages !== false;
    imagesToggle.addEventListener('change', (e) => {
        savePrefs({ showImages: e.target.checked });
        renderRoute(); // re-render so cards show/hide images immediately
    });

    // Auto-share new recipes to community
    const autoShareToggle = document.getElementById('autoshare-toggle');
    autoShareToggle.checked = prefs.autoShare !== false;
    autoShareToggle.addEventListener('change', (e) => {
        savePrefs({ autoShare: e.target.checked });
    });

    document.getElementById('logout-btn').addEventListener('click', logout);

    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#settings-menu')) settingsPanel.classList.add('hidden');
    });
}

// ---- Router ----

function currentRoute() {
    const hash = (window.location.hash || '').replace('#', '');
    const valid = ['collection', 'explore', 'add', 'admin'];
    return valid.includes(hash) ? hash : 'collection';
}

function renderRoute() {
    const route = currentRoute();

    // Admin route is admin-only
    if (route === 'admin' && !SESSION.isAdmin) {
        window.location.hash = 'collection';
        return;
    }

    // Highlight the active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.route === route);
    });

    const content = document.getElementById('app-content');

    if (route === 'collection') {
        content.innerHTML = viewCollection();
        initCollection();
    } else if (route === 'explore') {
        content.innerHTML = viewExplore();
        initExplore();
    } else if (route === 'add') {
        content.innerHTML = viewAdd();
        initAdd();
    } else if (route === 'admin') {
        content.innerHTML = viewAdmin();
        initAdmin();
    }
}

// ---- Shared helpers ----

function filterRecipes(list, searchKeyword, category) {
    const kw = (searchKeyword || '').toLowerCase().trim();
    return list.filter(recipe => {
        const matchesCategory = (category === 'all' || recipe.category === category);
        const matchesSearch = !kw ||
            recipe.title.toLowerCase().includes(kw) ||
            recipe.category.toLowerCase().includes(kw) ||
            (recipe.ingredients || []).some(ing => ing.toLowerCase().includes(kw));
        return matchesCategory && matchesSearch;
    });
}

function closeAllMenus(scope) {
    (scope || document).querySelectorAll('.action-menu-panel')
        .forEach(p => p.classList.add('hidden'));
}

// One global handler: clicking outside any action menu closes open menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-menu')) closeAllMenus();
});

function printRecipeCard(cardEl) {
    const details = cardEl.querySelector('details');
    const wasOpen = details.hasAttribute('open');
    details.setAttribute('open', '');
    window.print();
    if (!wasOpen) details.removeAttribute('open');
}

// ==========================================================================
// COLLECTION TAB
// ==========================================================================

async function initCollection() {
    let category = 'all';
    const grid = document.getElementById('recipe-grid');
    grid.innerHTML = `<p class="empty-state">Loading your recipes...</p>`;

    try {
        myRecipes = await getMyRecipes();
    } catch (e) {
        grid.innerHTML = `<p class="empty-state">Couldn't load your recipes: ${escapeHtml(e.message)}</p>`;
        return;
    }

    const render = () => {
        const kw = document.getElementById('search-bar').value;
        const filtered = filterRecipes(myRecipes, kw, category);
        if (filtered.length === 0) {
            grid.innerHTML = `<p class="empty-state">No matching recipes in your collection.</p>`;
            return;
        }
        grid.innerHTML = filtered.map(r => {
            const shareItem = r.sharedToCommunity
                ? `<button class="action-menu-item unshare-action">🚫 Remove from Community</button>`
                : `<button class="action-menu-item share-action">📢 Share to Community</button>`;
            return recipeCardHtml(r, `
                <button class="action-menu-item print-action">🖨️ Print</button>
                <button class="action-menu-item edit-action">✏️ Edit</button>
                ${shareItem}
                <button class="action-menu-item danger delete-action">🗑️ Delete</button>
            `);
        }).join('');
    };

    document.getElementById('search-bar').addEventListener('input', render);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            category = e.target.dataset.category;
            render();
        });
    });

    grid.addEventListener('click', async (e) => {
        const target = e.target;
        const card = target.closest('.recipe-card');

        if (target.classList.contains('action-menu-btn')) {
            const panel = target.nextElementSibling;
            const hidden = panel.classList.contains('hidden');
            closeAllMenus();
            if (hidden) panel.classList.remove('hidden');
            return;
        }
        if (!card) return;
        const id = card.dataset.id;

        if (target.classList.contains('print-action')) {
            closeAllMenus();
            printRecipeCard(card);
        } else if (target.classList.contains('edit-action')) {
            closeAllMenus();
            const recipe = myRecipes.find(r => r.id === id);
            if (recipe) openEditModal('collection', recipe);
        } else if (target.classList.contains('share-action')) {
            closeAllMenus();
            const recipe = myRecipes.find(r => r.id === id);
            if (!recipe) return;
            try {
                // addToCommunity sends the recipe with its existing id; the
                // worker keeps that id so the two copies stay linked.
                await addToCommunity(recipe);
                recipe.sharedToCommunity = true;
                await updateMyRecipe(recipe.id, recipe);
                render();
                alert(`"${recipe.title}" is now shared with the community.`);
            } catch (err) {
                alert("Couldn't share: " + err.message);
            }
        } else if (target.classList.contains('unshare-action')) {
            closeAllMenus();
            const recipe = myRecipes.find(r => r.id === id);
            if (!recipe) return;
            if (!confirm(`Remove "${recipe.title}" from the community? It stays in your collection.`)) return;
            try {
                await deleteFromCommunity(recipe.id);
                recipe.sharedToCommunity = false;
                await updateMyRecipe(recipe.id, recipe);
                render();
            } catch (err) {
                alert("Couldn't remove from community: " + err.message);
            }
        } else if (target.classList.contains('delete-action')) {
            closeAllMenus();
            const recipe = myRecipes.find(r => r.id === id);
            if (!recipe) return;
            if (!confirm(`Delete "${recipe.title}" from your collection? (The community copy, if any, is not affected.)`)) return;
            try {
                await deleteMyRecipe(id);
                myRecipes = myRecipes.filter(r => r.id !== id);
                render();
            } catch (err) {
                alert("Couldn't delete: " + err.message);
            }
        }
    });

    render();
}

// ==========================================================================
// EXPLORE TAB
// ==========================================================================

async function initExplore() {
    let category = 'all';
    let profileFilter = 'all';
    const grid = document.getElementById('global-grid');
    grid.innerHTML = `<p class="empty-state">Loading community recipes...</p>`;

    communityRecipes = await getGlobalRecipes();

    // Populate the "Added by" profile dropdown from who actually has recipes
    const profileSelect = document.getElementById('profile-filter');
    const uploaders = [...new Set(communityRecipes.map(r => r.uploader).filter(Boolean))].sort();
    profileSelect.innerHTML = `<option value="all">Everyone</option>` +
        uploaders.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');

    const render = () => {
        const kw = document.getElementById('search-bar').value;
        let filtered = filterRecipes(communityRecipes, kw, category);
        if (profileFilter !== 'all') {
            filtered = filtered.filter(r => r.uploader === profileFilter);
        }
        if (filtered.length === 0) {
            grid.innerHTML = `<p class="empty-state">No matching community recipes found.</p>`;
            return;
        }
        grid.innerHTML = filtered.map(r => {
            const owns = r.uploader === SESSION.username;
            const canManage = SESSION.isAdmin || owns;
            let manage = '';
            if (canManage) {
                manage += `<button class="action-menu-item edit-action">✏️ Edit</button>`;
                manage += `<button class="action-menu-item danger remove-action">🚫 Remove from Community</button>`;
            }
            return recipeCardHtml(r, `
                <button class="action-menu-item print-action">🖨️ Print</button>
                <button class="action-menu-item save-action">📥 Add to Collection</button>
                ${manage}
            `);
        }).join('');
    };

    document.getElementById('search-bar').addEventListener('input', render);
    profileSelect.addEventListener('change', (e) => {
        profileFilter = e.target.value;
        render();
    });
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            category = e.target.dataset.category;
            render();
        });
    });

    grid.addEventListener('click', async (e) => {
        const target = e.target;
        const card = target.closest('.recipe-card');

        if (target.classList.contains('action-menu-btn')) {
            const panel = target.nextElementSibling;
            const hidden = panel.classList.contains('hidden');
            closeAllMenus();
            if (hidden) panel.classList.remove('hidden');
            return;
        }
        if (!card) return;
        const id = card.dataset.id;
        const recipe = communityRecipes.find(r => r.id === id);
        if (!recipe) return;

        if (target.classList.contains('print-action')) {
            closeAllMenus();
            printRecipeCard(card);
        } else if (target.classList.contains('save-action')) {
            closeAllMenus();
            try {
                if (recipe.uploader === SESSION.username) {
                    // It's the user's own community recipe — keep the same id
                    // so the collection and community copies stay linked.
                    await addMyRecipe(recipe);
                } else {
                    // Grabbing someone else's recipe: copy it as a brand-new
                    // recipe of the user's own — fresh id, not shared, owned
                    // by them — so they can rework it and share their version
                    // separately without touching the community original.
                    const copy = { ...recipe };
                    delete copy.id;          // worker mints a new id
                    delete copy.createdAt;   // worker stamps a new date
                    copy.sharedToCommunity = false;
                    copy.uploader = SESSION.username;
                    await addMyRecipe(copy);
                }
                alert(`Added "${recipe.title}" to your collection!`);
            } catch (err) {
                alert("Couldn't add to your collection: " + err.message);
            }
        } else if (target.classList.contains('edit-action')) {
            closeAllMenus();
            openEditModal('explore', recipe);
        } else if (target.classList.contains('remove-action')) {
            closeAllMenus();
            const whose = recipe.uploader === SESSION.username
                ? 'the community'
                : `the community (recipe by ${recipe.uploader})`;
            if (!confirm(`Remove "${recipe.title}" from ${whose}? This affects everyone. The owner's personal copy is not affected.`)) return;
            try {
                await deleteFromCommunity(id);
                communityRecipes = communityRecipes.filter(r => r.id !== id);
                render();
            } catch (err) {
                alert("Couldn't remove from community: " + err.message);
            }
        }
    });

    render();
}

// ==========================================================================
// ADD TAB
// ==========================================================================

function initAdd() {
    const statusBox = () => document.getElementById('status-message');

    function updateStatus(msg, type) {
        const box = statusBox();
        box.innerText = msg;
        box.className = `status-box ${type}`;
    }
    function flashStatus(msg, type) {
        updateStatus(msg, type);
        setTimeout(() => { statusBox().className = 'status-box hidden'; }, 6000);
    }

    document.getElementById('toggle-ai').addEventListener('click', () => {
        document.getElementById('toggle-ai').classList.add('active');
        document.getElementById('toggle-manual').classList.remove('active');
        document.getElementById('ai-view').classList.remove('hidden');
        document.getElementById('manual-view').classList.add('hidden');
    });
    document.getElementById('toggle-manual').addEventListener('click', () => {
        document.getElementById('toggle-manual').classList.add('active');
        document.getElementById('toggle-ai').classList.remove('active');
        document.getElementById('manual-view').classList.remove('hidden');
        document.getElementById('ai-view').classList.add('hidden');
    });

    // Save a new recipe. If auto-share is on, it goes to the community AND
    // the personal collection. If off, personal collection only.
    async function saveNewRecipe(recipe) {
        const autoShare = getPrefs().autoShare !== false;

        if (autoShare) {
            // Community save assigns the id; mirror that exact recipe personally.
            const communityRecipe = await addToCommunity(recipe);
            communityRecipe.sharedToCommunity = true;
            try {
                await addMyRecipe(communityRecipe);
            } catch (err) {
                return { recipe: communityRecipe, personalSaved: false, shared: true, error: err.message };
            }
            return { recipe: communityRecipe, personalSaved: true, shared: true };
        } else {
            // Personal only — the worker assigns an id on add.
            recipe.sharedToCommunity = false;
            const saved = await addMyRecipe(recipe);
            return { recipe: saved, personalSaved: true, shared: false };
        }
    }

    document.getElementById('manual-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ing = document.getElementById('manual-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
        const inst = document.getElementById('manual-instructions').value.split('\n').map(l => l.trim()).filter(Boolean);
        const timeVal = parseInt(document.getElementById('manual-time').value, 10);
        const recipe = {
            title: document.getElementById('manual-title').value.trim(),
            category: document.getElementById('manual-category').value,
            totalTime: isNaN(timeVal) ? null : timeVal,
            description: document.getElementById('manual-description').value.trim() || null,
            ingredients: ing,
            instructions: inst,
            sourceUrl: document.getElementById('manual-url').value.trim() || null,
            imageUrl: document.getElementById('manual-image').value.trim() || null
        };

        updateStatus("Saving...", "loading");
        try {
            const result = await saveNewRecipe(recipe);
            if (!result.personalSaved) {
                flashStatus(`Shared to the community, but adding to your collection failed: ${result.error}`, "error");
            } else if (result.shared) {
                flashStatus(`🎉 Saved "${result.recipe.title}" to your collection and shared with the community!`, "success");
            } else {
                flashStatus(`🎉 Saved "${result.recipe.title}" to your collection. (Not shared — you can share it anytime from My Collection.)`, "success");
            }
            document.getElementById('manual-form').reset();
        } catch (err) {
            flashStatus(`Couldn't save: ${err.message}`, "error");
        }
    });

    document.getElementById('submit-btn').addEventListener('click', async () => {
        const inputField = document.getElementById('recipe-input');
        const inputData = inputField.value.trim();
        if (!inputData) { flashStatus("Please enter a URL or paste text before parsing.", "error"); return; }

        updateStatus("Parsing with AI...", "loading");
        try {
            const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/parse`, {
                method: 'POST',
                headers: AUTH.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ recipeText: inputData })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Parser returned ${response.status}`);

            const rawJsonText = data.candidates[0].content.parts[0].text;
            const parsedRecipe = JSON.parse(rawJsonText.replace(/```json|```/g, ''));
            const candidateImages = data.candidateImages || [];

            // If the page offered photos, let the user pick one first.
            const chosenImage = await pickImage(candidateImages);
            if (chosenImage) parsedRecipe.imageUrl = chosenImage;

            updateStatus("Saving...", "loading");
            const result = await saveNewRecipe(parsedRecipe);
            if (!result.personalSaved) {
                updateStatus(`Shared to the community, but adding to your collection failed: ${result.error}`, "error");
            } else if (result.shared) {
                updateStatus(`🎉 Added "${result.recipe.title}" to your collection and the community!`, "success");
            } else {
                updateStatus(`🎉 Added "${result.recipe.title}" to your collection. (Not shared — you can share it anytime from My Collection.)`, "success");
            }
            inputField.value = "";
        } catch (error) {
            console.error(error);
            updateStatus(`Couldn't parse that recipe: ${error.message}`, "error");
        }
    });
}

// ==========================================================================
// ADMIN TAB
// ==========================================================================

async function initAdmin() {
    const statusBox = () => document.getElementById('status-message');
    function showStatus(msg, type) {
        const box = statusBox();
        box.innerText = msg;
        box.className = `status-box ${type}`;
    }

    try {
        const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/accounts`, {
            headers: AUTH.headers()
        });
        if (!res.ok) throw new Error('Could not load accounts');
        adminAccounts = await res.json();
    } catch (e) {
        showStatus(e.message, "error");
        return;
    }

    // Reset dropdown — exclude the built-in Admin account (its password is the secret)
    const nonAdmin = adminAccounts.filter(a => a.username.toLowerCase() !== 'admin');
    const optionsHtml = nonAdmin
        .map(a => `<option value="${escapeHtml(a.username)}">${escapeHtml(a.username)}</option>`)
        .join('');

    document.getElementById('reset-account').innerHTML = optionsHtml;
    document.getElementById('rename-account').innerHTML = optionsHtml;
    document.getElementById('delete-account').innerHTML = optionsHtml;

    const grid = document.getElementById('account-list');
    if (adminAccounts.length === 0) {
        grid.innerHTML = `<p class="empty-state">No accounts yet.</p>`;
    } else {
        grid.innerHTML = adminAccounts.map(a => {
            const created = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : 'unknown';
            return `
                <div class="recipe-card">
                    <h3>${escapeHtml(a.username)}</h3>
                    <p class="meta-info">${a.isAdmin ? '🔑 Admin' : '👤 Member'}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted);">Joined: ${created}</p>
                </div>
            `;
        }).join('');
    }

    document.getElementById('reset-btn').addEventListener('click', async () => {
        const targetUsername = document.getElementById('reset-account').value;
        const newPassword = document.getElementById('reset-password').value;
        if (!targetUsername) { showStatus("Pick an account.", "error"); return; }
        if (!newPassword || newPassword.length < 4) {
            showStatus("New password must be at least 4 characters.", "error");
            return;
        }
        showStatus("Resetting...", "loading");
        try {
            const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/reset-password`, {
                method: 'POST',
                headers: AUTH.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ targetUsername, newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Reset failed');
            showStatus(`Password for "${targetUsername}" is now: ${newPassword}`, "success");
            document.getElementById('reset-password').value = '';
        } catch (e) {
            showStatus(e.message, "error");
        }
    });

    document.getElementById('rename-btn').addEventListener('click', async () => {
        const oldUsername = document.getElementById('rename-account').value;
        const newUsername = document.getElementById('rename-newname').value.trim();
        if (!oldUsername) { showStatus("Pick an account.", "error"); return; }
        if (!newUsername) { showStatus("Enter a new name.", "error"); return; }
        if (!confirm(`Rename "${oldUsername}" to "${newUsername}"? They'll need to log in again with the new name.`)) return;

        showStatus("Renaming...", "loading");
        try {
            const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/rename-account`, {
                method: 'POST',
                headers: AUTH.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ oldUsername, newUsername })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Rename failed');
            showStatus(`Renamed to "${data.newUsername}". They should log in again with the new name.`, "success");
            await initAdmin();  // refresh the lists
        } catch (e) {
            showStatus(e.message, "error");
        }
    });

    document.getElementById('delete-btn').addEventListener('click', async () => {
        const targetUsername = document.getElementById('delete-account').value;
        const deleteCommunityRecipes = document.getElementById('delete-community').checked;
        if (!targetUsername) { showStatus("Pick an account.", "error"); return; }

        const extra = deleteCommunityRecipes
            ? "Their community recipes will ALSO be deleted."
            : "Their community recipes will stay (under their name).";
        if (!confirm(`Delete account "${targetUsername}"?\n\n${extra}\n\nThis cannot be undone.`)) return;

        showStatus("Deleting...", "loading");
        try {
            const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/delete-account`, {
                method: 'POST',
                headers: AUTH.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ targetUsername, deleteCommunityRecipes })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            const note = deleteCommunityRecipes
                ? ` ${data.deletedCommunityRecipes} community recipe(s) removed.`
                : '';
            showStatus(`Account "${targetUsername}" deleted.${note}`, "success");
            await initAdmin();  // refresh the lists
        } catch (e) {
            showStatus(e.message, "error");
        }
    });
}

// ==========================================================================
// SHARED EDIT MODAL
// ==========================================================================

function setupEditModal() {
    document.getElementById('close-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-form').addEventListener('submit', handleEditSave);
}

function openEditModal(mode, recipe) {
    editContext = { mode, id: recipe.id };
    document.getElementById('edit-modal-title').textContent =
        mode === 'explore' ? '📝 Edit Community Recipe' : '📝 Edit Recipe';
    document.getElementById('edit-modal-note').textContent =
        mode === 'explore'
            ? 'Changes go directly to the community for everyone.'
            : 'If this recipe is also shared to the community and you own it, your edits sync there too.';
    document.getElementById('edit-title').value = recipe.title;
    document.getElementById('edit-category').value = recipe.category;
    // Time: use totalTime, or pull a number out of a legacy prepTime string
    let timeVal = recipe.totalTime;
    if (timeVal == null && recipe.prepTime) {
        const n = parseInt(String(recipe.prepTime).match(/\d+/), 10);
        timeVal = isNaN(n) ? '' : n;
    }
    document.getElementById('edit-time').value = (timeVal == null ? '' : timeVal);
    document.getElementById('edit-description').value = recipe.description || '';
    document.getElementById('edit-ingredients').value = (recipe.ingredients || []).join('\n');
    document.getElementById('edit-instructions').value = (recipe.instructions || []).join('\n');
    document.getElementById('edit-image').value = recipe.imageUrl || '';
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    editContext = null;
}

async function handleEditSave(e) {
    e.preventDefault();
    if (!editContext) return;

    const ing = document.getElementById('edit-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
    const inst = document.getElementById('edit-instructions').value.split('\n').map(l => l.trim()).filter(Boolean);
    const editTimeVal = parseInt(document.getElementById('edit-time').value, 10);
    const fields = {
        title: document.getElementById('edit-title').value.trim(),
        category: document.getElementById('edit-category').value,
        totalTime: isNaN(editTimeVal) ? null : editTimeVal,
        description: document.getElementById('edit-description').value.trim() || null,
        ingredients: ing,
        instructions: inst,
        imageUrl: document.getElementById('edit-image').value.trim() || null
    };

    if (editContext.mode === 'collection') {
        const original = myRecipes.find(r => r.id === editContext.id);
        if (!original) { closeEditModal(); return; }
        const updated = { ...original, ...fields };

        try {
            const saved = await updateMyRecipe(updated.id, updated);
            const idx = myRecipes.findIndex(r => r.id === saved.id);
            if (idx !== -1) myRecipes[idx] = saved;
        } catch (err) {
            alert("Couldn't save changes: " + err.message);
            return;
        }

        let syncMessage = "";
        if (updated.sharedToCommunity && updated.uploader === SESSION.username) {
            try {
                await updateInCommunity(updated.id, updated);
                syncMessage = " Community copy also updated.";
            } catch (err) {
                if (!/not found/i.test(err.message)) {
                    syncMessage = ` (Saved, but community sync failed: ${err.message})`;
                }
            }
        }
        closeEditModal();
        if (currentRoute() === 'collection') renderRoute();
        alert("Recipe updated!" + syncMessage);

    } else {
        // explore mode
        const original = communityRecipes.find(r => r.id === editContext.id);
        if (!original) { closeEditModal(); return; }
        const updated = { ...original, ...fields };

        try {
            const saved = await updateInCommunity(updated.id, updated);
            const idx = communityRecipes.findIndex(r => r.id === saved.id);
            if (idx !== -1) communityRecipes[idx] = saved;
        } catch (err) {
            alert("Couldn't save changes: " + err.message);
            return;
        }
        closeEditModal();
        if (currentRoute() === 'explore') renderRoute();
    }
}

// ==========================================================================
// IMAGE PICKER MODAL
// ==========================================================================

// Show the image picker. Resolves to a chosen image URL, or null (skip / none).
// Builds its own overlay with inline styles so it depends on no external CSS
// or pre-placed HTML — nothing to be missing, stale, or out of order.
function pickImage(candidateImages) {
    return new Promise((resolve) => {
        const images = candidateImages || [];
        if (images.length === 0) {
            resolve(null);
            return;
        }

        let selectedUrl = images[0];

        // ---- overlay ----
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px);' +
            'display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;';

        // ---- box ----
        const box = document.createElement('div');
        box.style.cssText =
            'background:var(--bg-card,#fff); color:var(--text-main,#1f2937); border-radius:12px;' +
            'padding:28px; max-width:640px; width:100%; max-height:85vh; overflow-y:auto;' +
            'box-shadow:0 20px 40px -10px rgba(0,0,0,0.4);';

        const heading = document.createElement('h3');
        heading.textContent = '🖼️ Choose a Photo';
        heading.style.cssText = 'margin:0 0 8px; font-size:1.3rem;';

        const sub = document.createElement('p');
        sub.textContent = 'Pick a photo for this recipe, paste your own image link, or skip.';
        sub.style.cssText = 'margin:0 0 18px; font-size:0.85rem; color:var(--text-muted,#666);';

        // ---- thumbnail grid ----
        const grid = document.createElement('div');
        grid.style.cssText =
            'display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px;';

        const thumbs = [];
        images.forEach((url, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText =
                'padding:0; border:3px solid transparent; border-radius:8px; overflow:hidden;' +
                'cursor:pointer; background:var(--bg-main,#f3f3f3); height:120px;';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Option ' + (i + 1);
            img.loading = 'lazy';
            img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
            img.onerror = () => { btn.style.display = 'none'; };
            btn.appendChild(img);
            btn.addEventListener('click', () => {
                selectedUrl = url;
                customInput.value = '';
                highlight(btn);
            });
            grid.appendChild(btn);
            thumbs.push(btn);
        });

        function highlight(activeBtn) {
            thumbs.forEach(b => { b.style.borderColor = 'transparent'; });
            if (activeBtn) activeBtn.style.borderColor = 'var(--primary,#10b981)';
        }
        highlight(thumbs[0]);

        // ---- custom URL field ----
        const customLabel = document.createElement('label');
        customLabel.textContent = 'Or paste your own image link';
        customLabel.style.cssText =
            'display:block; margin:18px 0 6px; font-weight:600; font-size:0.85rem;';

        const customInput = document.createElement('input');
        customInput.type = 'url';
        customInput.placeholder = 'https://site.com/photo.jpg';
        customInput.style.cssText =
            'width:100%; padding:12px; font-size:1rem; border-radius:8px;' +
            'border:1px solid var(--border,#ccc); background:var(--bg-main,#fafafa);' +
            'color:var(--text-main,#1f2937); outline:none; box-sizing:border-box;';
        customInput.addEventListener('input', () => {
            if (customInput.value.trim()) {
                highlight(null);
                selectedUrl = customInput.value.trim();
            }
        });

        // ---- action buttons ----
        const actions = document.createElement('div');
        actions.style.cssText =
            'display:flex; justify-content:flex-end; gap:8px; margin-top:22px;';

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.textContent = 'Skip — no image';
        skipBtn.style.cssText =
            'padding:10px 18px; border-radius:8px; border:1px solid var(--border,#ccc);' +
            'background:transparent; color:var(--text-muted,#666); cursor:pointer;';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = 'Use selected photo';
        confirmBtn.style.cssText =
            'padding:10px 18px; border-radius:8px; border:none;' +
            'background:var(--primary,#10b981); color:#fff; font-weight:500; cursor:pointer;';

        function finish(result) {
            document.body.removeChild(overlay);
            resolve(result);
        }
        skipBtn.addEventListener('click', () => finish(null));
        confirmBtn.addEventListener('click', () => {
            const custom = customInput.value.trim();
            finish(custom || selectedUrl || null);
        });

        actions.appendChild(skipBtn);
        actions.appendChild(confirmBtn);

        box.appendChild(heading);
        box.appendChild(sub);
        box.appendChild(grid);
        box.appendChild(customLabel);
        box.appendChild(customInput);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}

// ==========================================================================
// CHANGE PASSWORD MODAL
// ==========================================================================

function setupPasswordModal() {
    const modal = document.getElementById('password-modal');
    const openBtn = document.getElementById('change-password-btn');
    const closeBtn = document.getElementById('close-password-btn');
    const form = document.getElementById('password-form');
    const statusBox = document.getElementById('password-status');

    function showStatus(msg, type) {
        statusBox.innerText = msg;
        statusBox.className = `status-box ${type}`;
    }
    function clearStatus() {
        statusBox.className = 'status-box hidden';
    }
    function resetForm() {
        form.reset();
        clearStatus();
        // reset any revealed password fields back to hidden
        modal.querySelectorAll('input[type="text"]').forEach(inp => {
            if (['pw-current', 'pw-new', 'pw-new2'].includes(inp.id)) inp.type = 'password';
        });
        modal.querySelectorAll('.password-toggle').forEach(btn => { btn.textContent = '👁️'; });
    }

    openBtn.addEventListener('click', () => {
        document.getElementById('settings-panel').classList.add('hidden');
        resetForm();
        modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        resetForm();
    });

    // Eye toggles inside this modal
    modal.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            btn.textContent = showing ? '👁️' : '🙈';
            btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('pw-current').value;
        const newPassword = document.getElementById('pw-new').value;
        const newPassword2 = document.getElementById('pw-new2').value;

        if (newPassword.length < 4) {
            showStatus('New password must be at least 4 characters.', 'error');
            return;
        }
        if (newPassword !== newPassword2) {
            showStatus("The two new passwords don't match.", 'error');
            return;
        }

        showStatus('Changing...', 'loading');
        try {
            const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/auth/change-password`, {
                method: 'POST',
                headers: AUTH.headers({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not change password');

            showStatus('Password changed successfully.', 'success');
            setTimeout(() => {
                modal.classList.add('hidden');
                resetForm();
            }, 1500);
        } catch (err) {
            showStatus(err.message, 'error');
        }
    });
}
