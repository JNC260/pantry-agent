import { fetchJson } from "./api";

export type FailureReason = "dead-link" | "unreadable" | "not-a-recipe" | "errors";

export type UnreadableRecipe = {
  sourceLink: string;
  reason: FailureReason;
  error: string;
  attempts: number;
  lastTriedAt: string;
  // Every recipe pin saved with this link, each with its Pinterest URL.
  pins: { id: string; url: string; title: string | null; boardName: string }[];
};

// Mirrors RecipeIndexReport in pantry-agent/src/lib/recipe-index-report.ts.
export type RecipeIndexReport = {
  counts: {
    recipes: number;
    indexed: number;
    unreadable: number;
    pending: number;
  };
  unreadable: UnreadableRecipe[];
};

// How far the recipe index has got, and the recipe pins it couldn't read.
export function getRecipeIndexReport(): Promise<RecipeIndexReport> {
  return fetchJson("/recipe-index/report");
}
