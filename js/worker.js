export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /parse — AI parsing via Gemini
      if (path === "/parse" && request.method === "POST") {
        return await handleParse(request, env, corsHeaders);
      }

      // POST /admin/verify — check admin password
      if (path === "/admin/verify" && request.method === "POST") {
        return await handleAdminVerify(request, env, corsHeaders);
      }

      // GET /recipes — list all community recipes
      if (path === "/recipes" && request.method === "GET") {
        return await handleListRecipes(env, corsHeaders);
      }

      // POST /recipes — add a new community recipe
      if (path === "/recipes" && request.method === "POST") {
        return await handleAddRecipe(request, env, corsHeaders);
      }

      // PUT /recipes/<id> — update a community recipe (owner or admin)
      if (path.startsWith("/recipes/") && request.method === "PUT") {
        const id = path.split("/")[2];
        return await handleUpdateRecipe(request, env, corsHeaders, id);
      }

      // DELETE /recipes/<id> — remove a community recipe (owner or admin)
      if (path.startsWith("/recipes/") && request.method === "DELETE") {
        const id = path.split("/")[2];
        return await handleDeleteRecipe(request, env, corsHeaders, id);
      }

      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      return jsonResponse({ error: err.toString() }, 500, corsHeaders);
    }
  },
};

// ---------- Helpers ----------

function jsonResponse(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readCommunity(env) {
  const raw = await env.RECIPES_KV.get("community:all");
  return raw ? JSON.parse(raw) : [];
}

async function writeCommunity(env, recipes) {
  await env.RECIPES_KV.put("community:all", JSON.stringify(recipes));
}

function isAdminRequest(body, env) {
  return !!(body.adminPassword && env.ADMIN_PASSWORD && body.adminPassword === env.ADMIN_PASSWORD);
}

// ---------- AI Parsing ----------

async function handleParse(request, env, corsHeaders) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500, corsHeaders);
  }

  const { recipeText } = await request.json();
  if (!recipeText) {
    return jsonResponse({ error: "No recipeText provided" }, 400, corsHeaders);
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
    apiKey;

  const promptText =
    "Analyze this recipe text or URL: " + recipeText +
    ' . Extract the details into a strict JSON format matching this exact structure, with no markdown formatting or extra conversational text:\n' +
    '{\n' +
    '  "title": "Recipe Name",\n' +
    '  "category": "Breakfast/Lunch/Dinner/Dessert/Snack",\n' +
    '  "prepTime": "X mins",\n' +
    '  "ingredients": ["item 1", "item 2"],\n' +
    '  "instructions": ["step 1", "step 2"],\n' +
    '  "sourceUrl": "URL if applicable"\n' +
    '}';

  const googleResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
  });

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    return jsonResponse(
      { error: "Gemini API rejected the request", details: errorText },
      googleResponse.status,
      corsHeaders
    );
  }

  const data = await googleResponse.json();
  return jsonResponse(data, 200, corsHeaders);
}

// ---------- Admin ----------

async function handleAdminVerify(request, env, corsHeaders) {
  if (!env.ADMIN_PASSWORD) {
    return jsonResponse({ error: "Admin password not configured on the server" }, 500, corsHeaders);
  }
  const { password } = await request.json();
  if (password && password === env.ADMIN_PASSWORD) {
    return jsonResponse({ ok: true }, 200, corsHeaders);
  }
  return jsonResponse({ error: "Wrong password" }, 401, corsHeaders);
}

// ---------- Community Recipes ----------

async function handleListRecipes(env, corsHeaders) {
  const recipes = await readCommunity(env);
  return jsonResponse(recipes, 200, corsHeaders);
}

async function handleAddRecipe(request, env, corsHeaders) {
  const recipe = await request.json();

  if (!recipe.title || !recipe.uploader) {
    return jsonResponse({ error: "Recipe needs title and uploader" }, 400, corsHeaders);
  }

  // Never persist an admin password into a recipe
  delete recipe.adminPassword;

  recipe.id = crypto.randomUUID();
  recipe.createdAt = Date.now();

  const recipes = await readCommunity(env);
  recipes.push(recipe);
  await writeCommunity(env, recipes);

  return jsonResponse(recipe, 200, corsHeaders);
}

async function handleUpdateRecipe(request, env, corsHeaders, id) {
  const updates = await request.json();
  const admin = isAdminRequest(updates, env);

  if (!admin && !updates.uploader) {
    return jsonResponse({ error: "Uploader required for ownership check" }, 400, corsHeaders);
  }

  const recipes = await readCommunity(env);
  const index = recipes.findIndex((r) => r.id === id);

  if (index === -1) {
    return jsonResponse({ error: "Recipe not found" }, 404, corsHeaders);
  }

  if (!admin && recipes[index].uploader !== updates.uploader) {
    return jsonResponse({ error: "You can only edit your own recipes" }, 403, corsHeaders);
  }

  // Strip admin password before persisting
  delete updates.adminPassword;

  // Preserve immutable fields (id, original uploader, createdAt)
  recipes[index] = {
    ...updates,
    id: recipes[index].id,
    uploader: recipes[index].uploader,
    createdAt: recipes[index].createdAt,
  };

  await writeCommunity(env, recipes);
  return jsonResponse(recipes[index], 200, corsHeaders);
}

async function handleDeleteRecipe(request, env, corsHeaders, id) {
  const body = await request.json();
  const admin = isAdminRequest(body, env);

  const recipes = await readCommunity(env);
  const index = recipes.findIndex((r) => r.id === id);

  if (index === -1) {
    return jsonResponse({ error: "Recipe not found" }, 404, corsHeaders);
  }

  if (!admin && recipes[index].uploader !== body.uploader) {
    return jsonResponse({ error: "You can only delete your own recipes" }, 403, corsHeaders);
  }

  recipes.splice(index, 1);
  await writeCommunity(env, recipes);
  return jsonResponse({ success: true }, 200, corsHeaders);
}
