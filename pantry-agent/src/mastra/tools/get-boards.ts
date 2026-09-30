import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pinterestGetAll, type PinterestBoard } from "../../lib/pinterest-api";
import {
  replaceCachedBoards,
  boardsAreFresh,
  getCachedBoards,
} from "../../lib/pinterest-cache";

/**
 * Lists the user's Pinterest boards (id and name).
 *
 * Serves the cache while it's under a week old; otherwise refetches every
 * page from Pinterest and replaces the cache. If Pinterest is unreachable,
 * stale cached boards are returned rather than an error.
 */
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

    if (!refresh && (await boardsAreFresh())) {
      const boards = await getCachedBoards();
      if (boards.length > 0) return { boards };
    }

    let items;
    try {
      items = await pinterestGetAll<PinterestBoard>("/boards");
    } catch (err) {
      // Stale boards beat no boards; pinterestGet already logged the failure.
      const cached = await getCachedBoards();
      if (cached.length === 0) throw err;
      console.warn("[get-boards] Pinterest unavailable; serving cached boards");
      return { boards: cached };
    }

    const boards = items.map((b) => ({
      id: b.id,
      name: b.name,
    }));
    await replaceCachedBoards(boards);
    return { boards };
  },
});
