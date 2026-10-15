import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { extractRecipeTool } from "./extract-recipe";
import { getBoardsTool } from "./get-boards";
import { getPinsFromBoardTool } from "./get-pins-from-board";
import {
  getCachedBoards,
  getCachedPins,
  getAllCachedPinsLightweight,
} from "../../lib/pinterest-cache";
import {
  isRecipeBoard,
  missingRecipeBoards,
  selectablePins,
} from "../../lib/recipe-boards";
import { getRecipeIndex } from "../../lib/recipe-index";
import { matchRecipes } from "../../lib/ingredient-match";
import { pinSelectionAgent } from "../agents/pin-selection-agent";

const selectionSchema = z.object({
  selectedPinIds: z.array(z.string()),
});

const MAX_CANDIDATES_TO_EXTRACT = 5;

const MAX_RECOMMENDATIONS = 3;

// Indexed recipes whose ingredient lists use the requested ingredients,
// shown to the selection agent with those lists.
const MAX_INGREDIENT_MATCHES = 30;

/**
 * Asks the selection agent which cached recipe pins best fit the request.
 * It sees every pin's title and board name, plus the real ingredient lists
 * of indexed recipes that use the requested ingredients (see
 * src/lib/recipe-index.ts). Pins the index found dead or not a recipe are
 * left out. Returns them best first, with their indexed ingredients if any.
 */
export async function selectCandidates(ingredients: string[]) {
  const [cachedPins, index] = await Promise.all([
    getAllCachedPinsLightweight(),
    getRecipeIndex(),
  ]);
  const allPins = selectablePins(cachedPins)
    .filter((p) => index.get(p.sourceLink)?.status !== "failed")
    .map((p) => {
      const entry = index.get(p.sourceLink);
      const indexed = entry?.status === "ok" ? entry : null;
      // Many pins have a blank title; the recipe page's own title fills in.
      return { ...p, title: p.title || indexed?.title || null, indexed };
    });
  if (allPins.length === 0) return [];

  const matches = matchRecipes(
    ingredients,
    allPins.flatMap((pin) =>
      pin.indexed ? [{ pin, ingredients: pin.indexed.ingredients }] : [],
    ),
  ).slice(0, MAX_INGREDIENT_MATCHES);
  const matchList =
    matches.length > 0
      ? `

These saved recipes' actual ingredient lists use some of those (id | title | uses | full ingredient list):
${matches
  .map(
    ({ recipe, matched }) =>
      `${recipe.pin.id} | ${recipe.pin.title ?? "(untitled)"} | ${matched.join(", ")} | ${recipe.ingredients.join("; ")}`,
  )
  .join("\n")}`
      : "";

  const pinList = `Here are the user's saved pins (id | title | board name):
${allPins.map((p) => `${p.id} | ${p.title ?? "(untitled)"} | ${p.boardName}`).join("\n")}`;

  const selection = await pinSelectionAgent.generate(
    [
      // The pin list only changes when the cache does, so it goes first
      // and is marked for prompt caching; the per-request part follows.
      {
        role: "user",
        content: pinList,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        role: "user",
        content: `The user has these ingredients/preferences: ${ingredients.join(", ")}.${matchList}

Select up to ${MAX_CANDIDATES_TO_EXTRACT} pin IDs that look like genuinely good candidates, ordered from best to worst fit.`,
      },
    ],
    { structuredOutput: { schema: selectionSchema } },
  );

  // preserve the agent's own ordering, not the cache's arbitrary order
  const pinsById = new Map(allPins.map((p) => [p.id, p]));
  return selection.object.selectedPinIds
    .map((id) => pinsById.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);
}

/**
 * Recommends up to 3 recipes from the user's own pins for what they have on
 * hand or feel like eating.
 *
 * 1. On a cold start, seeds the boards cache.
 * 2. Has the pin-selection agent shortlist up to 5 recipe pins by title and,
 *    for indexed recipes, by their real ingredients.
 * 3. If nothing fits, fetches recipe boards whose pins were never cached
 *    (never re-fetching a board already checked) and asks again.
 * 4. Takes each pick's ingredients from the recipe index, or extracts the
 *    ones not indexed yet in parallel; a pin that fails to extract is still
 *    offered by link.
 *
 * Returns an empty list rather than a weak guess, which tells the agent to
 * fall back to web search.
 */
export const recommendRecipesTool = createTool({
  id: "recommend-recipes",
  description:
    "Given what the user has on hand and/or what they're in the mood for, searches the user's cached Pinterest pins for matching recipes and returns the best matches with real extracted details. Returns an empty recommendations array if nothing in the user's pins looks like a good fit — in that case, fall back to the web-search tool instead.",
  inputSchema: z.object({
    ingredients: z
      .array(z.string())
      .describe(
        "Ingredients the user currently has on hand, and/or style/cuisine preferences, e.g. ['chicken breast', 'kale'] or ['chicken', 'asian']",
      ),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        title: z.string(),
        sourceLink: z.string(),
        boardName: z.string(),
        ingredients: z
          .array(z.string())
          .describe(
            "Every ingredient the recipe calls for; empty if the page couldn't be extracted",
          ),
      }),
    ),
  }),
  execute: async (inputData, context) => {
    const { ingredients } = inputData;

    // Cold start: nothing cached at all yet — seed the boards list.
    if ((await getCachedBoards()).length === 0) {
      await getBoardsTool.execute?.({}, context);
    }
    const boards = await getCachedBoards();
    const missing = missingRecipeBoards(boards);
    if (missing.length > 0) {
      console.warn(
        `[recommend-recipes] recipe boards not found on Pinterest (renamed?): ${missing.join(", ")}`,
      );
    }

    let candidates = await selectCandidates(ingredients);

    if (candidates.length === 0) {
      // Boards might exist but their pins were never fetched (or the
      // selection agent genuinely found nothing promising). Only fetch
      // boards with zero cached pins — never re-fetch a board that's
      // already been checked.
      // A board that fails to fetch is skipped rather than failing the whole
      // recommendation; it's retried next time since it still has no pins.
      const recipeBoardIds = boards
        .filter((b) => isRecipeBoard(b.name))
        .map((b) => b.id);
      const fetchResults = await Promise.allSettled(
        recipeBoardIds.map(async (boardId) => {
          const pins = await getCachedPins(boardId);
          if (pins.length === 0) {
            await getPinsFromBoardTool.execute?.({ boardId }, context);
            return true;
          }
          return false;
        }),
      );
      for (const [i, result] of fetchResults.entries()) {
        if (result.status === "rejected") {
          console.error(
            `[recommend-recipes] skipping board ${recipeBoardIds[i]}:`,
            result.reason,
          );
        }
      }
      const fetchedAny = fetchResults.some(
        (r) => r.status === "fulfilled" && r.value,
      );

      if (fetchedAny) {
        candidates = await selectCandidates(ingredients);
      }
    }

    if (candidates.length === 0) {
      return { recommendations: [] };
    }

    const toExtract = candidates.slice(0, MAX_CANDIDATES_TO_EXTRACT);

    type Recommendation = {
      title: string;
      sourceLink: string;
      boardName: string;
      ingredients: string[];
    };

    const results = await Promise.all(
      toExtract.map(async (candidate): Promise<Recommendation | null> => {
        if (!candidate.sourceLink) return null;

        if (candidate.indexed) {
          return {
            title: candidate.title ?? `Recipe from ${candidate.boardName}`,
            sourceLink: candidate.sourceLink,
            boardName: candidate.boardName,
            ingredients: candidate.indexed.ingredients,
          };
        }

        try {
          const extracted = await extractRecipeTool.execute?.(
            { url: candidate.sourceLink },
            context,
          );

          if (extracted && !isValidationError(extracted)) {
            return {
              title: extracted.title,
              sourceLink: candidate.sourceLink,
              boardName: candidate.boardName,
              ingredients: extracted.ingredients.map((i) => i.item),
            };
          }
        } catch (err) {
          console.error(`Extraction failed for ${candidate.sourceLink}:`, err);
        }

        // extraction failed or returned nothing usable — still offer the
        // link, since selection already judged this a good fit
        return {
          title: candidate.title ?? `Recipe from ${candidate.boardName}`,
          sourceLink: candidate.sourceLink,
          boardName: candidate.boardName,
          ingredients: [],
        };
      }),
    );

    // selection's own ordering is the ranking — no re-sorting needed
    const recommendations = results
      .filter((r): r is Recommendation => r !== null)
      .slice(0, MAX_RECOMMENDATIONS);

    return { recommendations };
  },
});
