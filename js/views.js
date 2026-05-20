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

// ---- shared recipe card ----

function recipeCardHtml(recipe, actionItemsHtml) {
    const authorTag = recipe.uploader
        ? `👤 Added by: ${escapeHtml(recipe.uploader)}`
        : '👤 Added by: Guest';

    return `
        <div class="recipe-card" data-id="${escapeHtml(recipe.id)}">
            <div class="card-header">
                <span class="badge">${escapeHtml(recipe.category)}</span>
                <div class="action-menu">
                    <button class="action-menu-btn">⋯ Actions</button>
                    <div class="action-menu-panel hidden">
                        ${actionItemsHtml}
                    </div>
                </div>
            </div>
            <h3>${escapeHtml(recipe.title)}</h3>
            <p class="meta-info" style="margin-bottom:4px;">⏱️ Prep: ${escapeHtml(recipe.prepTime)}</p>
            <p style="font-size:0.8rem; font-style:italic; color:var(--text-muted); margin-bottom:16px;">${authorTag}</p>
            <details>
                <summary>View Recipe Details</summary>
                <h4>Ingredients:</h4>
                <ul>${(recipe.ingredients || []).map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
                <h4>Instructions:</h4>
                <ol>${(recipe.instructions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
                ${recipe.sourceUrl ? `<a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" class="source-link">Original Source ↗</a>` : ''}
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
              <label>Preparation Time</label>
              <input type="text" id="manual-time" placeholder="e.g., 45 mins">
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

        <h3 style="margin:32px 0 12px;">All Accounts</h3>
        <div id="account-list" class="recipe-grid"></div>
        <div id="status-message" class="status-box hidden" style="margin-top:20px;"></div>
    `;
}
