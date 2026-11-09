import { beforeEach, describe, expect, it, vi } from "vitest";
import { pinterestGetAll } from "./pinterest-api";
import { replaceCachedBoards, replaceCachedPins } from "./pinterest-cache";
import { refreshRecipeBoards } from "./pinterest-refresh";

vi.mock("./pinterest-api", () => ({ pinterestGetAll: vi.fn() }));
vi.mock("./pinterest-cache", () => ({
  replaceCachedBoards: vi.fn(),
  replaceCachedPins: vi.fn(),
}));

const getAll = vi.mocked(pinterestGetAll);

describe("refreshRecipeBoards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("replaces the board list and each recipe board's pins, skipping other boards", async () => {
    getAll.mockImplementation(async (path: string) => {
      if (path === "/boards") {
        return [
          { id: "b1", name: "Pastabilities" },
          { id: "b2", name: "House ideas" },
        ];
      }
      if (path === "/boards/b1/sections") {
        return [{ id: "s1", name: "Classics" }];
      }
      return [
        {
          id: "p1",
          title: "Cacio e pepe",
          link: "https://example.com/cacio",
          description: "  Pecorino, black pepper, pasta. ",
          board_section_id: "s1",
        },
        {
          id: "p2",
          title: null,
          link: null,
          description: " ",
          board_section_id: null,
        },
      ];
    });

    expect(await refreshRecipeBoards()).toEqual({ boards: 1, failedBoards: [] });
    expect(replaceCachedBoards).toHaveBeenCalledWith([
      { id: "b1", name: "Pastabilities" },
      { id: "b2", name: "House ideas" },
    ]);
    expect(getAll).not.toHaveBeenCalledWith("/boards/b2/pins");
    expect(getAll).not.toHaveBeenCalledWith("/boards/b2/sections");
    expect(replaceCachedPins).toHaveBeenCalledExactlyOnceWith("b1", [
      {
        id: "p1",
        title: "Cacio e pepe",
        sourceLink: "https://example.com/cacio",
        description: "Pecorino, black pepper, pasta.",
        sectionName: "Classics",
      },
      {
        id: "p2",
        title: null,
        sourceLink: null,
        description: null,
        sectionName: null,
      },
    ]);
  });

  it("reports a board that fails and still refreshes the rest", async () => {
    getAll.mockImplementation(async (path: string) => {
      if (path === "/boards") {
        return [
          { id: "b1", name: "Pastabilities" },
          { id: "b2", name: "Sweet stuff" },
        ];
      }
      if (path === "/boards/b1/sections") throw new Error("503");
      return [];
    });

    expect(await refreshRecipeBoards()).toEqual({
      boards: 2,
      failedBoards: ["Pastabilities"],
    });
    expect(replaceCachedPins).toHaveBeenCalledExactlyOnceWith("b2", []);
  });

  it("throws when the board list can't be fetched", async () => {
    getAll.mockRejectedValue(new Error("network down"));
    await expect(refreshRecipeBoards()).rejects.toThrow("network down");
    expect(replaceCachedPins).not.toHaveBeenCalled();
  });
});
