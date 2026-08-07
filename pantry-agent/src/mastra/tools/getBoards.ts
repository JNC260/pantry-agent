import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";
import { getValidPinterestToken } from "../../lib/pinterest-auth";

export const getMyBoardsTool = createTool({
  id: "get-my-boards",
  description: "Lists the boards on the user's own Pinterest account",
  inputSchema: z.object({}), // no input needed — it always fetches "my" boards
  outputSchema: z.object({
    boards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async () => {
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

    return { boards };
  },
});
