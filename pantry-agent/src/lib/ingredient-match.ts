/**
 * Matches ingredient names ("crème fraîche", "chicken thighs") against
 * recipes' ingredient lines ("1/2 cup creme fraiche", "4 boneless chicken
 * thighs") for the recipe index. Deliberately loose — word for word,
 * ignoring accents, case, plurals, and prep words — since the pin-selection
 * agent judges the matches afterwards.
 */

// Words that describe how an ingredient was bought or prepped rather than
// what it is, dropped from the ingredient being searched for so that
// "Shredded mozzarella" still finds "8 oz mozzarella".
const DESCRIPTORS = new Set([
  "fresh",
  "frozen",
  "canned",
  "dried",
  "organic",
  "shredded",
  "grated",
  "chopped",
  "diced",
  "sliced",
  "minced",
  "boneless",
  "skinless",
  "large",
  "medium",
  "small",
  "whole",
]);

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

/** Lowercase, accent-free, singular words. */
export function ingredientWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(singular);
}

// The words to look for: the name without its prep words, unless that
// leaves nothing ("Frozen" alone stays "frozen").
function searchWords(name: string): string[] {
  const words = ingredientWords(name);
  const core = words.filter((word) => !DESCRIPTORS.has(word));
  return core.length > 0 ? core : words;
}

/** True when every word of `name` appears in the ingredient line. */
export function lineMentions(name: string, line: string): boolean {
  const wanted = searchWords(name);
  if (wanted.length === 0) return false;
  const present = new Set(ingredientWords(line));
  return wanted.every((word) => present.has(word));
}

export type IngredientMatch<T> = { recipe: T; matched: string[] };

/**
 * Recipes that use at least one of `names`, with the names each one uses,
 * most matches first (ties keep the input order). Names that aren't
 * ingredients, like "dinner" or "asian", simply match nothing.
 */
export function matchRecipes<T extends { ingredients: string[] }>(
  names: string[],
  recipes: T[],
): IngredientMatch<T>[] {
  return recipes
    .map((recipe) => ({
      recipe,
      matched: names.filter((name) =>
        recipe.ingredients.some((line) => lineMentions(name, line)),
      ),
    }))
    .filter((match) => match.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length);
}
