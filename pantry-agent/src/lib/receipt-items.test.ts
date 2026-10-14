import { describe, expect, it } from "vitest";
import {
  addDays,
  DEFAULT_SHELF_LIFE_DAYS,
  toReceiptProposal,
  type ParsedReceipt,
} from "./receipt-items";

// Late evening, so a UTC-based date would land on the wrong day.
const TODAY = new Date(2026, 9, 13, 22, 30); // Oct 13, 2026, local time

type ParsedItem = ParsedReceipt["items"][number];

const line = (overrides: Partial<ParsedItem>): ParsedItem => ({
  receiptText: "GV WHL MILK",
  ingredient: "Milk",
  isFood: true,
  quantity: 1,
  unit: "gal",
  category: "dairy_eggs",
  shelfLifeDays: 10,
  existingIngredient: null,
  ...overrides,
});

const receipt = (
  items: ParsedItem[],
  purchaseDate: string | null = "2026-10-10",
): ParsedReceipt => ({ purchaseDate, items });

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-25", 10)).toBe("2026-11-04");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("rejects a malformed date", () => {
    expect(() => addDays("10/13/2026", 1)).toThrow();
  });
});

describe("toReceiptProposal", () => {
  it("dates expiry from the receipt's purchase date", () => {
    const { purchaseDate, items } = toReceiptProposal(
      receipt([line({ shelfLifeDays: 10 })]),
      [],
      TODAY,
    );
    expect(purchaseDate).toBe("2026-10-10");
    expect(items[0].expirationDate).toBe("2026-10-20");
  });

  it.each([
    ["missing", null],
    ["unparseable", "Oct 10"],
    ["impossible", "2026-02-31"],
    ["in the future", "2026-11-01"],
  ])("falls back to today when the purchase date is %s", (_label, date) => {
    const { purchaseDate, items } = toReceiptProposal(
      receipt([line({ shelfLifeDays: 1 })], date),
      [],
      TODAY,
    );
    expect(purchaseDate).toBe("2026-10-13");
    expect(items[0].expirationDate).toBe("2026-10-14");
  });

  it.each([null, 0, -5])(
    "uses the category default when shelf life is %s",
    (shelfLifeDays) => {
      const { items } = toReceiptProposal(
        receipt([line({ category: "canned_jarred", shelfLifeDays })]),
        [],
        TODAY,
      );
      expect(items[0].expirationDate).toBe(
        addDays("2026-10-10", DEFAULT_SHELF_LIFE_DAYS.canned_jarred),
      );
    },
  );

  it("moves non-food lines to skipped", () => {
    const { items, skipped } = toReceiptProposal(
      receipt([
        line({}),
        line({ receiptText: "BOUNTY 6PK", ingredient: "Paper towels", isFood: false }),
      ]),
      [],
      TODAY,
    );
    expect(items.map((i) => i.ingredient)).toEqual(["Milk"]);
    expect(skipped).toEqual(["Paper towels"]);
  });

  it("keeps a duplicate flag only for a real pantry item, using its exact name", () => {
    const { items } = toReceiptProposal(
      receipt([
        line({ existingIngredient: "whole milk" }),
        line({ ingredient: "Eggs", existingIngredient: "Duck eggs" }),
      ]),
      ["Whole Milk", "Parmesan"],
      TODAY,
    );
    expect(items[0].existingIngredient).toBe("Whole Milk");
    expect(items[1].existingIngredient).toBeNull();
  });

  it("clears non-positive quantities and blank units", () => {
    const { items } = toReceiptProposal(
      receipt([line({ quantity: 0, unit: "  " })]),
      [],
      TODAY,
    );
    expect(items[0].quantity).toBeNull();
    expect(items[0].unit).toBeNull();
  });
});
