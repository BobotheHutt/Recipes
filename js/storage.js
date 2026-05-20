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
    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return await response.json();
}

async function deleteFromCommunity(recipeId, uploader) {
    const response = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploader })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${response.status}`);
    }
    return true;
}
