import { createTool, isValidationError } from "@mastra/core/tools";
import { z } from "zod";
import { extractRecipeTool } from "./extractRecipe";
import { getPantryItems } from "../../lib/pantry-db";
import { groceryMatchAgent } from "../agents/grocery-match-agent";

const groceryListSchema = z.object({
  haveEnough: z.array(z.string()),
  mightNeedMore: z
    .array(z.string())
    .describe("Have some, but the amount on hand might not be enough"),
  needToBuy: z.array(z.string()),
  runningLowNotes: z
    .array(z.string())
    .describe(
      "Ingredients that are sufficient for this recipe but flagged as running low in the pantry — worth restocking soon",
    ),
  expiredNotes: z
    .array(z.string())
    .describe(
      "Ingredients moved to needToBuy specifically because the pantry's version is expired, not because none was on hand",
    ),
  expiringSoonNotes: z
    .array(z.string())
    .describe(
      "Ingredients that count as available but expire within the next few days — worth using soon",
    ),
});

export const generateGroceryListTool = createTool({
  id: "generate-grocery-list",
  description:
    "Given a recipe the user has decided to make, compares its ingredients against what's in their pantry and returns what they already have and what they need to buy, accounting for quantity, low-stock flags, and expiration dates.",
  inputSchema: z.object({
    sourceLink: z.string().describe("The recipe's URL"),
  }),
  outputSchema: groceryListSchema,
  execute: async (inputData, context) => {
    const { sourceLink } = inputData;

    const extracted = await extractRecipeTool.execute?.(
      { url: sourceLink },
      context,
    );
    if (!extracted || isValidationError(extracted)) {
      throw new Error(`Could not extract recipe from ${sourceLink}`);
    }

    const pantryItems = await getPantryItems();
    const today = new Date().toISOString().slice(0, 10);

    const matchPrompt = `Today's date: ${today}

Recipe ingredients (with quantities the recipe calls for):
${extracted.ingredients.map((i) => `${i.item}${i.quantity ? ` — ${i.quantity}` : ""}`).join("\n")}

Pantry contents (with quantities on hand, and expiration date where known):
${
  pantryItems
    .map((p) => {
      const qty = p.quantity ? ` — ${p.quantity} ${p.unit ?? ""}`.trim() : "";
      const low = p.lowStock ? " (running low)" : "";
      const exp = p.expirationDate ? ` (expires ${p.expirationDate})` : "";
      return `${p.ingredient}${qty}${low}${exp}`;
    })
    .join("\n") || "(pantry is empty)"
}

Sort the recipe ingredients into haveEnough, mightNeedMore, and needToBuy.
Separately note any items that are running low, expired (and therefore
moved to needToBuy), or expiring soon.`;

    const result = await groceryMatchAgent.generate(matchPrompt, {
      structuredOutput: { schema: groceryListSchema },
    });

    return result.object;
  },
});
