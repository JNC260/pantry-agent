import { describe, expect, it } from "vitest";
import type {
  PantryItem,
  ProposedItem,
  ReceiptProposal,
} from "@/lib/pantry-api";
import {
  canMerge,
  restoredRow,
  shiftPurchaseDate,
  toReceiptBatch,
  toReviewRows,
  type ReviewRow,
} from "./receipt-review";

const pantryItem = (overrides: Partial<PantryItem>): PantryItem => ({
  id: "milk-1",
  ingredient: "Milk",
  quantity: 0.5,
  unit: "gal",
  expirationDate: "2026-10-15",
  createdAt: 0,
  lowStock: true,
  category: "dairy_eggs",
  ...overrides,
});

const proposed = (overrides: Partial<ProposedItem>): ProposedItem => ({
  receiptText: "GV WHL MILK",
  ingredient: "Milk",
  quantity: 1,
  unit: "gal",
  category: "dairy_eggs",
  expirationDate: "2026-10-20",
  expirationSource: "estimated",
  existingIngredient: null,
  ...overrides,
});

const proposal = (items: ProposedItem[]): ReceiptProposal => ({
  purchaseDate: "2026-10-10",
  items,
  skipped: [],
});

const rowsFor = (items: ProposedItem[], pantry: PantryItem[] = []) =>
  toReviewRows(proposal(items), pantry);

describe("toReviewRows", () => {
  it("starts every row selected, as a new item", () => {
    const [row] = rowsFor([proposed({})]);
    expect(row).toMatchObject({
      selected: true,
      mode: "new",
      existing: null,
      expiryEstimated: true,
      draft: {
        ingredient: "Milk",
        quantity: "1",
        unit: "gal",
        expirationDate: "2026-10-20",
        category: "dairy_eggs",
      },
    });
  });

  it("links a duplicate to the pantry row in the same unit", () => {
    const pantry = [
      pantryItem({ id: "carton", unit: "carton" }),
      pantryItem({ id: "gallon", unit: "gal" }),
    ];
    const [row] = rowsFor([proposed({ existingIngredient: "milk" })], pantry);
    expect(row.existing?.id).toBe("gallon");
  });
});

describe("canMerge", () => {
  const row = (overrides: Partial<ReviewRow["draft"]>, existing = pantryItem({})) => ({
    ...rowsFor([proposed({ existingIngredient: "Milk" })], [existing])[0],
    draft: { ...rowsFor([proposed({})])[0].draft, ...overrides },
  });

  it("needs quantities in the same unit", () => {
    expect(canMerge(row({}))).toBe(true);
    expect(canMerge(row({ unit: "carton" }))).toBe(false);
    expect(canMerge(row({ quantity: "" }))).toBe(false);
    expect(canMerge(row({}, pantryItem({ quantity: null })))).toBe(false);
  });
});

describe("shiftPurchaseDate", () => {
  it("moves every expiry by the change in purchase date", () => {
    const rows = rowsFor([
      proposed({ expirationDate: "2026-10-20" }),
      proposed({ expirationDate: "2026-12-31" }),
    ]);
    const shifted = shiftPurchaseDate(rows, "2026-10-10", "2026-10-12");
    expect(shifted.map((r) => r.draft.expirationDate)).toEqual([
      "2026-10-22",
      "2027-01-02",
    ]);
  });

  it("leaves provided expiry dates alone", () => {
    const rows = rowsFor([
      proposed({ expirationDate: "2026-10-20" }),
      proposed({ expirationDate: "2026-12-31", expirationSource: "provided" }),
    ]);
    const shifted = shiftPurchaseDate(rows, "2026-10-10", "2026-10-12");
    expect(shifted.map((r) => r.draft.expirationDate)).toEqual([
      "2026-10-22",
      "2026-12-31",
    ]);
  });

  it("leaves rows alone for an unparseable date", () => {
    const rows = rowsFor([proposed({})]);
    expect(shiftPurchaseDate(rows, "2026-10-10", "")).toBe(rows);
  });
});

describe("restoredRow", () => {
  it("gets a default estimated expiry", () => {
    expect(restoredRow("Ice", "2026-10-10", "r").draft).toMatchObject({
      ingredient: "Ice",
      category: "other",
      expirationDate: "2027-01-08",
    });
  });
});

describe("toReceiptBatch", () => {
  it("creates new rows and skips unselected or nameless ones", () => {
    const rows = rowsFor([
      proposed({ ingredient: "Eggs", quantity: 12, unit: null }),
      proposed({ ingredient: "Butter" }),
      proposed({ ingredient: "  " }),
    ]);
    rows[1].selected = false;

    expect(toReceiptBatch(rows)).toEqual({
      create: [
        {
          ingredient: "Eggs",
          quantity: 12,
          expirationDate: "2026-10-20",
          category: "dairy_eggs",
        },
      ],
      update: [],
    });
  });

  it("merges by adding quantity and keeping the earlier expiry", () => {
    const rows = rowsFor(
      [
        proposed({ existingIngredient: "Milk", expirationDate: "2026-10-20" }),
        proposed({ existingIngredient: "Milk", expirationDate: "2026-10-12" }),
      ],
      [pantryItem({})],
    ).map((row) => ({ ...row, mode: "merge" as const }));

    expect(toReceiptBatch(rows)).toEqual({
      create: [],
      update: [
        {
          id: "milk-1",
          quantity: 2.5,
          expirationDate: "2026-10-12",
          lowStock: false,
        },
      ],
    });
  });

  it("adds a merge row that can't be merged as a new item", () => {
    const [row] = rowsFor(
      [proposed({ existingIngredient: "Milk", unit: "carton" })],
      [pantryItem({})],
    );
    const batch = toReceiptBatch([{ ...row, mode: "merge" }]);
    expect(batch.create).toHaveLength(1);
    expect(batch.update).toEqual([]);
  });
});
