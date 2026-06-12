# Recipe Bridge — Instagram → AnyList

Convert Instagram reel captions into AnyList-parseable recipe pages with full microdata support (Schema.org Recipe).

## Deployment to Vercel (Free)

1. **Create a GitHub repo** and push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/recipe-bridge.git
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New..." → "Project"
   - Select your GitHub repo
   - Vercel auto-detects the setup — click "Deploy"

3. **Use it**:
   - Visit `https://your-project.vercel.app/api`
   - Paste an Instagram reel URL
   - Use the AnyList Chrome extension on the recipe page

## Local development

```bash
npm install
node api/index.js
# Visit http://localhost:3000/api
```

## What it does

- Fetches Instagram reel caption via oEmbed API
- Parses ingredients, instructions, yield, time, nutrition
- Renders Schema.org Recipe microdata for AnyList to read
- Extracts clean notes/description for AnyList notes field
