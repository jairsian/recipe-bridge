const BULLET_RE = /^[\t\s]*[•\-\*▪️➡️▢☐□✅]\t?\s*/;
const NUMBERED_RE = /^[\t\s]*\d+[\.\)]\t?\s*/;
const SECTION_HEADER_RE = /^(ingredient|method|instruction|direction|step|for the|to cook|to finish|to serve|note)/i;
const HASHTAG_RE = /^#\w+/;
const QUANTITY_RE = /^([\d½¼¾⅓⅔\-–]+[\d./\s]*)?\s*(tbsp|tsp|cup|cups|g|kg|ml|l|oz|lb|clove|cloves|slice|slices|handful|pinch|piece|pieces|can|cans|bunch|sprig|sprigs)\b/i;
const ACTION_WORDS = /^(mix|combine|stir|add|toss|cook|heat|fry|bake|roast|grill|boil|simmer|blend|whisk|fold|pour|serve|season|taste|chop|slice|dice|mince|drain|rinse|marinate|coat|spread|place|put|bring|remove|let|top|garnish|squeeze|drizzle|sprinkle|soak|finish|meanwhile)/i;
const SERVES_RE = /serve[s]?\s*(\d+)|(\d+)\s*(serving|portion|people)/i;
const PREP_TIME_RE = /prep\s*:?\s*(\d+)\s*(min|minute|hour|hr)s?/i;
const COOK_TIME_RE = /cook\s*:?\s*(\d+)\s*(min|minute|hour|hr)s?/i;
const TIME_RE = /(\d+)\s*(min|minute|hour|hr)s?/i;
const MACROS_LINE_RE = /(\d+)\s*cal/i;

function toIsoDuration(value, unit) {
  if (!value) return "";
  if (unit.toLowerCase().startsWith("h")) {
    return `PT${value}H`;
  }
  return `PT${value}M`;
}

function humanDuration(value, unit) {
  if (!value) return "";
  const label = unit.toLowerCase().startsWith("h") ? "hour" : "minute";
  const plural = parseInt(value) !== 1 ? "s" : "";
  return `${value} ${label}${plural}`;
}

function parseNutrition(line) {
  const cal = line.match(/(\d+)\s*cal/i);
  const protein = line.match(/(\d+)g?\s*protein/i);
  const carbs = line.match(/(\d+)g?\s*carb/i);
  const fat = line.match(/(\d+)g?\s*fat/i);
  const fiber = line.match(/(\d+)g?\s*fi(?:bre|ber)/i);

  if (!cal) return null;

  return {
    calories: cal ? cal[1] : "",
    protein: protein ? `${protein[1]}g` : "",
    carbs: carbs ? `${carbs[1]}g` : "",
    fat: fat ? `${fat[1]}g` : "",
    fiber: fiber ? `${fiber[1]}g` : ""
  };
}

function cleanIngredient(text) {
  return text
    // Do not use Unicode's Emoji property: it also matches quantity digits.
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0e\ufe0f\u20e3]/gu, "")
    .replace(/[▢☐☑☒□■▪▫✓✔]/gu, "")
    .replace(/^\s*(?:[•*–—-]\s*)+/, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

// Read metadata only before the recipe body, never from ingredient subheadings.
const PROMO_RE = /(?:https?:\/\/|www\.|@|#|\b(?:comment|follow|subscribe|link in (?:my |the )?bio|dm me|send (?:it|you)|full recipe|save this|tag a friend)\b)/i;
const BODY_HEADER_RE = /^(?:ingredients?|method|instructions?|directions?|steps?|notes?|tips?|here[’']?s what you need)\s*:?$/i;

function captionMetadata(lines) {
  const boundary = lines.findIndex(line => BODY_HEADER_RE.test(line) || BULLET_RE.test(line) || NUMBERED_RE.test(line) || QUANTITY_RE.test(line));
  const intro = lines.slice(0, boundary < 0 ? lines.length : boundary);
  const titleIndex = intro.findIndex(line => !PROMO_RE.test(line) && !SERVES_RE.test(line) && !PREP_TIME_RE.test(line) && !COOK_TIME_RE.test(line) && !MACROS_LINE_RE.test(line) && /\p{L}/u.test(line));
  let name = titleIndex < 0 ? "Recipe" : cleanIngredient(intro[titleIndex]);
  name = name.replace(/^(?:recipe\s*[:：-]\s*|how to make\s+)/i, "")
    .split(/\s+(?:offers?|is|are|makes?|has|will|comes?)\s+|[.!?](?:\s|$)|\s+[—–]\s+/i)[0]
    .replace(/\s+recipe$/i, "").trim().slice(0, 120) || "Recipe";

  const notes = [];
  let inNotes = false;
  for (const line of lines) {
    const heading = line.match(/^(?:notes?|tips?)\s*:\s*(.*)$/i);
    if (heading || /^(?:notes?|tips?)$/i.test(line)) {
      inNotes = true;
      if (heading && heading[1]) notes.push(heading[1]);
      continue;
    }
    if (inNotes && BODY_HEADER_RE.test(line)) inNotes = false;
    if (inNotes && !PROMO_RE.test(line)) notes.push(line);
  }
  const introNotes = intro.filter((line, index) => index >= titleIndex && titleIndex >= 0)
    .join(" ").split(/(?<=[.!?])\s+/)
    .filter(sentence => !PROMO_RE.test(sentence))
    .map(sentence => {
      let text = cleanIngredient(sentence);
      if (text.toLowerCase().startsWith(name.toLowerCase())) text = text.slice(name.length).replace(/^\s*(?:offers?|is|are|makes?|has)\s+/i, "").trim();
      return text.replace(/^[.!?:—–-]+\s*/, "");
    }).filter(text => /\p{L}/u.test(text) && text.toLowerCase() !== name.toLowerCase());
  return {name, intro, description: (notes.length ? notes : introNotes).map(cleanIngredient).filter(Boolean).join(" ")};
}

function parseCaption(caption, oembedData, sourceUrl) {
  const lines = caption.split("\n").map(l => l.trim()).filter(l => l);

  const author = oembedData.author_name || "";
  const image = oembedData.thumbnail_url || "";

  const metadata = captionMetadata(lines);
  const name = metadata.name;

  // --- Yield, time, nutrition ---
  let yield_ = "";
  let prepTimeIso = "", prepTimeHuman = "";
  let cookTimeIso = "", cookTimeHuman = "";
  let totalTimeIso = "", totalTimeHuman = "";
  let nutrition = null;
  const description = metadata.description;

  for (const l of lines) {
    if (!yield_) {
      const sm = l.match(SERVES_RE);
      if (sm) {
        yield_ = sm[1] || sm[2];
      }
    }

    if (!prepTimeIso) {
      const pm = l.match(PREP_TIME_RE);
      if (pm) {
        prepTimeIso = toIsoDuration(pm[1], pm[2]);
        prepTimeHuman = humanDuration(pm[1], pm[2]);
      }
    }

    if (!cookTimeIso) {
      const cm = l.match(COOK_TIME_RE);
      if (cm) {
        cookTimeIso = toIsoDuration(cm[1], cm[2]);
        cookTimeHuman = humanDuration(cm[1], cm[2]);
      }
    }

    if (!totalTimeIso && !prepTimeIso && !cookTimeIso) {
      const tm = l.match(TIME_RE);
      if (tm) {
        totalTimeIso = toIsoDuration(tm[1], tm[2]);
        totalTimeHuman = humanDuration(tm[1], tm[2]);
      }
    }

    if (!nutrition && MACROS_LINE_RE.test(l)) {
      nutrition = parseNutrition(l);
    }
  }

  // --- Structural parse ---
  const titleLine = name;
  const MODE_NONE = "none";
  const MODE_ING = "ingredients";
  const MODE_STEPS = "steps";
  let mode = MODE_NONE;
  let inNotes = false;

  const ingredients = [];
  const steps = [];

  for (const line of lines) {
    const cleanBullet = line.replace(BULLET_RE, "").trim();
    const cleanNum = line.replace(NUMBERED_RE, "").trim();

    if (/^(?:notes?|tips?)(?:\s*:|$)/i.test(line)) { inNotes = true; continue; }
    if (inNotes && BODY_HEADER_RE.test(line)) inNotes = false;
    if (inNotes || metadata.intro.includes(line) || (!BULLET_RE.test(line) && !QUANTITY_RE.test(line) && PROMO_RE.test(line))) continue;

    if (cleanBullet === titleLine || HASHTAG_RE.test(line) || line.split("#").length > 2) {
      continue;
    }

    if (/^here[’']?s what you need:?$/i.test(line)) {
      mode = MODE_ING;
      continue;
    }

    if (SECTION_HEADER_RE.test(line)) {
      if (/^ingredient/i.test(line)) {
        mode = MODE_ING;
      } else if (/^(method|instruction|direction|step)/i.test(line)) {
        mode = MODE_STEPS;
      }
      continue;
    }

    // A named component followed by checkbox ingredients is a subheading.
    const nextLine = lines[lines.indexOf(line) + 1] || "";
    if (mode === MODE_ING && !BULLET_RE.test(line) && cleanBullet.split(" ").length >= 2
        && name.toLowerCase().includes(cleanBullet.toLowerCase()) && BULLET_RE.test(nextLine)) continue;

    if (NUMBERED_RE.test(line)) {
      const sentences = cleanNum.split(/\.\s+/);
      steps.push(...sentences.filter(s => s.trim().length > 4).map(s => s.trim()));
      if (mode === MODE_NONE) {
        mode = MODE_STEPS;
      }
      continue;
    }

    if (BULLET_RE.test(line)) {
      if (mode === MODE_STEPS) {
        steps.push(cleanBullet);
      } else {
        ingredients.push(cleanBullet);
      }
      continue;
    }

    if (mode === MODE_ING && (QUANTITY_RE.test(cleanBullet) || cleanBullet.split(" ").length <= 6)) {
      ingredients.push(cleanBullet);
      continue;
    }

    if (mode === MODE_STEPS) {
      const sentences = cleanBullet.split(/\.\s+/);
      steps.push(...sentences.filter(s => ACTION_WORDS.test(s.trim()) && s.trim().length > 4).map(s => s.trim()));
      continue;
    }

    const isShortNoun = cleanBullet.split(" ").length <= 5 && !ACTION_WORDS.test(cleanBullet) && !cleanBullet.endsWith(".");
    if (QUANTITY_RE.test(cleanBullet) || isShortNoun) {
      ingredients.push(cleanBullet);
    } else if (ACTION_WORDS.test(cleanBullet)) {
      const sentences = cleanBullet.split(/\.\s+/);
      steps.push(...sentences.filter(s => s.trim().length > 4).map(s => s.trim()));
    }
  }

  return {
    name,
    author,
    image,
    sourceUrl,
    ingredients: ingredients.map(cleanIngredient).filter(Boolean),
    steps,
    yield_,
    prepTimeIso,
    prepTimeHuman,
    cookTimeIso,
    cookTimeHuman,
    totalTimeIso,
    totalTimeHuman,
    nutrition,
    description
  };
}

module.exports = { parseCaption };
