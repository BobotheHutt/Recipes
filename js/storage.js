// js/storage.js

// Ensure local storage exists
if (!localStorage.getItem('my_recipes')) {
    localStorage.setItem('my_recipes', JSON.stringify([]));
}

// ---------- Local (per-device) recipes ----------

function getRecipes() {
    return JSON.parse(localStorage.getItem('my_recipes'));
}

function saveRecipe(recipeObj) {
    const current = getRecipes();
    current.push(recipeObj);
    localStorage.setItem('my_recipes', JSON.stringify(current));
}

function updateLocalRecipe(index, recipeObj) {
    const current = getRecipes();
    current[index] = recipeObj;
    localStorage.setItem('my_recipes', JSON.stringify(current));
}

function deleteLocalRecipe(index) {
    const current = getRecipes();
    current.splice(index, 1);
    localStorage.setItem('my_recipes', JSON.stringify(current));
}

// ---------- Admin helpers ----------

function getAdminPassword() {
    return sessionStorage.getItem('admin_password');
}

function isAdminMode() {
    return !!getAdminPassword();
}

async function verifyAdminPassword(password) {
    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    return response.ok;
}

// ---------- Community recipes (via Cloudflare Worker + KV) ----------

async function getGlobalRecipes() {
    try {
        const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes`);
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error("Could not load community recipes:", e);
        return [];
    }
}

async function addToCommunity(recipe) {
    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipe)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return await response.json();
}

async function updateInCommunity(recipeId, updates) {
    const body = { ...updates };
    const adminPass = getAdminPassword();
    if (adminPass) body.adminPassword = adminPass;

    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return await response.json();
}

async function deleteFromCommunity(recipeId, uploader) {
    const body = { uploader };
    const adminPass = getAdminPassword();
    if (adminPass) body.adminPassword = adminPass;

    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return true;
}
