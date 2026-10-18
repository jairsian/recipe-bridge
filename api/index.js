const { parseCaption } = require("./parse.js");

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
    color: #333;
    line-height: 1.6;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h1, h2 { font-weight: 600; margin-top: 24px; margin-bottom: 12px; }
  h1 { font-size: 28px; }
  h2 { font-size: 20px; border-bottom: 2px solid #ff6b35; padding-bottom: 8px; }
  p { margin-bottom: 12px; }
  ul, ol { margin: 16px 0 16px 20px; }
  li { margin-bottom: 8px; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
  input, button, textarea {
    font-family: inherit;
    border: none;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 16px;
  }
  input, textarea {
    width: 100%;
    border: 1px solid #ddd;
    margin-bottom: 12px;
    background: white;
  }
  input:focus { outline: none; border-color: #ff6b35; }
  button {
    background: linear-gradient(135deg, #ff6b35 0%, #e64a3c 100%);
    color: white;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.2s;
    width: 100%;
  }
  button:active { transform: scale(0.98); }
  .error {
    background: #ffe0e0;
    color: #c33;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .header {
    text-align: center;
    margin-bottom: 32px;
  }
  .header h1 {
    background: linear-gradient(135deg, #ff6b35 0%, #e64a3c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 32px;
    margin: 0 0 8px 0;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    margin: 20px 0;
    padding: 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .meta-item { text-align: center; }
  .meta-label { font-size: 12px; color: #999; text-transform: uppercase; }
  .meta-value { font-size: 18px; font-weight: 600; color: #ff6b35; margin-top: 4px; }
  .nutrition {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin: 16px 0;
  }
  .nutrition-item {
    background: white;
    padding: 12px;
    border-radius: 6px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .nutrition-label { font-size: 12px; color: #999; }
  .nutrition-value { font-size: 16px; font-weight: 600; color: #333; margin-top: 4px; }
  .description {
    background: #fff9f5;
    padding: 16px;
    border-left: 4px solid #ff6b35;
    border-radius: 4px;
    margin: 20px 0;
    font-style: italic;
  }
  .author { color: #999; font-size: 14px; }
  .instagram-link {
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 6px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0;
  }
  .instagram-link:hover { opacity: 0.9; }
`;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
}

function normalizeInstagramUrl(value) {
  const match = String(value || "").match(/https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:reel|reels|p)\/[A-Za-z0-9_-]+\/?(?:[?#][^\s]*)?/i);
  if (!match) throw new Error("Paste an Instagram reel or post link.");
  const url = new URL(match[0]);
  return `https://www.instagram.com${url.pathname.replace(/^\/reels\//, "/reel/").replace(/\/$/, "")}/`;
}

function renderRecipePage(rawData) {
  // Escape every caption-derived value before inserting it into HTML.
  const data = JSON.parse(JSON.stringify(rawData), (key, value) => typeof value === "string" ? escapeHtml(value) : value);
  const nutHtml = data.nutrition ? `
    <div class="nutrition" itemprop="nutrition" itemscope itemtype="https://schema.org/NutritionInformation">
      ${data.nutrition.calories ? `<div class="nutrition-item"><div class="nutrition-label">Calories</div><div class="nutrition-value" itemprop="calories">${data.nutrition.calories}</div></div>` : ""}
      ${data.nutrition.protein ? `<div class="nutrition-item"><div class="nutrition-label">Protein</div><div class="nutrition-value" itemprop="proteinContent">${data.nutrition.protein}</div></div>` : ""}
      ${data.nutrition.carbs ? `<div class="nutrition-item"><div class="nutrition-label">Carbs</div><div class="nutrition-value" itemprop="carbohydrateContent">${data.nutrition.carbs}</div></div>` : ""}
      ${data.nutrition.fat ? `<div class="nutrition-item"><div class="nutrition-label">Fat</div><div class="nutrition-value" itemprop="fatContent">${data.nutrition.fat}</div></div>` : ""}
      ${data.nutrition.fiber ? `<div class="nutrition-item"><div class="nutrition-label">Fiber</div><div class="nutrition-value" itemprop="fiberContent">${data.nutrition.fiber}</div></div>` : ""}
    </div>
  ` : "";

  const metaItems = [];
  if (data.yield_) metaItems.push(`<div class="meta-item"><div class="meta-label">Serves</div><div class="meta-value" itemprop="recipeYield">${data.yield_}</div></div>`);
  if (data.prepTimeIso) metaItems.push(`<div class="meta-item"><div class="meta-label">Prep</div><div class="meta-value"><time itemprop="prepTime" datetime="${data.prepTimeIso}">${data.prepTimeHuman}</time></div></div>`);
  if (data.cookTimeIso) metaItems.push(`<div class="meta-item"><div class="meta-label">Cook</div><div class="meta-value"><time itemprop="cookTime" datetime="${data.cookTimeIso}">${data.cookTimeHuman}</time></div></div>`);
  if (data.totalTimeIso && !data.prepTimeIso && !data.cookTimeIso) metaItems.push(`<div class="meta-item"><div class="meta-label">Time</div><div class="meta-value"><time itemprop="totalTime" datetime="${data.totalTimeIso}">${data.totalTimeHuman}</time></div></div>`);

  const ingHtml = data.ingredients.map(ing => `<li itemprop="recipeIngredient">${ing}</li>`).join("\n");
  const stepsHtml = data.steps.map((step, i) => `
    <li itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
      <p itemprop="text" style="display: inline;">${step}</p>
    </li>
  `).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <meta property="og:url" content="${data.sourceUrl}">
  <meta property="og:type" content="article">
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <div itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name">${data.name}</h1>
      ${data.author ? `<p class="author">by <span itemprop="author">${data.author}</span></p>` : ""}
      ${data.image ? `<img itemprop="image" src="${data.image}" alt="${data.name}" onerror="this.style.display='none'">` : ""}
      <a href="${data.sourceUrl}" target="_blank" class="instagram-link">📸 View on Instagram</a>
      <meta itemprop="url" content="${data.sourceUrl}">

      ${metaItems.length > 0 ? `<div class="meta">${metaItems.join("")}</div>` : ""}
      ${nutHtml}
      ${data.description ? `<div class="description" itemprop="description">${data.description}</div>` : ""}

      <h2>Ingredients</h2>
      <ul>${ingHtml}</ul>

      ${!data.steps.length ? `<p class="error">This caption contains no cooking instructions. Open the creator’s full recipe, or <a href="/?url=${encodeURIComponent(rawData.sourceUrl)}">paste the complete recipe caption</a> before importing.</p>` : ""}
      <h2>Instructions</h2>
      <ol>${stepsHtml}</ol>
      <p>Use the AnyList Recipe Import extension on this page to save the recipe.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderIndexPage(error = "", value = "", caption = "") {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Instagram → AnyList</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Recipe Bridge">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#ff6b35">
  <style>${SHARED_STYLES}
    .hero { text-align: center; margin-bottom: 32px; }
    .hero p { color: #666; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>📸 → 🍳</h1>
      <h2 style="border: none; background: none; -webkit-background-clip: unset; -webkit-text-fill-color: unset; color: #333; margin-top: 8px;">Recipe Bridge</h2>
      <p>Convert Instagram recipes to AnyList</p>
    </div>
    <form method="POST" action="/api/convert">
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <input id="urlInput" name="url" type="url" placeholder="Paste Instagram reel URL..." aria-label="Instagram reel URL" value="${escapeHtml(value)}" required autofocus style="flex: 1;">
        <button type="button" id="pasteBtn" aria-label="Paste Instagram link" title="Paste Instagram link" style="background: #667eea; padding: 12px 12px; width: auto;">📋</button>
      </div>
      <p id="pasteStatus" role="status" style="font-size: 14px; color: #666;">In Instagram, choose Share → Copy link, then tap 📋 or paste here.</p>
      <details${error ? " open" : ""}>
        <summary>Instagram blocked access? Paste the recipe caption</summary>
        <label for="captionInput">Recipe caption (ingredients and instructions)</label>
        <textarea id="captionInput" name="caption" rows="8" maxlength="6000" placeholder="Copy the recipe caption here...">${escapeHtml(caption)}</textarea>
        <p style="font-size: 14px;">Caption text is included in the generated page URL. Only use text you intend to share.</p>
      </details>
      <button type="submit" style="width: 100%;">Convert Recipe</button>
    </form>
    ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ""}
  </div>
  <script>
    const input = document.getElementById("urlInput");
    const status = document.getElementById("pasteStatus");
    function acceptLink(text) {
      const match = text.match(/https?:\\/\\/(?:www\\.|m\\.)?instagram\\.com\\/(?:reel|reels|p)\\/[A-Za-z0-9_-]+\\/?(?:[?#][^\\s]*)?/i);
      if (!match) return false;
      input.value = match[0];
      status.textContent = "Instagram link pasted. Ready to convert.";
      return true;
    }
    async function pasteFromClipboard(automatic = false) {
      if (automatic && input.value.trim()) return;
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error();
        const text = await navigator.clipboard.readText();
        if (automatic && input.value.trim()) return;
        if (!acceptLink(text) && !automatic) status.textContent = "No Instagram link found. In Instagram, choose Share → Copy link first.";
      } catch {
        if (!automatic) {
          status.textContent = "Clipboard access is blocked. Touch and hold the field and choose Paste, or use Ctrl/Cmd+V.";
          input.focus();
        }
      }
    }
    document.getElementById("pasteBtn").addEventListener("click", () => pasteFromClipboard());
    input.addEventListener("paste", event => {
      const text = event.clipboardData.getData("text");
      if (acceptLink(text)) event.preventDefault();
    });
    async function tryAutoPaste() {
      // Never prompt on load: automatic reads only use an existing browser grant.
      try {
        if (!navigator.permissions || document.visibilityState !== "visible") return;
        const permission = await navigator.permissions.query({name: "clipboard-read"});
        if (permission.state === "granted") await pasteFromClipboard(true);
      } catch { /* Safari/Firefox require an explicit paste gesture. */ }
    }
    window.addEventListener("load", tryAutoPaste);
    window.addEventListener("focus", tryAutoPaste);
    document.addEventListener("visibilitychange", tryAutoPaste);
  </script>
</body>
</html>`;
}

async function readForm(req) {
  // Vercel may have already consumed and parsed the request stream.
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") return new URLSearchParams(req.body.toString());
    return new URLSearchParams(req.body);
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 32000) throw new Error("Caption is too long.");
  }
  return new URLSearchParams(body);
}

async function handler(req, res) {
  const requestUrl = new URL(req.url, "https://recipe-bridge.invalid");
  const pathname = requestUrl.pathname.replace(/\/$/, "") || "/";
  const sendIndex = (message = "", value = "", caption = "", status = 200) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).send(renderIndexPage(message, value, caption));
  };
  if ((pathname === "/api" || pathname === "/") && req.method === "GET") return sendIndex("", requestUrl.searchParams.get("url") || "");
  if (pathname === "/api/convert" && req.method === "POST") {
    let value = "", caption = "";
    try {
      const params = await readForm(req);
      value = params.get("url") || "";
      caption = params.get("caption") || "";
      const normalized = normalizeInstagramUrl(value);
      if (caption.length > 6000) throw new Error("Caption must be 6,000 characters or fewer.");
      const query = new URLSearchParams({url: normalized});
      if (caption.trim()) query.set("caption", caption.trim());
      if (query.toString().length > 14000) throw new Error("Caption is too long for a shareable recipe link. Shorten it and try again.");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Location", `/api/recipe?${query}`);
      return res.status(303).end();
    } catch (error) { return sendIndex(error.message, value, caption, 400); }
  }
  if (pathname === "/api/recipe" && req.method === "GET") {
    const value = requestUrl.searchParams.get("url") || "";
    const caption = requestUrl.searchParams.get("caption") || "";
    try {
      const sourceUrl = normalizeInstagramUrl(value);
      if (caption.length > 6000) throw new Error("Caption is too long.");
      let metadata = {}, text = caption.trim();
      if (!text) {
        // This public endpoint may be unavailable, rate-limited or omit captions.
        const response = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(sourceUrl)}&omitscript=true`, {
          headers: {"User-Agent": "Mozilla/5.0"}, signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Instagram could not provide the caption (HTTP ${response.status}). Paste the recipe caption below and convert again.`);
        metadata = await response.json();
        text = metadata.title || "";
      }
      const recipe = parseCaption(text, metadata, sourceUrl);
      if (!recipe.ingredients.length) throw new Error("No ingredients found. Paste the recipe caption below.");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      return res.status(200).send(renderRecipePage(recipe));
    } catch (error) {
      const message = error.name === "TimeoutError" ? "Instagram timed out. Paste the recipe caption below and convert again." : error.message;
      return sendIndex(message, value, caption, 422);
    }
  }
  return res.status(404).send("Not found");
}
module.exports = handler;
module.exports.renderIndexPage = renderIndexPage;
module.exports.renderRecipePage = renderRecipePage;
module.exports.normalizeInstagramUrl = normalizeInstagramUrl;
