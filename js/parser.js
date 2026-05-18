// js/parser.js

// FIXED: Appended the correct serverless path to target your script file directly
const NETLIFY_ENDPOINT = 'https://recipesaves.netlify.app';

/**
 * Sends messy text or a recipe URL to the serverless function to parse with Gemini.
 * @param {string} rawTextOrUrl - The text or URL inputted by the user.
 * @returns {Object|null} The cleanly structured recipe JSON object, or null if it fails.
 */
async function parseRecipeWithAI(rawTextOrUrl) {
    try {
        const response = await fetch(NETLIFY_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rawText: rawTextOrUrl })
        });

        // Handle error responses cleanly
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend Error Details:", errorData);
            
            if (response.status === 429) {
                alert("The AI limit was reached for this minute. Please pause for 60 seconds and try again!");
            } else {
                alert("Failed to parse recipe. The system backend encountered an error.");
            }
            return null;
        }

        // Return the clean JSON schema directly to collection.html
        return await response.json();

    } catch (error) {
        console.error("Network or connection breakdown:", error);
        alert("Unable to reach the processing server. Please check your internet connection or verify your deployment.");
        return null;
    }
}
