import { describe, expect, it } from "vitest";
import type { UnreadableRecipe } from "@/lib/recipe-index-api";
import {
  blockedSiteCounts,
  groupUnreadable,
  siteName,
} from "./unreadable-groups";

const recipe = (overrides: Partial<UnreadableRecipe>): UnreadableRecipe => ({
  sourceLink: "https://example.com/a",
  reason: "unreadable",
  error: "blocked",
  attempts: 1,
  lastTriedAt: "2026-10-14T00:00:00.000Z",
  pins: [],
  ...overrides,
});

describe("groupUnreadable", () => {
  it("groups by reason in a fixed order, skipping empty groups", () => {
    const groups = groupUnreadable([
      recipe({ sourceLink: "a", reason: "unreadable" }),
      recipe({ sourceLink: "b", reason: "dead-link" }),
      recipe({ sourceLink: "c", reason: "unreadable" }),
    ]);
    expect(
      groups.map((g) => [g.reason, g.recipes.map((r) => r.sourceLink)]),
    ).toEqual([
      ["dead-link", ["b"]],
      ["unreadable", ["a", "c"]],
    ]);
  });
});

describe("siteName", () => {
  it("shortens a link to its site", () => {
    expect(siteName("https://www.skinnytaste.com/soup/")).toBe("skinnytaste.com");
    expect(siteName("not a url")).toBe("not a url");
  });
});

describe("blockedSiteCounts", () => {
  it("counts recipes on each blocked site, most first", () => {
    expect(
      blockedSiteCounts(
        [
          recipe({ sourceLink: "https://www.b.com/1" }),
          recipe({ sourceLink: "http://a.com/2" }),
          recipe({ sourceLink: "https://b.com/3" }),
          recipe({ sourceLink: "https://open.com/4" }),
        ],
        ["a.com", "b.com", "unused.com"],
      ),
    ).toEqual([
      { site: "b.com", recipes: 2 },
      { site: "a.com", recipes: 1 },
    ]);
  });
});
