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

type Freshness = "expired" | "soon" | "fresh" | "none";

function classifyFreshness(expirationDate: string | null): Freshness {
  if (!expirationDate) return "none";
  const expiry = new Date(expirationDate);
  if (isNaN(expiry.getTime())) return "none";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const daysUntil = Math.round(
    (expiry.getTime() - today.getTime()) / 86_400_000,
  );

  if (daysUntil < 0) return "expired";
  if (daysUntil <= 3) return "soon";
  return "fresh";
}

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

    const matchPrompt = `Recipe ingredients (with quantities the recipe calls for):
${extracted.ingredients.map((i) => `${i.item}${i.quantity ? ` — ${i.quantity}` : ""}`).join("\n")}

Pantry contents (with quantities on hand):
${
  pantryItems
    .map((p) => {
      const qty = p.quantity ? ` — ${p.quantity} ${p.unit ?? ""}`.trim() : "";
      const low = p.lowStock ? " (running low)" : "";
      const status = classifyFreshness(p.expirationDate);
      const freshnessLabel =
        status === "expired"
          ? " [EXPIRED — do not count this as available]"
          : status === "soon"
            ? " [expires soon — still usable now]"
            : "";
      return `${p.ingredient}${qty}${low}${freshnessLabel}`;
    })
    .join("\n") || "(pantry is empty)"
}

Sort the recipe ingredients into haveEnough, mightNeedMore, and needToBuy.
Separately note any items that are running low or expiring soon.`;

    const result = await groceryMatchAgent.generate(matchPrompt, {
      structuredOutput: { schema: groceryListSchema },
    });

    return result.object;
  },
});
