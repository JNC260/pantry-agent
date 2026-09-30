import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchCachedPins } from "../../lib/pinterest-cache";

/**
 * Keyword search over cached pin titles, across every board or just one.
 * Never calls Pinterest, so it only sees what the cache already holds.
 */
export const searchPinsTool = createTool({
  id: "search-pins",
  description:
    "Searches the user's cached Pinterest pins by keyword, optionally limited to one board. Use this when the user describes what kind of recipe they're looking for rather than naming a specific pin.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Keyword or phrase to search for in pin titles, e.g. 'chicken'",
      ),
    boardId: z
      .string()
      .optional()
      .describe("Limit the search to this board only, if known"),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
        boardId: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { query, boardId } = inputData;
    const matches = await searchCachedPins(query, boardId);
    return { matches };
  },
});
