import { describe, expect, it } from "vitest";
import {
  classifyFreshness,
  formatPantryLine,
  formatRecipeLine,
} from "./grocery-prompt";
import type { PantryItem } from "./pantry-db";

// Late evening, so a UTC-based parse of a date would land on the wrong day.
const TODAY = new Date(2026, 8, 30, 22, 30); // Sep 30, 2026, local time

describe("classifyFreshness", () => {
  it.each([
    [null, "none"],
    ["not a date", "none"],
    ["2026-09-29", "expired"],
    ["2026-09-30", "soon"], // expires today: still usable
    ["2026-10-03", "soon"], // 3 days out
    ["2026-10-04", "fresh"], // 4 days out
  ] as const)("%s -> %s", (date, expected) => {
    expect(classifyFreshness(date, TODAY)).toBe(expected);
  });
});

const item = (overrides: Partial<PantryItem>): PantryItem => ({
  ingredient: "Rice",
  quantity: null,
  unit: null,
  expirationDate: null,
  lowStock: false,
  ...overrides,
});

describe("formatPantryLine", () => {
  it("separates the amount from the name", () => {
    expect(formatPantryLine(item({ quantity: 2, unit: "lb" }), TODAY)).toBe(
      "Rice — 2 lb",
    );
  });

  it("keeps a unit with no quantity, and a zero quantity", () => {
    expect(formatPantryLine(item({ unit: "bag" }), TODAY)).toBe("Rice — bag");
    expect(formatPantryLine(item({ quantity: 0 }), TODAY)).toBe("Rice — 0");
  });

  it("is just the name with no amount", () => {
    expect(formatPantryLine(item({}), TODAY)).toBe("Rice");
  });

  it("adds the low-stock and freshness labels the agent expects", () => {
    expect(
      formatPantryLine(
        item({ quantity: 1, lowStock: true, expirationDate: "2026-10-01" }),
        TODAY,
      ),
    ).toBe("Rice — 1 (running low) [expires soon — still usable now]");
    expect(
      formatPantryLine(item({ expirationDate: "2026-09-01" }), TODAY),
    ).toBe("Rice [EXPIRED — do not count this as available]");
  });
});

describe("formatRecipeLine", () => {
  it("includes the quantity when the recipe gives one", () => {
    expect(formatRecipeLine({ item: "garlic", quantity: "2 cloves" })).toBe(
      "garlic — 2 cloves",
    );
    expect(formatRecipeLine({ item: "salt", quantity: null })).toBe("salt");
  });
});
