const { parseCaption } = require("./parse.js");

function renderRecipePage(data) {
  const nutHtml = data.nutrition ? `
    <div itemprop="nutrition" itemscope itemtype="https://schema.org/NutritionInformation">
      ${data.nutrition.calories ? `<p>Calories: <span itemprop="calories">${data.nutrition.calories} calories</span></p>` : ""}
      ${data.nutrition.protein ? `<p>Protein: <span itemprop="proteinContent">${data.nutrition.protein}</span></p>` : ""}
      ${data.nutrition.carbs ? `<p>Carbs: <span itemprop="carbohydrateContent">${data.nutrition.carbs}</span></p>` : ""}
      ${data.nutrition.fat ? `<p>Fat: <span itemprop="fatContent">${data.nutrition.fat}</span></p>` : ""}
      ${data.nutrition.fiber ? `<p>Fiber: <span itemprop="fiberContent">${data.nutrition.fiber}</span></p>` : ""}
    </div>
  ` : "";

  const timeHtml = `
    ${data.prepTimeIso ? `<p>Prep: <time itemprop="prepTime" datetime="${data.prepTimeIso}">${data.prepTimeHuman}</time></p>` : ""}
    ${data.cookTimeIso ? `<p>Cook: <time itemprop="cookTime" datetime="${data.cookTimeIso}">${data.cookTimeHuman}</time></p>` : ""}
    ${data.totalTimeIso && !data.prepTimeIso && !data.cookTimeIso ? `
      <p>Prep: <time itemprop="prepTime" datetime="${data.totalTimeIso}">${data.totalTimeHuman}</time></p>
      <p>Cook: <time itemprop="cookTime" datetime="${data.totalTimeIso}">${data.totalTimeHuman}</time></p>
    ` : ""}
  `;

  const ingHtml = data.ingredients.map(ing => `<li itemprop="recipeIngredient">${ing}</li>`).join("\n");
  const stepsHtml = data.steps.map(step => `
    <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
      <p itemprop="text">${step}</p>
    </div>
  `).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name}</title>
  <meta charset="utf-8">
  <link rel="canonical" href="${data.sourceUrl}">
  <meta property="og:url" content="${data.sourceUrl}">
  <meta property="og:type" content="article">
</head>
<body>
  <div itemscope itemtype="https://schema.org/Recipe">
    <h1 itemprop="name">${data.name}</h1>
    ${data.image ? `<img itemprop="image" src="${data.image}" style="max-width:400px">` : ""}
    <meta itemprop="url" content="${data.sourceUrl}">
    ${data.yield_ ? `<p>Serves: <span itemprop="recipeYield">${data.yield_}</span></p>` : ""}
    ${timeHtml}
    ${nutHtml}
    ${data.author ? `<p>By: <span itemprop="author">${data.author}</span></p>` : ""}
    <h2>Ingredients</h2>
    <ul>${ingHtml}</ul>
    <h2>Instructions</h2>
    ${stepsHtml}
    <p itemprop="description">${data.description}</p>
  </div>
</body>
</html>`;
}

function renderIndexPage(error = "") {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Instagram → AnyList</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; }
    input { width: 100%; padding: 10px; font-size: 16px; box-sizing: border-box; margin: 10px 0; }
    button { padding: 10px 24px; font-size: 16px; cursor: pointer; }
    .error { color: red; margin-top: 16px; }
  </style>
</head>
<body>
  <h2>Instagram → AnyList</h2>
  <form method="POST" action="/api/convert">
    <input name="url" type="url" placeholder="https://www.instagram.com/reel/..." required>
    <button type="submit">Convert</button>
  </form>
  ${error ? `<p class="error">${error}</p>` : ""}
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
