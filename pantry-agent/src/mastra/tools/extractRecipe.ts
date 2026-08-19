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

    console.log("STEP 1: starting extract", url);

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

    console.log(
      "STEP 2: extract done, content length",
      pageContent.rawContent.length,
    );

    if (!mastra) {
      console.error("STEP 3 FAIL: mastra is undefined in tool context");
      throw new Error("mastra context not available in tool execution");
    }

    let extractionAgent;
    try {
      extractionAgent = mastra.getAgent("recipeExtractionAgent");
      console.log("STEP 3: agent found?", Boolean(extractionAgent));
    } catch (err) {
      console.error("STEP 3 FAIL: getAgent threw:", err);
      throw err;
    }

    try {
      const result = await extractionAgent.generate(
        `Extract the recipe from this page content...\n\nCONTENT:\n${pageContent.rawContent.slice(0, 15000)}`,
        { structuredOutput: { schema: recipeSchema } },
      );
      console.log("STEP 4: generate done");
      return result.object;
    } catch (err) {
      console.error("STEP 4 FAIL", err);
      throw err;
    }
  },
});
