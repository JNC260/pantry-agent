import { z } from "zod";

// Mirrors api/src/pantry/categories.ts (and web/src/lib/pantry-api.ts) —
// keep the lists in sync.
export const PANTRY_CATEGORIES = [
  "produce",
  "meat_seafood",
  "dairy_eggs",
  "grains_pasta",
  "canned_jarred",
  "condiments_sauces",
  "spices_seasonings",
  "baking",
  "snacks",
  "frozen",
  "beverages",
  "other",
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

// Used when the receipt agent gives no usable shelf life, so every food item
// still gets an expiry date. Deliberately middle-of-the-road for each
// category; the review step shows every date as an estimate.
export const DEFAULT_SHELF_LIFE_DAYS: Record<PantryCategory, number> = {
  produce: 7,
  meat_seafood: 2,
  dairy_eggs: 14,
  grains_pasta: 365,
  canned_jarred: 730,
  condiments_sauces: 180,
  spices_seasonings: 730,
  baking: 365,
  snacks: 90,
  frozen: 180,
  beverages: 180,
  other: 90,
};

/** What the receipt agent returns (its structured output schema). */
export const parsedReceiptSchema = z.object({
  purchaseDate: z
    .string()
    .nullable()
    .describe(
      "The order or purchase date shown on the receipt, as YYYY-MM-DD, or null if none is visible",
    ),
  items: z.array(
    z.object({
      receiptText: z
        .string()
        .describe("The line as printed on the receipt, e.g. 'GV ORG BNLS CKN THG'"),
      ingredient: z
        .string()
        .describe("Clean, generic ingredient name, e.g. 'Chicken thighs'"),
      isFood: z
        .boolean()
        .describe("False for anything that isn't food or drink"),
      quantity: z.number().nullable(),
      unit: z
        .string()
        .nullable()
        .describe("e.g. 'can', 'lb', 'oz', 'bag', 'gal'; null for a count of items"),
      category: z.enum(PANTRY_CATEGORIES),
      shelfLifeDays: z
        .number()
        .nullable()
        .describe(
          "Typical days from purchase until it should be used (best-by for packaged goods)",
        ),
      expirationDate: z
        .string()
        .nullable()
        .describe(
          "An expiry, best-by, or use-by date written for this item in the input, as YYYY-MM-DD, or null if none is given",
        ),
      existingIngredient: z
        .string()
        .nullable()
        .describe(
          "The exact name of the existing pantry item this is the same thing as, or null",
        ),
    }),
  ),
});

export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;

export type ProposedItem = {
  receiptText: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  category: PantryCategory;
  expirationDate: string;
  // "provided" when the input gave this item's date; otherwise it's
  // estimated from the purchase date and shelf life.
  expirationSource: "provided" | "estimated";
  // The existing pantry item's exact name when this duplicates one.
  existingIngredient: string | null;
};

export type ReceiptProposal = {
  purchaseDate: string;
  items: ProposedItem[];
  // Receipt lines left out because they aren't food.
  skipped: string[];
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// "YYYY-MM-DD" as a local date (not UTC midnight, which is the previous day
// west of UTC). Null for anything that isn't a real calendar date.
function parseLocalDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  // Rejects overflow like 2026-02-31, which Date rolls into March.
  return formatLocalDate(date) === value ? date : null;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  const start = parseLocalDate(date);
  if (!start) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  start.setDate(start.getDate() + days);
  return formatLocalDate(start);
}

// The receipt's date when it's a real date no later than today; otherwise
// today (no date found, or a misread one).
function resolvePurchaseDate(value: string | null, today: Date): string {
  const todayString = formatLocalDate(today);
  if (!value) return todayString;
  const parsed = parseLocalDate(value);
  if (!parsed) return todayString;
  return value > todayString ? todayString : value;
}

/**
 * Turns the receipt agent's output into items ready for review: keeps an
 * expiry date the input gave, otherwise dates it from the purchase date, drops non-food lines into `skipped`, and
 * only keeps a duplicate flag when it names a real pantry item.
 */
export function toReceiptProposal(
  parsed: ParsedReceipt,
  existingIngredients: string[],
  today = new Date(),
): ReceiptProposal {
  const purchaseDate = resolvePurchaseDate(parsed.purchaseDate, today);
  const existingByName = new Map(
    existingIngredients.map((name) => [name.trim().toLowerCase(), name]),
  );

  const items: ProposedItem[] = [];
  const skipped: string[] = [];

  for (const item of parsed.items) {
    const ingredient = item.ingredient.trim();
    if (!item.isFood || !ingredient) {
      skipped.push(ingredient || item.receiptText);
      continue;
    }

    const providedDate =
      item.expirationDate && parseLocalDate(item.expirationDate)
        ? item.expirationDate
        : null;
    const shelfLife =
      item.shelfLifeDays !== null && item.shelfLifeDays > 0
        ? Math.round(item.shelfLifeDays)
        : DEFAULT_SHELF_LIFE_DAYS[item.category];

    items.push({
      receiptText: item.receiptText,
      ingredient,
      quantity:
        item.quantity !== null && item.quantity > 0 ? item.quantity : null,
      unit: item.unit?.trim() || null,
      category: item.category,
      expirationDate: providedDate ?? addDays(purchaseDate, shelfLife),
      expirationSource: providedDate ? "provided" : "estimated",
      existingIngredient: item.existingIngredient
        ? (existingByName.get(item.existingIngredient.trim().toLowerCase()) ??
          null)
        : null,
    });
  }

  return { purchaseDate, items, skipped };
}
