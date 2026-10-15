/**
 * Reads a recipe's title and ingredient lines from a page's schema.org
 * Recipe data (the JSON-LD most recipe sites embed for search engines), so
 * the recipe index can skip Tavily and the model for those pages.
 */

export type JsonLdRecipe = { title: string | null; ingredients: string[] };

const JSON_LD_SCRIPT =
  /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

// Sites often HTML-escape the strings inside their JSON-LD.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

// Depth-first search for the first Recipe node: the top level, an array of
// nodes, an @graph, or a page's mainEntity.
function findRecipe(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipe(child);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  if (isRecipeNode(record)) return record;
  return findRecipe(record["@graph"]) ?? findRecipe(record.mainEntity);
}

/** The page's recipe, or null if it has no Recipe data with ingredients. */
export function parseRecipeJsonLd(html: string): JsonLdRecipe | null {
  for (const [, body] of html.matchAll(JSON_LD_SCRIPT)) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;

    const raw = recipe.recipeIngredient ?? recipe.ingredients;
    const ingredients = (Array.isArray(raw) ? raw : [raw])
      .map(cleanText)
      .filter((line): line is string => line !== null);
    if (ingredients.length === 0) continue;

    return { title: cleanText(recipe.name), ingredients };
  }
  return null;
}
