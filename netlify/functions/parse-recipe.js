// Inside netlify/functions/parse-recipe.js -> Update this specific block:

const headers = {
  // Allow your official subdomain to securely access the AI backend
  "Access-Control-Allow-Origin": "https://woodstuff.org", 
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
