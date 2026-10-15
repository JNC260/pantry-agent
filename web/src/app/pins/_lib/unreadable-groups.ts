import type { FailureReason, UnreadableRecipe } from "@/lib/recipe-index-api";

export type UnreadableGroup = {
  reason: FailureReason;
  title: string;
  description: string;
  recipes: UnreadableRecipe[];
};

// In display order: the likeliest to need deleting first.
const GROUPS: Omit<UnreadableGroup, "recipes">[] = [
  {
    reason: "dead-link",
    title: "Dead links",
    description:
      "The recipe site says the page no longer exists. Unless the pin itself has the recipe, it's probably safe to delete.",
  },
  {
    reason: "not-a-recipe",
    title: "Not a recipe",
    description:
      "The link opens something other than a single recipe — a homepage, a roundup, or a redirect somewhere else.",
  },
  {
    reason: "unreadable",
    title: "Couldn't be read",
    description:
      "The site blocks automated reading or wouldn't load. The recipe may be fine: the agent still recommends it by its title and Pinterest description, it just can't search it by ingredient.",
  },
  {
    reason: "errors",
    title: "Kept failing",
    description: "Errored on every try. Worth a look to see if the link still works.",
  },
];

/** The unreadable recipes in their reason's group, skipping empty groups. */
export function groupUnreadable(recipes: UnreadableRecipe[]): UnreadableGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    recipes: recipes.filter((recipe) => recipe.reason === group.reason),
  })).filter((group) => group.recipes.length > 0);
}

/** "example.com" for a recipe link, or the link itself if it won't parse. */
export function siteName(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/**
 * The blocked sites with how many of `recipes` each has, most first (ties
 * by name).
 */
export function blockedSiteCounts(
  recipes: UnreadableRecipe[],
  blockedSites: string[],
): { site: string; recipes: number }[] {
  const blocked = new Set(blockedSites);
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    const site = siteName(recipe.sourceLink);
    if (blocked.has(site)) counts.set(site, (counts.get(site) ?? 0) + 1);
  }
  return [...counts]
    .map(([site, count]) => ({ site, recipes: count }))
    .sort((a, b) => b.recipes - a.recipes || a.site.localeCompare(b.site));
}
