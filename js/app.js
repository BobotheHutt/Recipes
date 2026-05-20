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

    setupNavbar();
    setupEditModal();

    window.addEventListener('hashchange', renderRoute);
    renderRoute();
}

// ---- Navbar (built once, never re-rendered) ----

function setupNavbar() {
    document.getElementById('settings-username').textContent = '👤 ' + SESSION.username;

    if (SESSION.isAdmin) {
        document.getElementById('admin-nav-link').style.display = '';
    }

    const themeSelect = document.getElementById('theme-select');
    themeSelect.value = (typeof getSavedTheme === 'function') ? getSavedTheme() : 'light';
    themeSelect.addEventListener('change', (e) => {
        if (typeof applyTheme === 'function') applyTheme(e.target.value);
    });

    const imagesToggle = document.getElementById('images-toggle');
    imagesToggle.checked = (typeof getShowImages === 'function') ? getShowImages() : true;
    imagesToggle.addEventListener('change', (e) => {
        if (typeof setShowImages === 'function') setShowImages(e.target.checked);
        // Re-render the current tab so cards show/hide images immediately
        renderRoute();
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
        grid.innerHTML = filtered.map(r => recipeCardHtml(r, `
            <button class="action-menu-item print-action">🖨️ Print</button>
            <button class="action-menu-item edit-action">✏️ Edit</button>
            <button class="action-menu-item danger delete-action">🗑️ Delete</button>
        `)).join('');
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
    const grid = document.getElementById('global-grid');
    grid.innerHTML = `<p class="empty-state">Loading community recipes...</p>`;

    communityRecipes = await getGlobalRecipes();

    const render = () => {
        const kw = document.getElementById('search-bar').value;
        const filtered = filterRecipes(communityRecipes, kw, category);
        if (filtered.length === 0) {
            grid.innerHTML = `<p class="empty-state">No matching community recipes found.</p>`;
            return;
        }
        grid.innerHTML = filtered.map(r => {
            const canManage = SESSION.isAdmin || r.uploader === SESSION.username;
            const manage = canManage ? `
                <button class="action-menu-item edit-action">✏️ Edit</button>
                <button class="action-menu-item danger delete-action">🗑️ Delete</button>
            ` : '';
            return recipeCardHtml(r, `
                <button class="action-menu-item print-action">🖨️ Print</button>
                <button class="action-menu-item save-action">📥 Add to Collection</button>
                ${manage}
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
        const recipe = communityRecipes.find(r => r.id === id);
        if (!recipe) return;

        if (target.classList.contains('print-action')) {
            closeAllMenus();
            printRecipeCard(card);
        } else if (target.classList.contains('save-action')) {
            closeAllMenus();
            try {
                await addMyRecipe(recipe);
                alert(`Added "${recipe.title}" to your collection!`);
            } catch (err) {
                alert("Couldn't add to your collection: " + err.message);
            }
        } else if (target.classList.contains('edit-action')) {
            closeAllMenus();
            openEditModal('explore', recipe);
        } else if (target.classList.contains('delete-action')) {
            closeAllMenus();
            if (!confirm(`Delete "${recipe.title}" from the community? This affects everyone.`)) return;
            try {
                await deleteFromCommunity(id);
                communityRecipes = communityRecipes.filter(r => r.id !== id);
                render();
            } catch (err) {
                alert("Couldn't delete: " + err.message);
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

    // Save to community (assigns id), then mirror into the user's collection.
    async function saveEverywhere(recipe) {
        const communityRecipe = await addToCommunity(recipe);
        try {
            await addMyRecipe(communityRecipe);
        } catch (err) {
            return { recipe: communityRecipe, personalSaved: false, error: err.message };
        }
        return { recipe: communityRecipe, personalSaved: true };
    }

    document.getElementById('manual-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ing = document.getElementById('manual-ingredients').value.split('\n').map(l => l.trim()).filter(Boolean);
        const inst = document.getElementById('manual-instructions').value.split('\n').map(l => l.trim()).filter(Boolean);
        const recipe = {
            title: document.getElementById('manual-title').value.trim(),
            category: document.getElementById('manual-category').value,
            prepTime: document.getElementById('manual-time').value.trim() || 'Unspecified',
            ingredients: ing,
            instructions: inst,
            sourceUrl: document.getElementById('manual-url').value.trim() || null,
            imageUrl: document.getElementById('manual-image').value.trim() || null
        };

        updateStatus("Saving...", "loading");
        try {
            const result = await saveEverywhere(recipe);
            if (result.personalSaved) {
                flashStatus(`🎉 Saved "${result.recipe.title}" to your collection and shared with the community!`, "success");
            } else {
                flashStatus(`Shared to the community, but adding to your collection failed: ${result.error}`, "error");
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
            const result = await saveEverywhere(parsedRecipe);
            if (result.personalSaved) {
                updateStatus(`🎉 Added "${result.recipe.title}" to your collection and the community!`, "success");
            } else {
                updateStatus(`Shared to the community, but adding to your collection failed: ${result.error}`, "error");
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
    const select = document.getElementById('reset-account');
    select.innerHTML = adminAccounts
        .filter(a => a.username.toLowerCase() !== 'admin')
        .map(a => `<option value="${escapeHtml(a.username)}">${escapeHtml(a.username)}</option>`)
        .join('');

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
    document.getElementById('edit-time').value = recipe.prepTime === 'Parsing...' ? '' : recipe.prepTime;
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
    const fields = {
        title: document.getElementById('edit-title').value.trim(),
        category: document.getElementById('edit-category').value,
        prepTime: document.getElementById('edit-time').value.trim() || 'Unspecified',
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
        if (updated.uploader && updated.uploader === SESSION.username) {
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
// If there are no candidate images, resolves immediately to null.
function pickImage(candidateImages) {
    return new Promise((resolve) => {
        const images = candidateImages || [];

        // Nothing to choose from — skip the modal entirely.
        if (images.length === 0) {
            resolve(null);
            return;
        }

        const modal = document.getElementById('image-modal');
        const choicesEl = document.getElementById('image-choices');
        const customInput = document.getElementById('image-custom');
        const confirmBtn = document.getElementById('image-confirm-btn');
        const skipBtn = document.getElementById('image-skip-btn');

        let selectedUrl = images[0]; // default to the first

        customInput.value = '';
        choicesEl.innerHTML = images.map((url, i) => `
            <button type="button" class="image-choice ${i === 0 ? 'selected' : ''}" data-url="${escapeHtml(url)}">
                <img src="${escapeHtml(url)}" alt="Option ${i + 1}" loading="lazy"
                     onerror="this.closest('.image-choice').style.display='none'">
            </button>
        `).join('');

        modal.classList.remove('hidden');

        function markSelected(el) {
            choicesEl.querySelectorAll('.image-choice').forEach(c => c.classList.remove('selected'));
            if (el) el.classList.add('selected');
        }

        function onChoiceClick(e) {
            const choice = e.target.closest('.image-choice');
            if (!choice) return;
            selectedUrl = choice.dataset.url;
            customInput.value = '';
            markSelected(choice);
        }

        function onCustomInput() {
            if (customInput.value.trim()) {
                markSelected(null);
                selectedUrl = customInput.value.trim();
            }
        }

        function cleanup() {
            modal.classList.add('hidden');
            choicesEl.removeEventListener('click', onChoiceClick);
            customInput.removeEventListener('input', onCustomInput);
            confirmBtn.removeEventListener('click', onConfirm);
            skipBtn.removeEventListener('click', onSkip);
        }

        function onConfirm() {
            const custom = customInput.value.trim();
            const result = custom || selectedUrl || null;
            cleanup();
            resolve(result);
        }

        function onSkip() {
            cleanup();
            resolve(null);
        }

        choicesEl.addEventListener('click', onChoiceClick);
        customInput.addEventListener('input', onCustomInput);
        confirmBtn.addEventListener('click', onConfirm);
        skipBtn.addEventListener('click', onSkip);
    });
}
