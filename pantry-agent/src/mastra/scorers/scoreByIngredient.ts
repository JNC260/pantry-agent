import {
  ensureTables,
  getBoardNameMap,
  getCachedPins,
} from "../../lib/pinterest-cache";

export type ScoredCandidate = {
  id: string;
  title: string | null;
  sourceLink: string | null;
  boardId: string;
  boardName: string;
  matchedIngredients: string[];
  score: number;
};

export async function scoredSearchByIngredients(
  ingredients: string[],
): Promise<ScoredCandidate[]> {
  await ensureTables();

  const boardNameMap = await getBoardNameMap();
  const boardIds = Object.keys(boardNameMap);

  const scored = new Map<string, ScoredCandidate>();

  for (const boardId of boardIds) {
    const pins = await getCachedPins(boardId);
    const boardName = boardNameMap[boardId] ?? "";

    for (const pin of pins) {
      if (!pin.sourceLink) continue; // can't recommend a recipe with nothing to extract from
      let titleText: string = pin.title ?? "";
      try {
        const sourceURL = new URL(pin.sourceLink);
        if (!titleText) {
          titleText = sourceURL.pathname.split("-").join(" ");
        }
      } catch (e) {}

      const searchableText = `${titleText} ${boardName}`.toLowerCase();

      const matched = ingredients.filter((ing) => {
        const tokens = ing
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length >= 3);
        return tokens.some((token) => searchableText.includes(token));
      });

      if (matched.length === 0) continue;

      scored.set(pin.id, {
        id: pin.id,
        title: pin.title,
        sourceLink: pin.sourceLink,
        boardId,
        boardName,
        matchedIngredients: matched,
        score: matched.length,
      });
    }
  }

  return Array.from(scored.values()).sort((a, b) => b.score - a.score);
}
