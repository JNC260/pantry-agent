import { describe, expect, it } from "vitest";
import type { CookedChange } from "@/lib/pantry-api";
import {
  rowOutcome,
  toCookedBatch,
  toCookedRows,
  type CookedRow,
} from "./cooked-review";

const change = (overrides: Partial<CookedChange>): CookedChange => ({
  pantryItemId: "milk",
  ingredient: "Milk",
  unit: "gal",
  recipeIngredient: "2 cups milk",
  before: 1,
  after: 0.88,
  action: "decrement",
  confidence: "sure",
  note: "",
  ...overrides,
});

const rowsFor = (changes: CookedChange[]) =>
  toCookedRows({ recipeTitle: null, changes, unmatched: [] });

describe("toCookedRows", () => {
  it("leaves only the unsure guesses unchecked", () => {
    const rows = rowsFor([
      change({ confidence: "sure" }),
      change({ confidence: "estimate" }),
      change({ confidence: "unsure", after: null }),
    ]);
    expect(rows.map((r) => r.selected)).toEqual([true, true, false]);
    expect(rows.map((r) => r.after)).toEqual(["0.88", "0.88", ""]);
  });
});

describe("rowOutcome", () => {
  const row = (after: string): CookedRow => ({
    change: change({}),
    selected: true,
    after,
  });

  it.each([
    ["0.5", "update"],
    ["0", "remove"],
    ["-1", "remove"],
    ["", "needs-amount"],
    ["lots", "needs-amount"],
  ] as const)("%s -> %s", (after, outcome) => {
    expect(rowOutcome(row(after))).toBe(outcome);
  });
});

describe("toCookedBatch", () => {
  it("updates, removes, and skips unchecked or incomplete rows", () => {
    const rows = rowsFor([
      change({ pantryItemId: "milk", after: 0.88 }),
      change({ pantryItemId: "broth", after: 0, action: "remove" }),
      change({ pantryItemId: "eggs", after: 2 }),
      change({ pantryItemId: "garlic", after: null }),
    ]);
    rows[2].selected = false;
    rows[3].selected = true;

    expect(toCookedBatch(rows)).toEqual({
      update: [{ id: "milk", quantity: 0.88 }],
      delete: ["broth"],
    });
  });
});
