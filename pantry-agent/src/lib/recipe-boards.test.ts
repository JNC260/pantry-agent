import { describe, expect, it } from "vitest";
import {
  RECIPE_BOARDS,
  isRecipeBoard,
  missingRecipeBoards,
  selectablePins,
} from "./recipe-boards";
import type { LightweightPin } from "./pinterest-cache";

const pin = (overrides: Partial<LightweightPin>): LightweightPin => ({
  id: "1",
  title: "A recipe",
  boardName: "Pastabilities",
  sourceLink: "https://example.com/a",
  ...overrides,
});

describe("isRecipeBoard", () => {
  it("matches listed boards ignoring case and surrounding space", () => {
    expect(isRecipeBoard("  pastabilities ")).toBe(true);
    expect(isRecipeBoard("SWEET STUFF")).toBe(true);
  });

  it("rejects boards that aren't listed", () => {
    expect(isRecipeBoard("Home decor")).toBe(false);
  });
});

describe("missingRecipeBoards", () => {
  it("lists recipe boards absent from Pinterest", () => {
    const present = RECIPE_BOARDS.filter((name) => name !== "Sweet stuff").map(
      (name) => ({ name: name.toUpperCase() }),
    );
    expect(missingRecipeBoards(present)).toEqual(["Sweet stuff"]);
  });
});

describe("selectablePins", () => {
  it("drops pins with no link and pins on non-recipe boards", () => {
    const pins = [
      pin({ id: "keep" }),
      pin({ id: "no-link", sourceLink: null }),
      pin({ id: "wrong-board", boardName: "Travel" }),
    ];
    expect(selectablePins(pins).map((p) => p.id)).toEqual(["keep"]);
  });

  it("lists a recipe saved to several boards once", () => {
    const pins = [
      pin({ id: "b", boardName: "Sweet stuff", sourceLink: "https://x" }),
      pin({ id: "a", boardName: "Pastabilities", sourceLink: "https://x" }),
    ];
    expect(selectablePins(pins).map((p) => p.id)).toEqual(["a"]);
  });

  it("orders by board then id, whatever order the cache returned", () => {
    const pins = [
      pin({ id: "2", boardName: "Sweet stuff", sourceLink: "https://1" }),
      pin({ id: "9", boardName: "Pastabilities", sourceLink: "https://2" }),
      pin({ id: "1", boardName: "Sweet stuff", sourceLink: "https://3" }),
    ];
    const ids = selectablePins(pins).map((p) => p.id);
    expect(ids).toEqual(["9", "1", "2"]);
    expect(selectablePins([...pins].reverse()).map((p) => p.id)).toEqual(ids);
  });
});
