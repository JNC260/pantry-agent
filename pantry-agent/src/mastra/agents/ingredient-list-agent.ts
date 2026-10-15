import { Agent } from "@mastra/core/agent";
import { z } from "zod";

export const ingredientListSchema = z.object({
  isRecipe: z
    .boolean()
    .describe(
      "False if the page isn't a single recipe (a login wall, error page, roundup of many recipes, or an article)",
    ),
  title: z.string().nullable(),
  ingredients: z
    .array(z.string())
    .describe("Every ingredient name, without amounts, e.g. 'crème fraîche'"),
});

/**
 * Lists a recipe page's ingredients for the recipe index
 * (src/mastra/recipe-indexer.ts), for pages without schema.org recipe data.
 * Only names, no amounts or steps, so a small model and short output — it
 * runs once per pin across thousands of pins.
 */
export const ingredientListAgent = new Agent({
  id: "ingredient-list-agent",
  name: "Ingredient List Agent",
  instructions: `You read a recipe web page (as markdown, often full of ads,
    comments, and stories) and list the ingredients the recipe calls for.

    - List every ingredient, including those in sauces, marinades,
      dressings, and toppings — an ingredient that only appears in a sauce
      matters as much as the main one.
    - Names only, as written on the page but without amounts or prep notes:
      "2 tbsp crème fraîche, at room temperature" → "crème fraîche".
    - If the page isn't a single recipe — a login or error page, a roundup
      of many recipes, a shopping page, an article — set isRecipe to false
      and return no ingredients. Never invent a recipe that isn't there.`,
  model: "anthropic/claude-haiku-4-5",
  // no tools registered — nothing for it to recurse into
});
