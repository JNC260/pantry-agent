/**
 * Re-downloads boards and pins from Pinterest into the cache, replacing what
 * was there, so pins deleted or edited on Pinterest stop (or start) showing
 * up. Used by the get-boards / get-pins-from-board tools, the Pins page's
 * refresh, and the daily recipe index run.
 */
import {
  pinterestGetAll,
  type PinterestBoard,
  type PinterestPin,
} from "./pinterest-api";
import { replaceCachedBoards, replaceCachedPins } from "./pinterest-cache";
import { isRecipeBoard } from "./recipe-boards";

export async function fetchBoards() {
  const items = await pinterestGetAll<PinterestBoard>("/boards");
  const boards = items.map((b) => ({ id: b.id, name: b.name }));
  await replaceCachedBoards(boards);
  return boards;
}

export async function fetchBoardPins(boardId: string) {
  const items = await pinterestGetAll<PinterestPin>(`/boards/${boardId}/pins`);
  const pins = items.map((p) => ({
    id: p.id,
    title: p.title ?? null,
    sourceLink: p.link ?? null,
  }));
  await replaceCachedPins(boardId, pins);
  return pins;
}

export type RecipeBoardsRefresh = {
  boards: number;
  // Names of recipe boards whose pins couldn't be fetched; their cached
  // pins are left as they were.
  failedBoards: string[];
};

// Refetches the board list, then every recipe board's pins. Throws only if
// the board list can't be fetched; a board that fails is reported and the
// rest still refresh. One board at a time, to go easy on rate limits.
export async function refreshRecipeBoards(): Promise<RecipeBoardsRefresh> {
  const recipeBoards = (await fetchBoards()).filter((b) =>
    isRecipeBoard(b.name),
  );
  const failedBoards: string[] = [];
  for (const board of recipeBoards) {
    try {
      await fetchBoardPins(board.id);
    } catch (err) {
      console.warn(`[pinterest-refresh] couldn't refresh "${board.name}":`, err);
      failedBoards.push(board.name);
    }
  }
  return { boards: recipeBoards.length, failedBoards };
}
