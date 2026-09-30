import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pinterestGet } from "../../lib/pinterest-api";
import {
  replaceCachedBoards,
  boardsAreFresh,
  getCachedBoards,
} from "../../lib/pinterest-cache";

export const getBoardsTool = createTool({
  id: "get-boards",
  description: "Lists the boards on the user's own Pinterest account",
  inputSchema: z.object({
    refresh: z
      .boolean()
      .optional()
      .describe("Set true to bypass the cache and refetch from Pinterest"),
  }),
  outputSchema: z.object({
    boards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const refresh = inputData?.refresh ?? false;

    console.log("REFRESH", refresh);
    if (!refresh && (await boardsAreFresh())) {
      const boards = await getCachedBoards();
      if (boards.length > 0) {
        await replaceCachedBoards(boards);
        return { boards };
      }
    }

    let data;
    try {
      data = await pinterestGet("/boards");
    } catch (err) {
      // Stale boards beat no boards; pinterestGet already logged the failure.
      const cached = await getCachedBoards();
      if (cached.length === 0) throw err;
      console.warn("[get-boards] Pinterest unavailable; serving cached boards");
      return { boards: cached };
    }

    const boards = data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));
    console.log("NEXT STEP IS REPLACE BOARDS");
    await replaceCachedBoards(boards);
    return { boards };
  },
});
