async function parseRecipeWithAI(rawText) {
    // Retrieve user's locally stored API key
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert("Please save your free Gemini API key in the settings first!");
        return;
    }

    const endpoint = `https://googleapis.com{apiKey}`;
    
    const prompt = `Analyze this recipe text or URL. Extract the details into a strict JSON format matching this exact structure, with no markdown formatting or extra text:
    {
      "title": "Recipe Name",
      "category": "Breakfast/Lunch/Dinner/Dessert/Snack",
      "prepTime": "X mins",
      "ingredients": ["item 1", "item 2"],
      "instructions": ["step 1", "step 2"],
      "sourceUrl": "URL if applicable"
    }
    Recipe context: ${rawText}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawJsonText = data.candidates[0].content.parts[0].text.trim();
        
        // Clean up any accidental markdown code blocks from AI
        const cleanJson = rawJsonText.replace(/```json|```/g, '');
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Parsing failed:", error);
        alert("Failed to parse recipe. Check your API key or input.");
    }
}
