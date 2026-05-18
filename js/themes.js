function doPost(e) {
  const GITHUB_USERNAME = "BoobotheHutt";
  const PRIVATE_REPO = "recipes-private-backend";
  const GITHUB_TOKEN = "ghp_PASTE_YOUR_ORIGINAL_CLASSIC_TOKEN_HERE";

  const payload = JSON.parse(e.postData.contents);
  const endpoint = `https://github.com{GITHUB_USERNAME}/${PRIVATE_REPO}/issues`;

  // Route title formatting switches based on if the web front-end flagged it as a Sync event
  let issueTitle = "Web Scrape Request";
  let issueBody = payload.recipeText;

  if (payload.isEditSync === true) {
    issueTitle = "RECIPE_EDIT_SYNC: Modified data update pipeline item";
  }

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + GITHUB_TOKEN },
    payload: JSON.stringify({
      title: issueTitle,
      body: issueBody
    })
  };

  try {
    UrlFetchApp.fetch(endpoint, options);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
