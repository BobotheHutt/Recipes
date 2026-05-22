// js/views.js
// Functions that build the inner HTML for each tab. No event wiring here —
// app.js renders these into #app-content and attaches behaviour.

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Format a time value as a simple string: minutes, or hours+"hr" past 60.
// Accepts a number (minutes) or a legacy string like "45 mins".
function formatTime(value) {
    if (value == null || value === '' || value === 'Unspecified' || value === 'Parsing...') {
        return null;
    }
    // Pull the first number out of whatever we were given
    const num = typeof value === 'number' ? value : parseInt(String(value).match(/\d+/), 10);
    if (isNaN(num) || num <= 0) {
        // Non-numeric legacy value — show it as-is
        return typeof value === 'string' ? value : null;
    }
    if (num < 60) return `${num} min`;
    const hrs = Math.floor(num / 60);
    const mins = num % 60;
    return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
}

// Pull a readable site name from a URL, e.g. "allrecipes.com".
function siteNameFromUrl(url) {
    try {
        const host = new URL(url).hostname;
        return host.replace(/^www\./, '');
    } catch (e) {
        return null;
    }
}

// ---- shared recipe card ----

function recipeCardHtml(recipe, actionItemsHtml) {
    const who = recipe.uploader ? escapeHtml(recipe.uploader) : 'Guest';
    let authorTag = `👤 Added by: ${who}`;
    if (recipe.createdAt) {
        const d = new Date(recipe.createdAt);
        if (!isNaN(d)) {
            const dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            authorTag += ` · 📅 ${dateStr}`;
        }
    }

    const showImg = (typeof getPrefs !== 'function') || getPrefs().showImages !== false;
    const imageHtml = (showImg && recipe.imageUrl)
        ? `<div class="card-image"><img src="${escapeHtml(recipe.imageUrl)}" alt="${escapeHtml(recipe.title)}" loading="lazy" onerror="this.parentNode.style.display='none'"></div>`
        : '';

    // Time: prefer the new totalTime, fall back to legacy prepTime
    const timeText = formatTime(recipe.totalTime != null ? recipe.totalTime : recipe.prepTime);
    const timeHtml = timeText
        ? `<span class="card-time" title="Total time">🕐 ${escapeHtml(timeText)}</span>`
        : '';

    // Source: show the site name above the link
    const siteName = recipe.sourceUrl ? siteNameFromUrl(recipe.sourceUrl) : null;
    const sourceHtml = recipe.sourceUrl
        ? `<p class="source-row"><span class="source-site">🔗 Source: ${escapeHtml(siteName || 'website')}</span>
             <a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" class="source-link">Original Source ↗</a></p>`
        : '';

    const descHtml = recipe.description
        ? `<p class="recipe-desc">${escapeHtml(recipe.description)}</p>`
        : '';

    return `
        <div class="recipe-card" data-id="${escapeHtml(recipe.id)}">
            <div class="card-header">
                <span class="badge">${escapeHtml(recipe.category)}</span>
                ${timeHtml}
                <div class="action-menu">
                    <button class="action-menu-btn" title="Actions" aria-label="Actions">⚙</button>
                    <div class="action-menu-panel hidden">
                        ${actionItemsHtml}
                    </div>
                </div>
            </div>
            ${imageHtml}
            <h3>${escapeHtml(recipe.title)}</h3>
            ${descHtml}
            <p style="font-size:0.8rem; font-style:italic; color:var(--text-muted); margin-bottom:16px;">${authorTag}</p>
            <details>
                <summary>View Recipe Details</summary>
                <h4>Ingredients:</h4>
                <ul>${(recipe.ingredients || []).map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
                <h4>Instructions:</h4>
                <ol>${(recipe.instructions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
                ${sourceHtml}
            </details>
        </div>
    `;
}

const FILTER_BAR = `
    <div class="controls-panel">
      <input type="text" id="search-bar" placeholder="🔍 Search recipes..." autocomplete="off">
      <div class="filter-buttons">
        <button class="filter-btn active" data-category="all">All</button>
        <button class="filter-btn" data-category="Breakfast">Breakfast</button>
        <button class="filter-btn" data-category="Lunch">Lunch</button>
        <button class="filter-btn" data-category="Dinner">Dinner</button>
        <button class="filter-btn" data-category="Dessert">Dessert</button>
        <button class="filter-btn" data-category="Snack">Snack</button>
      </div>
    </div>
`;

// ---- tab shells ----

function viewCollection() {
    return `
        <h1>My Collection</h1>
        <p>Your personal recipes, saved to your account and available on any device.</p>
        ${FILTER_BAR}
        <div id="recipe-grid" class="recipe-grid"></div>
    `;
}

function viewExplore() {
    return `
        <h1>Community Recipes</h1>
        <p>Recipes shared by everyone using this site.</p>
        ${FILTER_BAR}
        <div class="controls-panel" style="margin-top:-8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <label for="profile-filter" style="font-size:0.9rem; font-weight:600; color:var(--text-muted);">Added by:</label>
            <select id="profile-filter" style="padding:8px 12px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border); cursor:pointer;">
              <option value="all">Everyone</option>
            </select>
          </div>
        </div>
        <div id="global-grid" class="recipe-grid"></div>
    `;
}

function viewAdd() {
    return `
        <h1>Add a New Recipe</h1>
        <p>Recipes you add are saved to your collection and shared with the community.</p>

        <div class="toggle-actions" style="margin-top: 24px;">
          <button id="toggle-ai" class="filter-btn active">✨ AI Parser</button>
          <button id="toggle-manual" class="filter-btn">📝 Manual Entry</button>
        </div>

        <div id="ai-view" class="input-card">
          <div class="form-group">
            <label>Recipe URL or Messy Text</label>
            <textarea id="recipe-input" rows="8" placeholder="Paste a recipe URL, or copy-paste the recipe text here..."></textarea>
          </div>
          <div class="actions">
            <button id="submit-btn" class="primary-btn">✨ Parse with AI</button>
          </div>
        </div>

        <div id="manual-view" class="input-card hidden">
          <form id="manual-form">
            <div class="form-group">
              <label>Recipe Title</label>
              <input type="text" id="manual-title" placeholder="e.g., Mom's Lasagna" required>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select id="manual-category">
                <option value="Dinner">Dinner</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dessert">Dessert</option>
                <option value="Snack">Snack</option>
              </select>
            </div>
            <div class="form-group">
              <label>Total Time (minutes)</label>
              <input type="number" id="manual-time" min="0" placeholder="e.g., 45">
            </div>
            <div class="form-group">
              <label>Description / Notes (Optional)</label>
              <textarea id="manual-description" rows="2" placeholder="A short summary or any notes about this recipe."></textarea>
            </div>
            <div class="form-group">
              <label>Ingredients (One item per line)</label>
              <textarea id="manual-ingredients" rows="5" placeholder="1 lb ground beef&#10;2 cups mozzarella"></textarea>
            </div>
            <div class="form-group">
              <label>Instructions (One step per line)</label>
              <textarea id="manual-instructions" rows="5" placeholder="Brown the beef.&#10;Layer and bake."></textarea>
            </div>
            <div class="form-group">
              <label>Source Web link (Optional)</label>
              <input type="url" id="manual-url" placeholder="https://site.com">
            </div>
            <div class="form-group">
              <label>Image link (Optional)</label>
              <input type="url" id="manual-image" placeholder="https://site.com/photo.jpg">
            </div>
            <div class="actions">
              <button type="submit" class="primary-btn">💾 Save Recipe</button>
            </div>
          </form>
        </div>

        <div id="status-message" class="status-box hidden"></div>
    `;
}

function viewAdmin() {
    return `
        <h1>Admin Panel</h1>
        <p>Manage accounts. Only admins can see this tab.</p>

        <div class="input-card">
          <h3 style="margin-bottom:16px;">Reset a Password</h3>
          <div class="form-group">
            <label>Account</label>
            <select id="reset-account"></select>
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input type="text" id="reset-password" placeholder="At least 4 characters">
          </div>
          <p style="font-size:0.8rem;">The new password is shown as plain text so you can read it back to the person.</p>
          <div class="actions">
            <button id="reset-btn" class="primary-btn">Reset Password</button>
          </div>
        </div>

        <div class="input-card" style="margin-top:24px;">
          <h3 style="margin-bottom:16px;">Rename an Account</h3>
          <div class="form-group">
            <label>Account</label>
            <select id="rename-account"></select>
          </div>
          <div class="form-group">
            <label>New Name</label>
            <input type="text" id="rename-newname" placeholder="e.g., John" maxlength="30">
          </div>
          <p style="font-size:0.8rem;">The account keeps its password and recipes. The person will need to log in again with the new name afterwards.</p>
          <div class="actions">
            <button id="rename-btn" class="primary-btn">Rename Account</button>
          </div>
        </div>

        <div class="input-card" style="margin-top:24px;">
          <h3 style="margin-bottom:16px;">Delete an Account</h3>
          <div class="form-group">
            <label>Account</label>
            <select id="delete-account"></select>
          </div>
          <div class="settings-row" style="padding:4px 0;">
            <label for="delete-community">Also delete this person's community recipes</label>
            <input type="checkbox" id="delete-community">
          </div>
          <p style="font-size:0.8rem;">If unchecked, their shared recipes stay in the community under their name. Their personal collection is always removed. This cannot be undone.</p>
          <div class="actions">
            <button id="delete-btn" class="danger-btn">Delete Account</button>
          </div>
        </div>

        <h3 style="margin:32px 0 12px;">All Accounts</h3>
        <div id="account-list" class="recipe-grid"></div>
        <div id="status-message" class="status-box hidden" style="margin-top:20px;"></div>
    `;
}
