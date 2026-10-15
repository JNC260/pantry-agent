import type {
  NewPantryItem,
  PantryBatch,
  PantryItem,
  ProposedItem,
  ReceiptProposal,
} from "@/lib/pantry-api";
import { daysUntil, parseDate } from "@/lib/freshness";
import { toNewItem, type Draft } from "./draft";

// A restored "not food" line has no AI estimate; this matches the "other"
// default in pantry-agent/src/lib/receipt-items.ts.
const RESTORED_SHELF_LIFE_DAYS = 90;

// One receipt line in the review step.
export type ReviewRow = {
  key: string;
  selected: boolean;
  receiptText: string;
  draft: Draft;
  // True while the expiry is the AI's estimate from the purchase date; false
  // once it's a date the input gave or the user set.
  expiryEstimated: boolean;
  // The pantry item this duplicates, if any.
  existing: PantryItem | null;
  // "new" adds a row (the default); "merge" adds to `existing`.
  mode: "new" | "merge";
};

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

const sameText = (a: string | null, b: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

// The pantry row a duplicate refers to. With several rows of the same name,
// prefer one in the same unit, so it can be merged into.
function findExisting(
  proposed: ProposedItem,
  pantry: PantryItem[],
): PantryItem | null {
  if (!proposed.existingIngredient) return null;
  const matches = pantry.filter((item) =>
    sameText(item.ingredient, proposed.existingIngredient),
  );
  return (
    matches.find((item) => sameText(item.unit, proposed.unit)) ??
    matches[0] ??
    null
  );
}

export function toReviewRows(
  proposal: ReceiptProposal,
  pantry: PantryItem[],
): ReviewRow[] {
  return proposal.items.map((item, index) => ({
    key: `item-${index}`,
    selected: true,
    receiptText: item.receiptText,
    draft: {
      ingredient: item.ingredient,
      quantity: item.quantity !== null ? String(item.quantity) : "",
      unit: item.unit ?? "",
      expirationDate: item.expirationDate,
      category: item.category,
    },
    expiryEstimated: item.expirationSource === "estimated",
    existing: findExisting(item, pantry),
    mode: "new",
  }));
}

// A skipped "not food" line, put back by the user.
export function restoredRow(
  name: string,
  purchaseDate: string,
  key: string,
): ReviewRow {
  return {
    key,
    selected: true,
    receiptText: name,
    draft: {
      ingredient: name,
      quantity: "",
      unit: "",
      expirationDate: addDays(purchaseDate, RESTORED_SHELF_LIFE_DAYS),
      category: "other",
    },
    expiryEstimated: true,
    existing: null,
    mode: "new",
  };
}

// Merging adds quantities, so both need an amount in the same unit.
export function canMerge(row: ReviewRow): boolean {
  return (
    row.existing !== null &&
    row.existing.quantity !== null &&
    row.draft.quantity.trim() !== "" &&
    !Number.isNaN(Number(row.draft.quantity)) &&
    sameText(row.existing.unit, row.draft.unit)
  );
}

// Moving the purchase date moves every estimated expiry by the same amount;
// dates the input gave or the user set stay put.
export function shiftPurchaseDate(
  rows: ReviewRow[],
  from: string,
  to: string,
): ReviewRow[] {
  const toDate = parseDate(to);
  const shift = toDate ? daysUntil(from, toDate) : null;
  if (shift === null || shift === 0) return rows;
  return rows.map((row) =>
    row.expiryEstimated
      ? {
          ...row,
          draft: {
            ...row.draft,
            expirationDate: row.draft.expirationDate
              ? addDays(row.draft.expirationDate, -shift)
              : "",
          },
        }
      : row,
  );
}

const earlier = (a: string | null, b: string) =>
  !a ? b : !b ? a : a < b ? a : b;

/**
 * The batch for the selected rows: new rows become creates; merges become
 * one update per existing item that adds the quantities and keeps the
 * earlier expiry (the older stock still expires first).
 */
export function toReceiptBatch(rows: ReviewRow[]): PantryBatch {
  const selected = rows.filter(
    (row) => row.selected && row.draft.ingredient.trim(),
  );

  const merges = new Map<
    string,
    { quantity: number; expirationDate: string | null }
  >();
  const create: NewPantryItem[] = [];

  for (const row of selected) {
    if (row.mode === "merge" && canMerge(row) && row.existing) {
      const current = merges.get(row.existing.id) ?? {
        quantity: row.existing.quantity ?? 0,
        expirationDate: row.existing.expirationDate,
      };
      merges.set(row.existing.id, {
        quantity: current.quantity + Number(row.draft.quantity),
        expirationDate: earlier(
          current.expirationDate,
          row.draft.expirationDate,
        ),
      });
    } else {
      create.push(toNewItem(row.draft));
    }
  }

  return {
    create,
    update: [...merges].map(([id, merge]) => ({
      id,
      quantity: merge.quantity,
      ...(merge.expirationDate ? { expirationDate: merge.expirationDate } : {}),
      // Just restocked, so no longer running low.
      lowStock: false,
    })),
  };
}
