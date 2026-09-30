import type { LightweightPin } from "./pinterest-cache";

// Boards whose pins are recipes. Only these are considered for
// recommendations; the rest (clothes, house, travel…) are thousands of pins
// that would only bloat the selection prompt. Matched by name, ignoring case,
// so renaming a board on Pinterest means updating it here too.
export const RECIPE_BOARDS = [
  "Baby Snacks",
  "Breakfast of champions...",
  "Getting Tipsy",
  "If fish is what you wish...",
  "It ain't easy being green...",
  "Pastabilities",
  "Shameless carnivore :)",
  "Sides, apps, and everything in between...",
  "Stuff I've Done!",
  "Sweet stuff",
];

const normalize = (name: string) => name.trim().toLowerCase();
const RECIPE_BOARD_NAMES = new Set(RECIPE_BOARDS.map(normalize));

export function isRecipeBoard(boardName: string): boolean {
  return RECIPE_BOARD_NAMES.has(normalize(boardName));
}

// Listed recipe boards that aren't among `boards` (e.g. renamed on
// Pinterest), whose recipes would otherwise silently drop out.
export function missingRecipeBoards(boards: { name: string }[]): string[] {
  const present = new Set(boards.map((b) => normalize(b.name)));
  return RECIPE_BOARDS.filter((name) => !present.has(normalize(name)));
}

// Only pins that could become a recommendation: they're on a recipe board,
// they need a link, and a recipe saved to several boards is listed once.
// Sorted so the prompt built from them is byte-identical between requests
// (needed for prompt caching).
export function selectablePins(
  pins: LightweightPin[],
): (LightweightPin & { sourceLink: string })[] {
  const sorted = pins
    .filter(
      (p): p is LightweightPin & { sourceLink: string } =>
        !!p.sourceLink && isRecipeBoard(p.boardName),
    )
    .sort(
      (a, b) =>
        a.boardName.localeCompare(b.boardName) || a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  return sorted.filter((p) => {
    if (seen.has(p.sourceLink)) return false;
    seen.add(p.sourceLink);
    return true;
  });
}
