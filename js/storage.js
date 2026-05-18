// Initialize empty array if no recipes exist yet
if (!localStorage.getItem('my_recipes')) {
    localStorage.setItem('my_recipes', JSON.stringify([]));
}

// Get all saved recipes
function getRecipes() {
    return JSON.parse(localStorage.getItem('my_recipes'));
}

// Add a single recipe object to the local list
function saveRecipe(recipeObj) {
    const current = getRecipes();
    current.push(recipeObj);
    localStorage.setItem('my_recipes', JSON.stringify(current));
}
