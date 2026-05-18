// netlify/functions/parse-recipe.js

export const handler = async (event) => {
  // Strict security headers allowing ONLY your recipe subdomain to connect
  const headers = {
    "Access-Control-Allow-Origin": "https://recipes.woodstuff.org", 
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // FIXED: Explicitly return a successful 200 state with headers if the browser sends an OPTIONS pre-flight check
  if (event.httpMethod === "OPTIONS") {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ message: "Preflight OK" }) 
    };
  }

  // Block any non-POST traffic
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { rawText } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: "API key is missing on the server variables panel." }) 
      };
    }
    
    const endpoint = `https://googleapis.com{apiKey}`;
    
    // Formatting layout constraint string injection
    const prompt = `Analyze this recipe text or URL. Extract the details into a strict JSON format matching this exact structure, with no markdown formatting or extra conversational text:
    {
      "title": "Recipe Name",
      "category": "Breakfast/Lunch/Dinner/Dessert/Snack",
      "prepTime": "X mins",
      "ingredients": ["item 1", "item 2"],
      "instructions": ["step 1", "step 2"],
      "sourceUrl": "URL if applicable"
    }
    Recipe context: ${rawText}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0].content || !data.candidates[0].content.parts) {
      throw new Error("Invalid response received from the Google API engine.");
    }

    const rawJsonText = data.candidates[0].content.parts[0].text.trim();
    
    // Remove formatting code blocks (```json ... ```) if the AI includes them
    const cleanJson = rawJsonText.replace(/```json|```/g, '');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(JSON.parse(cleanJson))
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
