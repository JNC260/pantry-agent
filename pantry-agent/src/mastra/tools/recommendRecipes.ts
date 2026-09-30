import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { extractRecipeTool } from "./extractRecipe";
import { getBoardsTool } from "./getBoards";
import { getPinsFromBoardTool } from "./getPins";
import {
  getCachedBoards,
  getCachedPins,
  getAllCachedPinsLightweight,
  type LightweightPin,
} from "../../lib/pinterest-cache";
import { pinSelectionAgent } from "../agents/pin-selection-agent";

const selectionSchema = z.object({
  selectedPinIds: z.array(z.string()),
});

const MAX_CANDIDATES_TO_EXTRACT = 5;

// Boards whose pins are recipes. Only these are considered for
// recommendations; the rest (clothes, house, travel…) are thousands of pins
// that would only bloat the selection prompt. Matched by name, ignoring case,
// so renaming a board on Pinterest means updating it here too.
const RECIPE_BOARDS = [
  "Baby Snacks",
  "Breakfast of champions...",
  "Getting Tipsy",
  "If fish is what you wish...",
  "It ain't easy being green...",
  "Pastabilities",
  "Shameless carnivore :)",
  "Sides, apps, and everything in between...",
  "Stuff I've Done!",
  "Sweet stuff",
];
const RECIPE_BOARD_NAMES = new Set(
  RECIPE_BOARDS.map((name) => name.trim().toLowerCase()),
);

function isRecipeBoard(boardName: string) {
  return RECIPE_BOARD_NAMES.has(boardName.trim().toLowerCase());
}

// Warns when a listed board no longer exists (e.g. it was renamed), since its
// recipes would otherwise silently drop out of recommendations.
function warnAboutMissingRecipeBoards(boards: { name: string }[]) {
  const present = new Set(boards.map((b) => b.name.trim().toLowerCase()));
  const missing = RECIPE_BOARDS.filter(
    (name) => !present.has(name.trim().toLowerCase()),
  );
  if (missing.length > 0) {
    console.warn(
      `[recommend-recipes] recipe boards not found on Pinterest (renamed?): ${missing.join(", ")}`,
    );
  }
}

// Only pins that could become a recommendation: they're on a recipe board,
// they need a link, and a recipe saved to several boards is listed once. Sorted so the prompt built
// from them is byte-identical between requests (needed for prompt caching).
function selectablePins(pins: LightweightPin[]) {
  const sorted = pins
    .filter(
      (p): p is LightweightPin & { sourceLink: string } =>
        !!p.sourceLink && isRecipeBoard(p.boardName),
    )
    .sort(
      (a, b) =>
        a.boardName.localeCompare(b.boardName) || a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  return sorted.filter((p) => {
    if (seen.has(p.sourceLink)) return false;
    seen.add(p.sourceLink);
    return true;
  });
}

const MAX_RECOMMENDATIONS = 3;

// Asks the selection agent which cached pins best fit the request.
export async function selectCandidates(ingredients: string[]) {
  const allPins = selectablePins(await getAllCachedPinsLightweight());
  if (allPins.length === 0) return [];

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
        content: `The user has these ingredients/preferences: ${ingredients.join(", ")}.

Select up to ${MAX_CANDIDATES_TO_EXTRACT} pin IDs that look like genuinely good candidates, ordered from best to worst fit.`,
      },
    ],
    { structuredOutput: { schema: selectionSchema } },
  );

  // preserve the agent's own ordering, not the cache's arbitrary order
  return selection.object.selectedPinIds
    .map((id) => allPins.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
}

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
    warnAboutMissingRecipeBoards(boards);

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
