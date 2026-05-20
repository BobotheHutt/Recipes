// js/storage.js
// All recipe data lives in the cloud (Cloudflare Worker + KV) and is
// scoped to the logged-in account. Every call carries the auth token.

// ---------- Personal (cloud) recipes ----------

async function getMyRecipes() {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/my-recipes`, {
        headers: AUTH.headers()
    });
    if (!res.ok) throw new Error(await errorText(res));
    return await res.json();
}

async function addMyRecipe(recipe) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/my-recipes`, {
        method: 'POST',
        headers: AUTH.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(recipe)
    });
    if (!res.ok) throw new Error(await errorText(res));
    return await res.json();
}

async function updateMyRecipe(id, recipe) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/my-recipes/${id}`, {
        method: 'PUT',
        headers: AUTH.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(recipe)
    });
    if (!res.ok) throw new Error(await errorText(res));
    return await res.json();
}

async function deleteMyRecipe(id) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/my-recipes/${id}`, {
        method: 'DELETE',
        headers: AUTH.headers()
    });
    if (!res.ok) throw new Error(await errorText(res));
    return true;
}

// ---------- Community recipes ----------

async function getGlobalRecipes() {
    try {
        const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes`, {
            headers: AUTH.headers()
        });
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error("Could not load community recipes:", e);
        return [];
    }
}

async function addToCommunity(recipe) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes`, {
        method: 'POST',
        headers: AUTH.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(recipe)
    });
    if (!res.ok) throw new Error(await errorText(res));
    return await res.json();
}

async function updateInCommunity(id, recipe) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${id}`, {
        method: 'PUT',
        headers: AUTH.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(recipe)
    });
    if (!res.ok) throw new Error(await errorText(res));
    return await res.json();
}

async function deleteFromCommunity(id) {
    const res = await fetch(`${APP_CONFIG.CLOUDFLARE_BRIDGE_URL}/recipes/${id}`, {
        method: 'DELETE',
        headers: AUTH.headers()
    });
    if (!res.ok) throw new Error(await errorText(res));
    return true;
}

// ---------- helper ----------

async function errorText(res) {
    try {
        const data = await res.json();
        return data.error || `Server returned ${res.status}`;
    } catch (e) {
        return `Server returned ${res.status}`;
    }
}
