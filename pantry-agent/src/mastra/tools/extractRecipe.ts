import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

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

export const extractRecipeTool = createTool({
  id: "extract-recipe",
  description:
    "Fetches a recipe webpage and extracts structured recipe data from it",
  inputSchema: z.object({
    url: z.string().describe("The URL of the recipe page to fetch and parse"),
  }),
  outputSchema: recipeSchema,
  execute: async (data, { mastra }) => {
    const { url } = data;
    console.log("STEP 1: starting fetch", url);

    const pageResponse = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.google.com/",
      },
    });
    console.log("STEP 2: fetch done", pageResponse.status);

    const html = pageResponse.data;
    console.log("STEP 3: html length", html.length);

    if (!mastra) {
      console.error("STEP 4 FAIL: mastra is undefined in tool context");
      throw new Error("mastra context not available in tool execution");
    }

    let extractionAgent;
    try {
      extractionAgent = mastra.getAgent("recipeExtractionAgent");
      console.log("STEP 4: agent found?", Boolean(extractionAgent));
    } catch (err) {
      console.error("STEP 4 FAIL: getAgent threw:", err);
      throw err;
    }

    try {
      const result = await extractionAgent.generate(
        `Extract the recipe...\n\nHTML:\n${html.slice(0, 15000)}`,
        { structuredOutput: { schema: recipeSchema } },
      );
      console.log("STEP 5: generate done");
      return result.object;
    } catch (err) {
      console.error("STEP 5 FAIL", err);
      throw err;
    }
  },
});
