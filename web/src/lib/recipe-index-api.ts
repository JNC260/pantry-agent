import { fetchJson } from "./api";

export type FailureReason = "dead-link" | "unreadable" | "not-a-recipe" | "errors";

export type UnreadableRecipe = {
  sourceLink: string;
  reason: FailureReason;
  error: string;
  attempts: number;
  lastTriedAt: string;
  // Every recipe pin saved with this link, each with its Pinterest URL.
  pins: {
    id: string;
    url: string;
    title: string | null;
    boardName: string;
    // The board section ("sub-board") it's saved in, if any.
    sectionName: string | null;
  }[];
};

// Mirrors RecipeIndexReport in pantry-agent/src/lib/recipe-index-report.ts.
export type RecipeIndexReport = {
  counts: {
    recipes: number;
    indexed: number;
    unreadable: number;
    // Unreadable, but marked "looks fine".
    accepted: number;
    pending: number;
  };
  unreadable: UnreadableRecipe[];
  // Marked "looks fine": recommended by title, board, and description, and
  // never read again.
  accepted: UnreadableRecipe[];
  // Sites among those that block automated reading: their pins are still
  // recommended, by title and description, but not read again.
  blockedSites: string[];
};

// How far the recipe index has got, and the recipe pins it couldn't read.
export function getRecipeIndexReport(): Promise<RecipeIndexReport> {
  return fetchJson("/recipe-index/report");
}

// The report after re-downloading the recipe boards from Pinterest, plus the
// boards that couldn't be refreshed.
export type RecipeIndexRefresh = RecipeIndexReport & { failedBoards: string[] };

// Re-downloads the recipe boards, so pins deleted or fixed on Pinterest drop
// off the report.
export function refreshRecipeIndex(): Promise<RecipeIndexRefresh> {
  return fetchJson("/recipe-index/refresh", { method: "POST" });
}

// Marks an unreadable recipe link "looks fine" (e.g. a recipe video), or
// takes the mark off, and returns the updated report.
export function setRecipeAccepted(
  url: string,
  accepted: boolean,
): Promise<RecipeIndexReport> {
  return fetchJson("/recipe-index/accept", {
    method: "POST",
    body: JSON.stringify({ url, accepted }),
  });
}
