/**
 * What the recipe indexer records for each link (see recipe-index.ts for
 * the table and src/mastra/recipe-indexer.ts for the indexer).
 */

/** Tries before a link that keeps erroring is given up on. */
export const MAX_ATTEMPTS = 3;

export type FailureReason =
  // The recipe site says the page is gone (404/410).
  | "dead-link"
  // Neither a direct fetch nor Tavily could read the page.
  | "unreadable"
  // The page was read but isn't a single recipe.
  | "not-a-recipe"
  // Errored on every try (MAX_ATTEMPTS of them).
  | "errors";

export type RecipeIndexEntry =
  | {
      url: string;
      status: "ok";
      title: string | null;
      ingredients: string[];
      source: "jsonld" | "ai";
    }
  | {
      url: string;
      status: "failed" | "retry";
      reason: FailureReason;
      error: string;
      attempts: number;
    };

// What one attempt at a link came to. "transient" errors are retried on
// later runs, up to MAX_ATTEMPTS tries in all.
export type Outcome =
  | {
      url: string;
      kind: "ok";
      title: string | null;
      ingredients: string[];
      source: "jsonld" | "ai";
    }
  | { url: string; kind: "failed"; reason: FailureReason; error: string }
  | { url: string; kind: "transient"; error: string };

// The row to save for an outcome. Every failed try counts toward
// MAX_ATTEMPTS; a link that keeps erroring is given up on as "errors".
export function toIndexEntry(
  outcome: Outcome,
  previous: RecipeIndexEntry | undefined,
): RecipeIndexEntry {
  if (outcome.kind === "ok") {
    const { url, title, ingredients, source } = outcome;
    return { url, status: "ok", title, ingredients, source };
  }
  const attempts =
    (previous && previous.status !== "ok" ? previous.attempts : 0) + 1;
  if (outcome.kind === "failed") {
    const { url, reason, error } = outcome;
    return { url, status: "failed", reason, error, attempts };
  }
  return attempts >= MAX_ATTEMPTS
    ? {
        url: outcome.url,
        status: "failed",
        reason: "errors",
        error: `Failed ${attempts} times; last error: ${outcome.error}`,
        attempts,
      }
    : {
        url: outcome.url,
        status: "retry",
        reason: "errors",
        error: outcome.error,
        attempts,
      };
}

