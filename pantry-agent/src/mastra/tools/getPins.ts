import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { pinterestGetAll } from "../../lib/pinterest-api";
import {
  getCachedPins,
  pinsAreFresh,
  replaceCachedPins,
} from "../../lib/pinterest-cache";

export const getPinsFromBoardTool = createTool({
  id: "get-pins-from-board",
  description:
    "Lists the pins on a specific Pinterest board, including each pin's source link",
  inputSchema: z.object({
    boardId: z.string().describe("The Pinterest board ID to fetch pins from"),
    refresh: z
      .boolean()
      .optional()
      .describe("Set true to bypass the cache and refetch from Pinterest"),
  }),
  outputSchema: z.object({
    pins: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { boardId } = inputData;

    const refresh = inputData.refresh ?? false;

    if (!refresh && (await pinsAreFresh(boardId))) {
      const pins = await getCachedPins(boardId);
      if (pins.length > 0) return { pins };
    }

    let items;
    try {
      items = await pinterestGetAll(`/boards/${boardId}/pins`);
    } catch (err) {
      // Stale pins beat no pins; pinterestGet already logged the failure.
      const cached = await getCachedPins(boardId);
      if (cached.length === 0) throw err;
      console.warn(`[get-pins] Pinterest unavailable; serving cached pins for board ${boardId}`);
      return { pins: cached };
    }

    const pins = items.map((p: any) => ({
      id: p.id,
      title: p.title ?? null,
      sourceLink: p.link ?? null, // this is the URL back to the original recipe site
    }));

    await replaceCachedPins(boardId, pins);
    return { pins };
  },
});
