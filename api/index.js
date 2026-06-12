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
  input, button {
    font-family: inherit;
    border: none;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 16px;
  }
  input {
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

function renderRecipePage(data) {
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
    <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
      <strong>${i + 1}.</strong> <p itemprop="text" style="display: inline;">${step}</p>
    </div>
  `).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${data.sourceUrl}">
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

      <h2>Instructions</h2>
      <ol>${stepsHtml}</ol>
    </div>
  </div>
</body>
</html>`;
}

function renderIndexPage(error = "") {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Instagram → AnyList</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
        <input id="urlInput" name="url" type="url" placeholder="Paste Instagram reel URL..." required autofocus style="flex: 1;">
        <button type="button" id="pasteBtn" style="background: #667eea; padding: 12px 12px; width: auto;">📋</button>
      </div>
      <button type="submit" style="width: 100%;">Convert Recipe</button>
    </form>
    ${error ? `<div class="error">${error}</div>` : ""}
  </div>
  <script>
    async function pasteFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          document.getElementById("urlInput").value = text;
          document.getElementById("urlInput").focus();
        }
      } catch (err) {
        alert("Couldn't access clipboard. Paste manually.");
      }
    }

    document.getElementById("pasteBtn").addEventListener("click", (e) => {
      e.preventDefault();
      pasteFromClipboard();
    });

    // Auto-paste on desktop on load
    window.addEventListener("load", () => {
      if (window.innerWidth > 600) {
        pasteFromClipboard();
      }
    });
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams);

  if (pathname === "/api" || pathname === "/") {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(renderIndexPage());
  } else if (pathname === "/api/convert" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      const params = new URLSearchParams(body);
      const url = params.get("url");
      res.setHeader("Location", `/api/recipe?url=${encodeURIComponent(url)}`);
      res.status(302).end();
    });
  } else if (pathname === "/api/recipe" && req.method === "GET") {
    const instagramUrl = query.url || "";
    if (!instagramUrl) {
      res.setHeader("Location", "/api");
      res.status(302).end();
      return;
    }

    try {
      const clean = instagramUrl.split("?")[0].replace(/\/$/, "");
      const oembed = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(clean)}&omitscript=true`;
      const response = await fetch(oembed, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.status}`);
      }

      const data = await response.json();
      const caption = data.title || "";
      const recipe = parseCaption(caption, data, instagramUrl);

      res.setHeader("Content-Type", "text/html");
      res.status(200).send(renderRecipePage(recipe));
    } catch (error) {
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(renderIndexPage(`Couldn't fetch reel: ${error.message}`));
    }
  } else {
    res.status(404).send("Not found");
  }
};
