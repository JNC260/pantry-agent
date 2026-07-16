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
      })
    ),
  }),
  execute: async () => {
    const response = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: {
        Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
      },
    });

    const boards = response.data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    console.log(boards)
    return { boards };
  },
});

export const getPinsFromBoardTool = createTool({
  id: "get-pins-from-board",
  description: "Lists the pins on a specific Pinterest board, including each pin's source link",
  inputSchema: z.object({
    boardId: z.string().describe("The Pinterest board ID to fetch pins from"),
  }),
  outputSchema: z.object({
    pins: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
      })
    ),
  }),
  execute: async (inputData) => {
    const { boardId } = inputData;
    const token = await getValidPinterestToken();

    const response = await axios.get(
      `https://api.pinterest.com/v5/boards/${boardId}/pins`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const pins = response.data.items.map((p: any) => ({
      id: p.id,
      title: p.title ?? null,
      sourceLink: p.link ?? null, // this is the URL back to the original recipe site
    }));

    return { pins };
  },
});
