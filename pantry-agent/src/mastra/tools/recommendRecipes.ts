import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { extractRecipeTool } from "./extractRecipe";
import { getBoardsTool } from "./getBoards";
import { getPinsFromBoardTool } from "./getPins";
import {
  getCachedBoards,
  getCachedPins,
  getAllCachedBoardIds,
  getAllCachedPinsLightweight,
} from "../../lib/pinterest-cache";
import { pinSelectionAgent } from "../agents/pin-selection-agent";

const selectionSchema = z.object({
  selectedPinIds: z.array(z.string()),
});

const MAX_CANDIDATES_TO_EXTRACT = 5;
const MAX_RECOMMENDATIONS = 3;

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
        matchedOnHandIngredients: z.array(z.string()),
      }),
    ),
  }),
  execute: async (inputData, context) => {
    const { ingredients } = inputData;

    // Cold start: nothing cached at all yet — seed the boards list.
    const existingBoards = await getCachedBoards();
    if (existingBoards.length === 0) {
      await getBoardsTool.execute?.({}, context);
    }

    async function selectCandidates() {
      const allPins = await getAllCachedPinsLightweight();
      if (allPins.length === 0) return [];

      const selectionPrompt = `The user has these ingredients/preferences: ${ingredients.join(", ")}.

Here are their saved pins (id | title | board name):
${allPins.map((p) => `${p.id} | ${p.title ?? "(untitled)"} | ${p.boardName}`).join("\n")}

Select up to ${MAX_CANDIDATES_TO_EXTRACT} pin IDs that look like genuinely good candidates, ordered from best to worst fit.`;

      const selection = await pinSelectionAgent.generate(selectionPrompt, {
        structuredOutput: { schema: selectionSchema },
      });

      const selectedIds = new Set(selection.object.selectedPinIds);
      // preserve the agent's own ordering, not the cache's arbitrary order
      return selection.object.selectedPinIds
        .map((id) => allPins.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p && !!p.sourceLink);
    }

    let candidates = await selectCandidates();

    if (candidates.length === 0) {
      // Boards might exist but their pins were never fetched (or the
      // selection agent genuinely found nothing promising). Only fetch
      // boards with zero cached pins — never re-fetch a board that's
      // already been checked.
      const allBoardIds = await getAllCachedBoardIds();
      const fetchResults = await Promise.all(
        allBoardIds.map(async (boardId) => {
          const pins = await getCachedPins(boardId);
          if (pins.length === 0) {
            await getPinsFromBoardTool.execute?.({ boardId }, context);
            return true;
          }
          return false;
        }),
      );
      const fetchedAny = fetchResults.some(Boolean);

      if (fetchedAny) {
        candidates = await selectCandidates();
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
      matchedOnHandIngredients: string[];
    };

    const results = await Promise.all(
      toExtract.map(async (candidate): Promise<Recommendation | null> => {
        if (!candidate.sourceLink) return null;

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
              matchedOnHandIngredients: extracted.ingredients.map(
                (i) => i.item,
              ),
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
          matchedOnHandIngredients: [],
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
