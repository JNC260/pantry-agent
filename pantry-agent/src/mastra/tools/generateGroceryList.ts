import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { extractRecipeTool } from "./extractRecipe";
import { getPantryItems } from "../../lib/pantry-db";
import { groceryMatchAgent } from "../agents/grocery-match-agent";

const groceryListSchema = z.object({
  haveAlready: z.array(z.string()),
  needToBuy: z.array(z.string()),
});

export const generateGroceryListTool = createTool({
  id: "generate-grocery-list",
  description:
    "Given a recipe the user has decided to make, compares its ingredients against what's in their pantry and returns what they already have and what they need to buy. If you already know the recipe's ingredient list from earlier in the conversation, pass it directly — otherwise this tool will extract it from the sourceLink itself.",
  inputSchema: z.object({
    sourceLink: z.string().describe("The recipe's URL"),
    ingredients: z
      .array(z.string())
      .optional()
      .describe(
        "The recipe's ingredient names, if already known from earlier in the conversation — skips re-extraction",
      ),
  }),
  outputSchema: groceryListSchema,
  execute: async (inputData, context) => {
    const { sourceLink } = inputData;
    let ingredientNames = inputData.ingredients;

    if (!ingredientNames) {
      const extracted = await extractRecipeTool.execute?.(
        { url: sourceLink },
        context,
      );
      if (!extracted || isValidationError(extracted)) {
        throw new Error(`Could not extract recipe from ${sourceLink}`);
      }
      ingredientNames = extracted.ingredients.map((i) => i.item);
    }

    const pantryItems = await getPantryItems();

    const matchPrompt = `Recipe ingredients:
${ingredientNames.join("\n")}

Pantry contents:
${pantryItems.map((p) => `${p.ingredient}${p.unit ? ` (${p.unit})` : ""}`).join("\n") || "(pantry is empty)"}

Sort the recipe ingredients into haveAlready and needToBuy.`;

    const result = await groceryMatchAgent.generate(matchPrompt, {
      structuredOutput: { schema: groceryListSchema },
    });

    return result.object;
  },
});
