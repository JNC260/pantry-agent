import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";
import { getValidPinterestToken } from "../../lib/pinterest-auth";
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

    if (!refresh && (await boardsAreFresh())) {
      const boards = await getCachedBoards();
      if (boards.length > 0) return { boards };
    }

    const token = await getValidPinterestToken();

    const response = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const boards = response.data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    await replaceCachedBoards(boards);
    return { boards };
  },
});
