// Automatically build a clean list if a new user arrives
if (!localStorage.getItem('my_recipes')) {
    localStorage.setItem('my_recipes', JSON.stringify([]));
}

// Fetch user's local recipes
function getRecipes() {
    return JSON.parse(localStorage.getItem('my_recipes'));
}

// Save a newly parsed recipe to the local list
function saveRecipe(recipeObj) {
    const current = getRecipes();
    current.push(recipeObj);
    localStorage.setItem('my_recipes', JSON.stringify(current));
}

// Fetch the shared public recipes from GitHub
async function getGlobalRecipes() {
    try {
        const response = await fetch('js/global-recipes.json');
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error("Could not load global recipes:", e);
        return [];
    }
}

// Check if a URL already exists anywhere
async function checkForExistingRecipe(inputUrl) {
    if (!inputUrl || !inputUrl.startsWith('http')) return null;
    
    // Clean URL to avoid matching errors from trailing slashes or spaces
    const cleanUrl = inputUrl.trim().toLowerCase().replace(/\/$/, "");

    // 1. Check local user storage first
    const localList = getRecipes();
    const localMatch = localList.find(r => r.sourceUrl && r.sourceUrl.toLowerCase().replace(/\/$/, "") === cleanUrl);
    if (localMatch) return { recipe: localMatch, type: "your private saved list" };

    // 2. Check global public database second
    const globalList = await getGlobalRecipes();
    const globalMatch = globalList.find(r => r.sourceUrl && r.sourceUrl.toLowerCase().replace(/\/$/, "") === cleanUrl);
    if (globalMatch) return { recipe: globalMatch, type: "the community database" };

    return null; // Unique URL, okay to use AI
}
