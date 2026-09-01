import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { scoredSearchByIngredients } from "../scorers/scoreByIngredient";
import { extractRecipeTool } from "./extractRecipe";

const MAX_CANDIDATES_TO_EXTRACT = 5;
const MAX_RECOMMENDATIONS = 3;

export const recommendRecipesTool = createTool({
  id: "recommend-recipes",
  description:
    "Given a list of ingredients the user has on hand, searches the user's cached Pinterest pins for matching recipes, verifies the top candidates by extracting their real ingredient lists, and returns the best 2-3 matches. Returns an empty recommendations array if nothing in the user's pins is a good match — in that case, fall back to the web-search tool instead.",
  inputSchema: z.object({
    ingredients: z
      .array(z.string())
      .describe(
        "Ingredients the user currently has on hand, e.g. ['chicken breast', 'kale']",
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

    const candidates = await scoredSearchByIngredients(ingredients);

    if (candidates.length === 0) {
      return { recommendations: [] };
    }

    const toExtract = candidates.slice(0, MAX_CANDIDATES_TO_EXTRACT);

    const verified: {
      title: string;
      sourceLink: string;
      boardName: string;
      matchedOnHandIngredients: string[];
      overlapScore: number;
    }[] = [];

    for (const candidate of toExtract) {
      if (!candidate.sourceLink) continue;

      let extracted:
        | Awaited<ReturnType<NonNullable<typeof extractRecipeTool.execute>>>
        | undefined;

      try {
        extracted = await extractRecipeTool.execute?.(
          { url: candidate.sourceLink },
          context,
        );
      } catch (err) {
        console.error(`Extraction failed for ${candidate.sourceLink}:`, err);
        // fall through to the link-only fallback below
      }

      if (extracted && !isValidationError(extracted)) {
        const extractedItems = extracted.ingredients.map((i) =>
          i.item.toLowerCase(),
        );

        const matchedOnHand = ingredients.filter((onHand) =>
          extractedItems.some((item) => item.includes(onHand.toLowerCase())),
        );

        verified.push({
          title: extracted.title,
          sourceLink: candidate.sourceLink,
          boardName: candidate.boardName,
          matchedOnHandIngredients: matchedOnHand,
          overlapScore: matchedOnHand.length,
        });
      } else {
        // extraction failed or returned nothing usable, offer the link
        // using the title/board match we already have from search
        verified.push({
          title: candidate.title ?? `Recipe from ${candidate.boardName}`,
          sourceLink: candidate.sourceLink,
          boardName: candidate.boardName,
          matchedOnHandIngredients: candidate.matchedIngredients,
          overlapScore: candidate.matchedIngredients.length,
        });
      }
    }

    verified.sort((a, b) => b.overlapScore - a.overlapScore);

    const recommendations = verified
      .slice(0, MAX_RECOMMENDATIONS)
      .map(({ overlapScore, ...rest }) => rest);

    return { recommendations };
  },
});
