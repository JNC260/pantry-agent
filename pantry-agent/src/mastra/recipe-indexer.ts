import { isValidationError, noopObserve } from "@mastra/core/tools";
import { createTavilyExtractTool } from "@mastra/tavily";
import { getAllCachedPinsLightweight } from "../lib/pinterest-cache";
import { selectablePins } from "../lib/recipe-boards";
import { getRecipeIndex, saveRecipeIndexEntries } from "../lib/recipe-index";
import { toIndexEntry, type Outcome } from "../lib/recipe-index-entry";
import { parseRecipeJsonLd } from "../lib/recipe-jsonld";
import {
  ingredientListAgent,
  ingredientListSchema,
} from "./agents/ingredient-list-agent";

const tavilyExtractTool = createTavilyExtractTool();

// Tavily extracts up to 20 URLs per request; it's also how often progress
// is saved.
const CHUNK_SIZE = 20;
const FETCH_CONCURRENCY = 6;
const MODEL_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 15_000;
// Same cap as extract-recipe: the ingredients land well within it.
const MAX_PAGE_CHARS = 15_000;
// New pins indexed per daily run, so a big batch of new pins can't run up
// an unexpected bill. The first backfill goes through `npm run index:recipes`.
const DAILY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Many recipe sites turn away requests that don't look like a browser.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml",
};

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

// The free path: fetch the page and read its schema.org recipe data. A dead
// link is final; anything else (blocked, no recipe data) goes to Tavily
// (null).
async function readDirectly(url: string): Promise<Outcome | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) {
      return {
        url,
        kind: "failed",
        reason: "dead-link",
        error: `The recipe site says the page is gone (${res.status})`,
      };
    }
    if (res.ok) {
      const recipe = parseRecipeJsonLd(await res.text());
      if (recipe) return { url, kind: "ok", source: "jsonld", ...recipe };
    }
  } catch {
    // network error or timeout: Tavily may still get through
  }
  return null;
}

// Tavily may report a link slightly differently than it was asked for
// (scheme, www, trailing slash).
const comparableUrl = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

// The paid path: Tavily fetches the pages, the small model lists the
// ingredients. Returns an outcome for every url asked for.
async function readWithTavily(urls: string[]): Promise<Outcome[]> {
  if (urls.length === 0) return [];
  let extracted;
  try {
    extracted = await tavilyExtractTool.execute?.(
      { urls, extractDepth: "advanced", format: "markdown" },
      { observe: noopObserve },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Tavily throws instead of listing failedResults when it refuses every
    // link (some publishers block it outright); that's final, not transient.
    if (message.includes("failed validation")) {
      return urls.map((url) => ({
        url,
        kind: "failed",
        reason: "unreadable",
        error: "The recipe site blocks automated reading",
      }));
    }
    console.error("[recipe-indexer] Tavily extract failed:", err);
    return urls.map((url) => ({
      url,
      kind: "transient",
      error: `Tavily request failed: ${message}`,
    }));
  }
  if (!extracted || isValidationError(extracted)) {
    return urls.map((url) => ({
      url,
      kind: "transient",
      error: "Tavily returned an unexpected response",
    }));
  }

  const requested = new Map(urls.map((url) => [comparableUrl(url), url]));
  const original = (reported: string) =>
    urls.includes(reported) ? reported : requested.get(comparableUrl(reported));

  const outcomes: Outcome[] = [];
  for (const failure of extracted.failedResults) {
    const url = original(failure.url);
    if (url) {
      const gone = /\b(404|410)\b/.test(failure.error);
      outcomes.push({
        url,
        kind: "failed",
        reason: gone ? "dead-link" : "unreadable",
        error: gone
          ? `The recipe site says the page is gone (${failure.error})`
          : `Couldn't read the page: ${failure.error}`,
      });
    }
  }

  const pages = extracted.results.flatMap((page) => {
    const url = original(page.url);
    return url ? [{ url, content: page.rawContent }] : [];
  });
  outcomes.push(
    ...(await mapLimit(pages, MODEL_CONCURRENCY, async (page): Promise<Outcome> => {
      try {
        const result = await ingredientListAgent.generate(
          `List this recipe's ingredients.\n\nCONTENT:\n${page.content.slice(0, MAX_PAGE_CHARS)}`,
          { structuredOutput: { schema: ingredientListSchema } },
        );
        const { isRecipe, title, ingredients } = result.object;
        const names = ingredients.map((i) => i.trim()).filter(Boolean);
        return isRecipe && names.length > 0
          ? { url: page.url, kind: "ok", source: "ai", title, ingredients: names }
          : {
              url: page.url,
              kind: "failed",
              reason: "not-a-recipe",
              error: "The page was read but isn't a single recipe",
            };
      } catch (err) {
        console.error(`[recipe-indexer] couldn't list ingredients for ${page.url}:`, err);
        return {
          url: page.url,
          kind: "transient",
          error: `Listing ingredients failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    })),
  );

  // Anything Tavily silently left out counts as a transient failure, so it
  // can't be retried (and paid for) forever.
  const answered = new Set(outcomes.map((o) => o.url));
  for (const url of urls) {
    if (!answered.has(url)) {
      outcomes.push({ url, kind: "transient", error: "Tavily returned nothing for it" });
    }
  }
  return outcomes;
}

export type IndexSummary = {
  pending: number;
  attempted: number;
  fromPageData: number;
  fromAi: number;
  failed: number;
  // Transient errors, tried again next run.
  retryLater: number;
};

/**
 * Indexes recipe pins that aren't in the index yet or hit a transient
 * error last time (and, with `retryFailed`, ones given up on), at most
 * `limit` of them. Saves after every chunk, so an interrupted run keeps its
 * progress.
 */
export async function indexPendingRecipes({
  limit,
  retryFailed = false,
  log = () => {},
}: {
  limit: number;
  retryFailed?: boolean;
  log?: (message: string) => void;
}): Promise<IndexSummary> {
  const [pins, index] = await Promise.all([
    getAllCachedPinsLightweight(),
    getRecipeIndex(),
  ]);
  const pending = selectablePins(pins)
    .map((pin) => pin.sourceLink)
    .filter((url) => {
      const entry = index.get(url);
      return (
        !entry ||
        entry.status === "retry" ||
        (retryFailed && entry.status === "failed")
      );
    });
  const toIndex = pending.slice(0, limit);

  const summary: IndexSummary = {
    pending: pending.length,
    attempted: toIndex.length,
    fromPageData: 0,
    fromAi: 0,
    failed: 0,
    retryLater: 0,
  };

  for (let start = 0; start < toIndex.length; start += CHUNK_SIZE) {
    const chunk = toIndex.slice(start, start + CHUNK_SIZE);
    const direct = await mapLimit(chunk, FETCH_CONCURRENCY, readDirectly);
    const outcomes = [
      ...direct.filter((o): o is Outcome => o !== null),
      ...(await readWithTavily(chunk.filter((_, i) => direct[i] === null))),
    ];
    const entries = outcomes.map((o) => toIndexEntry(o, index.get(o.url)));
    await saveRecipeIndexEntries(entries);

    for (const entry of entries) {
      if (entry.status === "ok") {
        if (entry.source === "jsonld") summary.fromPageData++;
        else summary.fromAi++;
      } else if (entry.status === "failed") summary.failed++;
      else summary.retryLater++;
    }
    log(
      `[recipe-indexer] ${Math.min(start + CHUNK_SIZE, toIndex.length)}/${toIndex.length} done`,
    );
  }

  return summary;
}

async function runDailyIndex() {
  try {
    const summary = await indexPendingRecipes({ limit: DAILY_LIMIT });
    if (summary.attempted > 0) {
      console.log("[recipe-indexer] daily run:", summary);
    }
  } catch (err) {
    console.error("[recipe-indexer] daily run failed:", err);
  }
}

// Indexes newly saved recipe pins at startup and then daily, up to
// DAILY_LIMIT each time. RECIPE_INDEXING=off turns it off — set it locally,
// since dev shares the cache database with production and would otherwise
// index (and pay for) the same pins.
export function startRecipeIndexing() {
  if (process.env.RECIPE_INDEXING === "off") return;

  // guard against duplicate timers when `mastra dev` reloads this module
  const g = globalThis as { __recipeIndexTimer?: NodeJS.Timeout };
  if (g.__recipeIndexTimer) return;

  void runDailyIndex();
  g.__recipeIndexTimer = setInterval(() => void runDailyIndex(), DAY_MS);
  g.__recipeIndexTimer.unref();
}
