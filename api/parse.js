const BULLET_RE = /^[\t\s]*[•\-\*▪️➡️]\t?\s*/;
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
const TITLE_LINE_RE = /^[A-Z][a-zA-Z]+(?:\s+[a-zA-Z&\-]+){1,8}$/;
const TITLE_EXCLUDE_RE = /\b(chopped|shredded|diced|sliced|fresh|dried|cooked|raw|boneless|skinless|beans|seeds|leaves|sauce$|oil$|vinegar$|syrup$)\b/i;

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

function parseCaption(caption, oembedData, sourceUrl) {
  const lines = caption.split("\n").map(l => l.trim()).filter(l => l);

  const author = oembedData.author_name || "";
  const image = oembedData.thumbnail_url || "";

  // --- Title ---
  let name = "Recipe";
  for (const l of lines) {
    if (TITLE_LINE_RE.test(l) && !QUANTITY_RE.test(l) && !SECTION_HEADER_RE.test(l) && !TITLE_EXCLUDE_RE.test(l)) {
      name = l;
      break;
    }
  }
  if (name === "Recipe" && lines.length > 0) {
    name = lines[0].split(/[.!?]/)[0].trim().slice(0, 80);
  }

  // --- Yield, time, nutrition ---
  let yield_ = "";
  let prepTimeIso = "", prepTimeHuman = "";
  let cookTimeIso = "", cookTimeHuman = "";
  let totalTimeIso = "", totalTimeHuman = "";
  let nutrition = null;
  let description = "";

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

  // --- Description ---
  for (const l of lines) {
    const cleanL = l.replace(BULLET_RE, "").trim();
    if (
      cleanL.length > 40
      && !MACROS_LINE_RE.test(cleanL)
      && !l.startsWith("#")
      && cleanL !== name
      && !SECTION_HEADER_RE.test(cleanL)
      && !QUANTITY_RE.test(cleanL)
      && !NUMBERED_RE.test(l)
      && !BULLET_RE.test(l)
    ) {
      description = cleanL.split(/\.\s+/)[0].trim().slice(0, 300);
      break;
    }
  }
  if (!description) {
    description = name;
  }

  // --- Structural parse ---
  const titleLine = name;
  const MODE_NONE = "none";
  const MODE_ING = "ingredients";
  const MODE_STEPS = "steps";
  let mode = MODE_NONE;

  const ingredients = [];
  const steps = [];

  for (const line of lines) {
    const cleanBullet = line.replace(BULLET_RE, "").trim();
    const cleanNum = line.replace(NUMBERED_RE, "").trim();

    if (cleanBullet === titleLine || HASHTAG_RE.test(line) || line.split("#").length > 2) {
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
    ingredients,
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
