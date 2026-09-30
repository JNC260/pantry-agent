import { createTool, isValidationError } from "@mastra/core/tools";
import { createTavilyExtractTool } from "@mastra/tavily";
import { z } from "zod";

const recipeSchema = z.object({
  title: z.string(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      quantity: z
        .string()
        .nullable()
        .describe("e.g. '2 cups', '1 lb' — keep as a string since units vary"),
    }),
  ),
  steps: z.array(z.string()),
  cuisine: z.string().nullable(),
  mainProtein: z.string().nullable(),
  totalTimeMinutes: z.number().nullable(),
});

const tavilyExtractTool = createTavilyExtractTool();

// Recipe pages are mostly ads, comments, and life stories; the ingredients
// and steps land well within this, and it keeps the extraction prompt small.
const MAX_PAGE_CHARS = 15_000;

/**
 * Turns a recipe page into structured data: title, ingredients with
 * quantities, steps, cuisine, main protein, and total time.
 *
 * Tavily fetches the page as markdown, then the tool-less
 * recipeExtractionAgent pulls the recipe out of it with a typed schema.
 * Used directly by the agent, and by recommend-recipes and
 * generate-grocery-list to check real ingredient lists.
 */
export const extractRecipeTool = createTool({
  id: "extract-recipe",
  description:
    "Fetches a recipe webpage and extracts structured recipe data from it",
  inputSchema: z.object({
    url: z.string().describe("The URL of the recipe page to fetch and parse"),
  }),
  outputSchema: recipeSchema,
  execute: async (data, context) => {
    const { url } = data;
    const { mastra } = context;

    const extractResult = await tavilyExtractTool.execute?.(
      { urls: [url], extractDepth: "advanced", format: "markdown" },
      context,
    );

    if (!extractResult || isValidationError(extractResult)) {
      throw new Error(
        `Tavily extract failed or returned invalid data for ${url}`,
      );
    }

    const [failure] = extractResult.failedResults;
    if (failure) {
      throw new Error(`Tavily could not extract ${url}: ${failure.error}`);
    }

    const [pageContent] = extractResult.results;
    if (!pageContent) {
      throw new Error(`Tavily returned no content for ${url}`);
    }

    if (!mastra) {
      throw new Error("mastra context not available in tool execution");
    }

    const result = await mastra
      .getAgent("recipeExtractionAgent")
      .generate(
        `Extract the recipe from this page content...\n\nCONTENT:\n${pageContent.rawContent.slice(0, MAX_PAGE_CHARS)}`,
        { structuredOutput: { schema: recipeSchema } },
      );
    return result.object;
  },
});
