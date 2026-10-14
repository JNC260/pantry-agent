import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Builds the link that opens the pantry page's "Cooked a recipe" review for
 * a recipe, so the agent never assembles or encodes the URL itself. It
 * changes nothing: the user reviews and applies the changes on that page.
 */
export const pantryUpdateLinkTool = createTool({
  id: "pantry-update-link",
  description:
    "Given the sourceLink of a recipe the user says they cooked, returns a link to the pantry page where they can review and apply what the recipe used up. Does not change the pantry.",
  inputSchema: z.object({
    sourceLink: z
      .url()
      .describe("The recipe's URL, copied exactly from earlier in the conversation"),
  }),
  outputSchema: z.object({ url: z.string() }),
  execute: async ({ sourceLink }) => ({
    url: `/pantry?cooked=${encodeURIComponent(sourceLink)}`,
  }),
});
