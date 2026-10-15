import { describe, expect, it } from "vitest";
import type { LightweightPin } from "./pinterest-cache";
import { buildRecipeIndexReport, type IndexRow } from "./recipe-index-report";

const pin = (overrides: Partial<LightweightPin>): LightweightPin => ({
  id: "1",
  title: "A recipe",
  boardName: "Pastabilities",
  sourceLink: "https://example.com/a",
  ...overrides,
});

const failed = (indexedAt = Date.UTC(2026, 9, 14)) => ({
  status: "failed" as const,
  reason: "dead-link" as const,
  error: "gone",
  attempts: 1,
  indexedAt,
});

describe("buildRecipeIndexReport", () => {
  it("counts recipe links by state, ignoring non-recipe boards and duplicates", () => {
    const { counts } = buildRecipeIndexReport(
      [
        pin({ id: "1", sourceLink: "https://ok" }),
        pin({ id: "2", sourceLink: "https://ok", boardName: "Sweet stuff" }),
        pin({ id: "3", sourceLink: "https://dead" }),
        pin({ id: "4", sourceLink: "https://new" }),
        pin({ id: "5", sourceLink: "https://flaky" }),
        pin({ id: "6", sourceLink: "https://x", boardName: "Travel" }),
        pin({ id: "7", sourceLink: null }),
      ],
      new Map<string, IndexRow>([
        ["https://ok", { status: "ok" as const }],
        ["https://dead", failed()],
        ["https://flaky", { ...failed(), status: "retry" as const }],
      ]),
    );
    expect(counts).toEqual({ recipes: 4, indexed: 1, unreadable: 1, pending: 2 });
  });

  it("lists every pin saved with an unreadable link, with its Pinterest link", () => {
    const { unreadable } = buildRecipeIndexReport(
      [
        pin({ id: "11", sourceLink: "https://dead", title: "" }),
        pin({ id: "12", sourceLink: "https://dead", boardName: "Sweet stuff" }),
      ],
      new Map<string, IndexRow>([["https://dead", failed()]]),
    );
    expect(unreadable).toEqual([
      {
        sourceLink: "https://dead",
        reason: "dead-link",
        error: "gone",
        attempts: 1,
        lastTriedAt: "2026-10-14T00:00:00.000Z",
        pins: [
          {
            id: "11",
            url: "https://www.pinterest.com/pin/11/",
            title: null,
            boardName: "Pastabilities",
          },
          {
            id: "12",
            url: "https://www.pinterest.com/pin/12/",
            title: "A recipe",
            boardName: "Sweet stuff",
          },
        ],
      },
    ]);
  });
});
