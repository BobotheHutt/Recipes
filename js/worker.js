export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Make sure the built-in Admin account exists before handling anything.
      await ensureAdminAccount(env);

      // ---- Auth (no token required) ----
      if (path === "/auth/signup" && method === "POST")
        return await handleSignup(request, env, corsHeaders);
      if (path === "/auth/login" && method === "POST")
        return await handleLogin(request, env, corsHeaders);
      if (path === "/auth/accounts" && method === "GET")
        return await handleListAccountNames(env, corsHeaders);

      // ---- Auth (token required) ----
      if (path === "/auth/validate" && method === "GET")
        return await handleValidate(request, env, corsHeaders);
      if (path === "/auth/logout" && method === "POST")
        return await handleLogout(request, env, corsHeaders);

      // ---- Admin ----
      if (path === "/admin/accounts" && method === "GET")
        return await handleAdminAccounts(request, env, corsHeaders);
      if (path === "/admin/reset-password" && method === "POST")
        return await handleAdminResetPassword(request, env, corsHeaders);

      // ---- AI parsing ----
      if (path === "/parse" && method === "POST")
        return await handleParse(request, env, corsHeaders);

      // ---- Personal (cloud) recipes ----
      if (path === "/my-recipes" && method === "GET")
        return await handleListMyRecipes(request, env, corsHeaders);
      if (path === "/my-recipes" && method === "POST")
        return await handleAddMyRecipe(request, env, corsHeaders);
      if (path.startsWith("/my-recipes/") && method === "PUT")
        return await handleUpdateMyRecipe(request, env, corsHeaders, path.split("/")[2]);
      if (path.startsWith("/my-recipes/") && method === "DELETE")
        return await handleDeleteMyRecipe(request, env, corsHeaders, path.split("/")[2]);

      // ---- Community recipes ----
      if (path === "/recipes" && method === "GET")
        return await handleListCommunity(request, env, corsHeaders);
      if (path === "/recipes" && method === "POST")
        return await handleAddCommunity(request, env, corsHeaders);
      if (path.startsWith("/recipes/") && method === "PUT")
        return await handleUpdateCommunity(request, env, corsHeaders, path.split("/")[2]);
      if (path.startsWith("/recipes/") && method === "DELETE")
        return await handleDeleteCommunity(request, env, corsHeaders, path.split("/")[2]);

      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      return jsonResponse({ error: err.toString() }, 500, corsHeaders);
    }
  },
};

// ==========================================================================
// Generic helpers
// ==========================================================================

function jsonResponse(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

// PBKDF2 password hashing. Returns { hashHex, saltHex }.
async function hashPassword(password, existingSaltHex) {
  const enc = new TextEncoder();
  const salt = existingSaltHex ? hexToBytes(existingSaltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return { hashHex: bytesToHex(new Uint8Array(bits)), saltHex: bytesToHex(salt) };
}

// Read the Bearer token, resolve to an account. Returns the account object or null.
async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const username = await env.RECIPES_KV.get("token:" + token);
  if (!username) return null;

  const raw = await env.RECIPES_KV.get("account:" + username);
  if (!raw) return null;

  const account = JSON.parse(raw);
  account._token = token;
  return account;
}

function unauthorized(corsHeaders) {
  return jsonResponse({ error: "Not logged in or session expired" }, 401, corsHeaders);
}

// ==========================================================================
// Account storage
// ==========================================================================

async function getAccountIndex(env) {
  const raw = await env.RECIPES_KV.get("accounts:index");
  return raw ? JSON.parse(raw) : [];
}

async function saveAccountIndex(env, list) {
  await env.RECIPES_KV.put("accounts:index", JSON.stringify(list));
}

async function getAccount(env, username) {
  const raw = await env.RECIPES_KV.get("account:" + username);
  return raw ? JSON.parse(raw) : null;
}

async function saveAccount(env, account) {
  // never persist the transient _token field
  const clean = { ...account };
  delete clean._token;
  await env.RECIPES_KV.put("account:" + account.username, JSON.stringify(clean));
}

// ==========================================================================
// Auth handlers
// ==========================================================================

// The built-in admin account is always named exactly this.
const ADMIN_USERNAME = "Admin";

// Make sure the Admin account exists, and that its password always matches
// the current ADMIN_PASSWORD secret. Runs cheaply at the start of each request.
async function ensureAdminAccount(env) {
  if (!env.ADMIN_PASSWORD) return; // nothing we can do without the secret

  const existing = await getAccount(env, ADMIN_USERNAME);

  if (!existing) {
    // First-ever run: create the Admin account from the secret.
    const { hashHex, saltHex } = await hashPassword(env.ADMIN_PASSWORD);
    const account = {
      username: ADMIN_USERNAME,
      passwordHash: hashHex,
      salt: saltHex,
      isAdmin: true,
      createdAt: Date.now(),
      seeded: true,
    };
    await saveAccount(env, account);

    const index = await getAccountIndex(env);
    if (!index.includes(ADMIN_USERNAME)) {
      index.push(ADMIN_USERNAME);
      await saveAccountIndex(env, index);
    }
    await env.RECIPES_KV.put("userrecipes:" + ADMIN_USERNAME, JSON.stringify([]));
    return;
  }

  // Already exists: if the secret has been changed in Cloudflare, re-sync it.
  const { hashHex } = await hashPassword(env.ADMIN_PASSWORD, existing.salt);
  if (hashHex !== existing.passwordHash) {
    const fresh = await hashPassword(env.ADMIN_PASSWORD);
    existing.passwordHash = fresh.hashHex;
    existing.salt = fresh.saltHex;
    existing.isAdmin = true;
    await saveAccount(env, existing);
  }
}

async function handleSignup(request, env, corsHeaders) {
  const { username, password } = await request.json();

  const name = (username || "").trim();
  if (!name) return jsonResponse({ error: "Username required" }, 400, corsHeaders);
  if (name.length > 30) return jsonResponse({ error: "Username too long" }, 400, corsHeaders);
  if (name.toLowerCase() === ADMIN_USERNAME.toLowerCase())
    return jsonResponse({ error: "That name is reserved. Please choose another." }, 409, corsHeaders);
  if (!password || password.length < 4)
    return jsonResponse({ error: "Password must be at least 4 characters" }, 400, corsHeaders);

  const existing = await getAccount(env, name);
  if (existing) return jsonResponse({ error: "That username is already taken" }, 409, corsHeaders);

  const { hashHex, saltHex } = await hashPassword(password);

  const account = {
    username: name,
    passwordHash: hashHex,
    salt: saltHex,
    isAdmin: false,
    createdAt: Date.now(),
  };
  await saveAccount(env, account);

  const index = await getAccountIndex(env);
  if (!index.includes(name)) {
    index.push(name);
    await saveAccountIndex(env, index);
  }

  await env.RECIPES_KV.put("userrecipes:" + name, JSON.stringify([]));

  const token = await issueToken(env, name);
  return jsonResponse({ token, username: name, isAdmin: false }, 200, corsHeaders);
}

async function handleLogin(request, env, corsHeaders) {
  const { username, password } = await request.json();
  const name = (username || "").trim();

  const account = await getAccount(env, name);
  if (!account) return jsonResponse({ error: "No account with that name" }, 401, corsHeaders);

  const { hashHex } = await hashPassword(password || "", account.salt);
  if (hashHex !== account.passwordHash)
    return jsonResponse({ error: "Wrong password" }, 401, corsHeaders);

  const token = await issueToken(env, name);
  return jsonResponse({ token, username: name, isAdmin: !!account.isAdmin }, 200, corsHeaders);
}

async function issueToken(env, username) {
  const token = crypto.randomUUID();
  await env.RECIPES_KV.put("token:" + token, username, { expirationTtl: TOKEN_TTL_SECONDS });
  return token;
}

async function handleValidate(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);
  return jsonResponse({ username: account.username, isAdmin: !!account.isAdmin }, 200, corsHeaders);
}

async function handleLogout(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (account && account._token) {
    await env.RECIPES_KV.delete("token:" + account._token);
  }
  return jsonResponse({ ok: true }, 200, corsHeaders);
}

async function handleListAccountNames(env, corsHeaders) {
  const index = await getAccountIndex(env);
  return jsonResponse(index, 200, corsHeaders);
}

// ==========================================================================
// Admin handlers
// ==========================================================================

async function handleAdminAccounts(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);
  if (!account.isAdmin) return jsonResponse({ error: "Admin only" }, 403, corsHeaders);

  const index = await getAccountIndex(env);
  const accounts = [];
  for (const name of index) {
    const a = await getAccount(env, name);
    if (a) accounts.push({ username: a.username, isAdmin: !!a.isAdmin, createdAt: a.createdAt });
  }
  return jsonResponse(accounts, 200, corsHeaders);
}

async function handleAdminResetPassword(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);
  if (!account.isAdmin) return jsonResponse({ error: "Admin only" }, 403, corsHeaders);

  const { targetUsername, newPassword } = await request.json();
  if (!targetUsername || !newPassword || newPassword.length < 4)
    return jsonResponse({ error: "Need a target account and a password of 4+ characters" }, 400, corsHeaders);

  if (targetUsername.toLowerCase() === ADMIN_USERNAME.toLowerCase())
    return jsonResponse(
      { error: "The Admin password is set by the ADMIN_PASSWORD secret in Cloudflare. Change it there." },
      400, corsHeaders
    );

  const target = await getAccount(env, targetUsername);
  if (!target) return jsonResponse({ error: "No such account" }, 404, corsHeaders);

  const { hashHex, saltHex } = await hashPassword(newPassword);
  target.passwordHash = hashHex;
  target.salt = saltHex;
  await saveAccount(env, target);

  return jsonResponse({ ok: true }, 200, corsHeaders);
}

// ==========================================================================
// Number / fraction cleanup
// ==========================================================================

const COMMON_FRACTIONS = [
  { value: 1 / 8, text: "1/8" },
  { value: 1 / 4, text: "1/4" },
  { value: 1 / 3, text: "1/3" },
  { value: 3 / 8, text: "3/8" },
  { value: 1 / 2, text: "1/2" },
  { value: 5 / 8, text: "5/8" },
  { value: 2 / 3, text: "2/3" },
  { value: 3 / 4, text: "3/4" },
  { value: 7 / 8, text: "7/8" },
];

function tidyNumber(num) {
  if (!isFinite(num)) return String(num);
  const whole = Math.floor(num);
  const frac = num - whole;
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  for (const f of COMMON_FRACTIONS) {
    if (Math.abs(frac - f.value) < 0.03) {
      return whole > 0 ? `${whole} ${f.text}` : f.text;
    }
  }
  return num.toFixed(2);
}

function tidyNumbersInText(text) {
  if (typeof text !== "string") return text;
  return text.replace(/\d*\.?\d+/g, (match) => {
    if (!match.includes(".")) return match;
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    return tidyNumber(num);
  });
}

function tidyRecipeNumbers(recipe) {
  if (recipe && Array.isArray(recipe.ingredients)) {
    recipe.ingredients = recipe.ingredients.map(tidyNumbersInText);
  }
  return recipe;
}

// ==========================================================================
// URL fetching & extraction
// ==========================================================================

function looksLikeUrl(text) {
  return /^https?:\/\/\S+$/i.test((text || "").trim());
}

async function extractRecipeContentFromUrl(pageUrl) {
  let response;
  try {
    response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
  } catch (e) {
    throw new Error("Could not reach that URL. Try copying and pasting the recipe text instead.");
  }
  if (!response.ok) {
    throw new Error(`That site returned an error (${response.status}). Try copying and pasting the recipe text instead.`);
  }

  const html = await response.text();

  const images = collectCandidateImages(html, jsonLdImage(html));

  const jsonLd = findRecipeJsonLd(html);
  if (jsonLd) {
    return {
      text: "STRUCTURED RECIPE DATA:\n" + JSON.stringify(jsonLd),
      sourceUrl: pageUrl,
      images,
    };
  }

  const plainText = htmlToText(html);
  if (plainText.length < 200) {
    throw new Error("That page didn't contain readable recipe text (it may load content with JavaScript). Please copy and paste the recipe instead.");
  }
  return { text: "WEB PAGE TEXT:\n" + plainText.slice(0, 12000), sourceUrl: pageUrl, images };
}

// Pull the image URL(s) declared inside the Recipe JSON-LD node.
function jsonLdImage(html) {
  const recipe = findRecipeJsonLd(html);
  if (!recipe || !recipe.image) return [];
  const img = recipe.image;
  const out = [];
  const push = (v) => {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object" && typeof v.url === "string") out.push(v.url);
  };
  if (Array.isArray(img)) img.forEach(push);
  else push(img);
  return out;
}

// Gather a handful of likely recipe photos: JSON-LD images first, then the
// og:image / twitter:image social thumbnails. Deduplicated, capped at 6.
function collectCandidateImages(html, jsonLdImages) {
  const found = [];
  const seen = new Set();
  const add = (url) => {
    if (!url) return;
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    found.push(u);
  };

  (jsonLdImages || []).forEach(add);

  // <meta property="og:image" content="..."> and twitter:image variants
  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    const contentMatch = m[0].match(/content=["']([^"']+)["']/i);
    if (contentMatch) add(contentMatch[1]);
  }

  return found.slice(0, 6);
}

function findRecipeJsonLd(html) {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let parsed;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch (e) {
      continue;
    }
    const recipe = findRecipeNode(parsed);
    if (recipe) return recipe;
  }
  return null;
}

function findRecipeNode(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const type = node["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return node;
  if (Array.isArray(node["@graph"])) return findRecipeNode(node["@graph"]);
  return null;
}

function htmlToText(html) {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return text.replace(/\s+/g, " ").trim();
}

// ==========================================================================
// AI parsing
// ==========================================================================

async function handleParse(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500, corsHeaders);

  const { recipeText } = await request.json();
  if (!recipeText) return jsonResponse({ error: "No recipeText provided" }, 400, corsHeaders);

  let contentForAI = recipeText;
  let detectedSourceUrl = null;
  let candidateImages = [];

  if (looksLikeUrl(recipeText)) {
    try {
      const extracted = await extractRecipeContentFromUrl(recipeText.trim());
      contentForAI = extracted.text;
      detectedSourceUrl = extracted.sourceUrl;
      candidateImages = extracted.images || [];
    } catch (e) {
      return jsonResponse({ error: e.message }, 422, corsHeaders);
    }
  }

  const promptText =
    "Extract recipe details from the following content. " +
    (detectedSourceUrl
      ? `If a sourceUrl is not evident in the content, use "${detectedSourceUrl}" as the sourceUrl. `
      : "If a sourceUrl is not evident in the content, set sourceUrl to null. ") +
    "Respond with strict JSON only, no markdown, no extra text, matching this structure:\n" +
    '{\n' +
    '  "title": "Recipe Name",\n' +
    '  "category": "Breakfast/Lunch/Dinner/Dessert/Snack",\n' +
    '  "prepTime": "X mins",\n' +
    '  "ingredients": ["item 1", "item 2"],\n' +
    '  "instructions": ["step 1", "step 2"],\n' +
    '  "sourceUrl": "URL or null"\n' +
    '}\n\nCONTENT:\n' +
    contentForAI;

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" +
    apiKey;

  const googleResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
  });

  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    return jsonResponse({ error: "Gemini API rejected the request", details: errorText }, googleResponse.status, corsHeaders);
  }

  const data = await googleResponse.json();

  try {
    const rawText = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    tidyRecipeNumbers(parsed);
    data.candidates[0].content.parts[0].text = JSON.stringify(parsed);
  } catch (e) {
    // leave response untouched if shape is unexpected
  }

  // Attach the candidate images so the frontend can show an image picker.
  data.candidateImages = candidateImages;

  return jsonResponse(data, 200, corsHeaders);
}

// ==========================================================================
// Personal (cloud) recipes
// ==========================================================================

async function getMyRecipes(env, username) {
  const raw = await env.RECIPES_KV.get("userrecipes:" + username);
  return raw ? JSON.parse(raw) : [];
}

async function saveMyRecipes(env, username, recipes) {
  await env.RECIPES_KV.put("userrecipes:" + username, JSON.stringify(recipes));
}

async function handleListMyRecipes(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);
  const recipes = await getMyRecipes(env, account.username);
  return jsonResponse(recipes, 200, corsHeaders);
}

async function handleAddMyRecipe(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const recipe = await request.json();
  if (!recipe.title) return jsonResponse({ error: "Recipe needs a title" }, 400, corsHeaders);

  delete recipe.adminPassword;
  tidyRecipeNumbers(recipe);
  if (!recipe.id) recipe.id = crypto.randomUUID();
  if (!recipe.createdAt) recipe.createdAt = Date.now();

  const recipes = await getMyRecipes(env, account.username);
  // avoid duplicates by id
  if (!recipes.some((r) => r.id === recipe.id)) {
    recipes.push(recipe);
    await saveMyRecipes(env, account.username, recipes);
  }
  return jsonResponse(recipe, 200, corsHeaders);
}

async function handleUpdateMyRecipe(request, env, corsHeaders, id) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const updates = await request.json();
  delete updates.adminPassword;
  tidyRecipeNumbers(updates);

  const recipes = await getMyRecipes(env, account.username);
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return jsonResponse({ error: "Recipe not found in your collection" }, 404, corsHeaders);

  recipes[index] = { ...updates, id, createdAt: recipes[index].createdAt };
  await saveMyRecipes(env, account.username, recipes);
  return jsonResponse(recipes[index], 200, corsHeaders);
}

async function handleDeleteMyRecipe(request, env, corsHeaders, id) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const recipes = await getMyRecipes(env, account.username);
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return jsonResponse({ error: "Recipe not found" }, 404, corsHeaders);

  recipes.splice(index, 1);
  await saveMyRecipes(env, account.username, recipes);
  return jsonResponse({ success: true }, 200, corsHeaders);
}

// ==========================================================================
// Community recipes
// ==========================================================================

async function readCommunity(env) {
  const raw = await env.RECIPES_KV.get("community:all");
  return raw ? JSON.parse(raw) : [];
}

async function writeCommunity(env, recipes) {
  await env.RECIPES_KV.put("community:all", JSON.stringify(recipes));
}

async function handleListCommunity(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);
  const recipes = await readCommunity(env);
  return jsonResponse(recipes, 200, corsHeaders);
}

async function handleAddCommunity(request, env, corsHeaders) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const recipe = await request.json();
  if (!recipe.title) return jsonResponse({ error: "Recipe needs a title" }, 400, corsHeaders);

  delete recipe.adminPassword;
  tidyRecipeNumbers(recipe);

  // identity comes from the token, never the client
  recipe.uploader = account.username;
  recipe.id = crypto.randomUUID();
  recipe.createdAt = Date.now();

  const recipes = await readCommunity(env);
  recipes.push(recipe);
  await writeCommunity(env, recipes);
  return jsonResponse(recipe, 200, corsHeaders);
}

async function handleUpdateCommunity(request, env, corsHeaders, id) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const updates = await request.json();
  delete updates.adminPassword;
  tidyRecipeNumbers(updates);

  const recipes = await readCommunity(env);
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return jsonResponse({ error: "Recipe not found" }, 404, corsHeaders);

  const owns = recipes[index].uploader === account.username;
  if (!owns && !account.isAdmin)
    return jsonResponse({ error: "You can only edit your own recipes" }, 403, corsHeaders);

  recipes[index] = {
    ...updates,
    id: recipes[index].id,
    uploader: recipes[index].uploader,
    createdAt: recipes[index].createdAt,
  };
  await writeCommunity(env, recipes);
  return jsonResponse(recipes[index], 200, corsHeaders);
}

async function handleDeleteCommunity(request, env, corsHeaders, id) {
  const account = await authenticate(request, env);
  if (!account) return unauthorized(corsHeaders);

  const recipes = await readCommunity(env);
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return jsonResponse({ error: "Recipe not found" }, 404, corsHeaders);

  const owns = recipes[index].uploader === account.username;
  if (!owns && !account.isAdmin)
    return jsonResponse({ error: "You can only delete your own recipes" }, 403, corsHeaders);

  recipes.splice(index, 1);
  await writeCommunity(env, recipes);
  return jsonResponse({ success: true }, 200, corsHeaders);
}
