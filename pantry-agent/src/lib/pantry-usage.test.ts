import { describe, expect, it } from "vitest";
import type { PantryRow } from "./pantry-db";
import {
  formatUsagePantryLine,
  toCookedProposal,
  type UsagePlan,
} from "./pantry-usage";

const row = (overrides: Partial<PantryRow>): PantryRow => ({
  id: "milk",
  ingredient: "Milk",
  quantity: 1,
  unit: "gal",
  expirationDate: "2026-10-20",
  lowStock: false,
  category: "dairy_eggs",
  ...overrides,
});

type PlanChange = UsagePlan["changes"][number];

const change = (overrides: Partial<PlanChange>): PlanChange => ({
  pantryItemId: "milk",
  recipeIngredient: "2 cups milk",
  amountUsed: 0.125,
  usesItAllUp: false,
  confidence: "sure",
  note: "",
  ...overrides,
});

const plan = (changes: PlanChange[]): UsagePlan => ({
  recipeTitle: "Pancakes",
  changes,
  unmatched: ["flour"],
});

describe("toCookedProposal", () => {
  it("subtracts the amount used from what's on hand", () => {
    const { changes, unmatched } = toCookedProposal(plan([change({})]), [
      row({}),
    ]);
    expect(changes).toEqual([
      expect.objectContaining({
        pantryItemId: "milk",
        ingredient: "Milk",
        before: 1,
        after: 0.88, // 0.875, rounded to 2 places
        action: "decrement",
        confidence: "sure",
      }),
    ]);
    expect(unmatched).toEqual(["flour"]);
  });

  it("drops changes to rows that don't exist", () => {
    const { changes } = toCookedProposal(
      plan([change({ pantryItemId: "made-up" })]),
      [row({})],
    );
    expect(changes).toEqual([]);
  });

  it("marks a row for removal when more is used than is on hand", () => {
    const { changes } = toCookedProposal(plan([change({ amountUsed: 3 })]), [
      row({}),
    ]);
    expect(changes[0]).toMatchObject({ after: 0, action: "remove" });
  });

  it("removes a row the recipe uses up, even with no amount on hand", () => {
    const { changes } = toCookedProposal(
      plan([change({ amountUsed: null, usesItAllUp: true })]),
      [row({ quantity: null })],
    );
    expect(changes[0]).toMatchObject({ after: 0, action: "remove" });
  });

  it("ignores a negative amount used", () => {
    const { changes } = toCookedProposal(plan([change({ amountUsed: -2 })]), [
      row({}),
    ]);
    expect(changes[0].after).toBe(1);
  });

  it("adds up several uses of one row", () => {
    const { changes } = toCookedProposal(
      plan([
        change({ amountUsed: 0.25, recipeIngredient: "4 cups milk" }),
        change({
          amountUsed: 0.125,
          recipeIngredient: "2 cups milk",
          confidence: "estimate",
        }),
      ]),
      [row({})],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      after: 0.63,
      confidence: "estimate",
      recipeIngredient: "4 cups milk; 2 cups milk",
    });
  });

  it.each([
    ["the amount used is unknown", { amountUsed: null }, {}],
    ["nothing is recorded on hand", {}, { quantity: null }],
  ])("leaves the amount left to the user when %s", (_label, use, onHand) => {
    const { changes } = toCookedProposal(plan([change(use)]), [row(onHand)]);
    expect(changes[0]).toMatchObject({
      after: null,
      action: "decrement",
      confidence: "unsure",
    });
  });
});

describe("formatUsagePantryLine", () => {
  it("includes the id, amount, and expiry", () => {
    expect(formatUsagePantryLine(row({}))).toBe(
      "[id: milk] Milk — 1 gal (expires 2026-10-20)",
    );
    expect(
      formatUsagePantryLine(row({ quantity: null, unit: null, expirationDate: null })),
    ).toBe("[id: milk] Milk — (no amount recorded)");
  });
});
