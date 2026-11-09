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

// Sections of recipe boards that aren't recipes (e.g. "Stuff I've Done!"
// has cleaning and decor sections). Matched by name, ignoring case, on any
// recipe board.
export const NON_RECIPE_SECTIONS = ["Cleaning", "Home Decor"];

const normalize = (name: string) => name.trim().toLowerCase();
const RECIPE_BOARD_NAMES = new Set(RECIPE_BOARDS.map(normalize));
const NON_RECIPE_SECTION_NAMES = new Set(NON_RECIPE_SECTIONS.map(normalize));

export function isRecipeBoard(boardName: string): boolean {
  return RECIPE_BOARD_NAMES.has(normalize(boardName));
}

// On a recipe board, and not in one of its non-recipe sections.
export function isRecipePin(pin: {
  boardName: string;
  sectionName: string | null;
}): boolean {
  return (
    isRecipeBoard(pin.boardName) &&
    !(pin.sectionName && NON_RECIPE_SECTION_NAMES.has(normalize(pin.sectionName)))
  );
}

// Where a pin is saved, as shown to the agent and on the Pins page:
// "Stuff I've Done! / Poultry", or just the board name.
export function pinPlace(pin: {
  boardName: string;
  sectionName: string | null;
}): string {
  return pin.sectionName
    ? `${pin.boardName} / ${pin.sectionName}`
    : pin.boardName;
}

// Listed recipe boards that aren't among `boards` (e.g. renamed on
// Pinterest), whose recipes would otherwise silently drop out.
export function missingRecipeBoards(boards: { name: string }[]): string[] {
  const present = new Set(boards.map((b) => normalize(b.name)));
  return RECIPE_BOARDS.filter((name) => !present.has(normalize(name)));
}

// Only pins that could become a recommendation: they're recipe pins (see
// isRecipePin), they need a link, and a recipe saved to several boards is listed once.
// Sorted so the prompt built from them is byte-identical between requests
// (needed for prompt caching).
export function selectablePins(
  pins: LightweightPin[],
): (LightweightPin & { sourceLink: string })[] {
  const sorted = pins
    .filter(
      (p): p is LightweightPin & { sourceLink: string } =>
        !!p.sourceLink && isRecipePin(p),
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
