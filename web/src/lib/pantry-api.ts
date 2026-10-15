import { fetchJson } from "./api";

// Mirrors api/src/pantry/categories.ts — keep the two lists in sync.
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

export const CATEGORY_LABELS: Record<PantryCategory, string> = {
  produce: "Produce",
  meat_seafood: "Meat & Seafood",
  dairy_eggs: "Dairy & Eggs",
  grains_pasta: "Grains & Pasta",
  canned_jarred: "Canned & Jarred Goods",
  condiments_sauces: "Condiments & Sauces",
  spices_seasonings: "Spices & Seasonings",
  baking: "Baking",
  snacks: "Snacks",
  frozen: "Frozen",
  beverages: "Beverages",
  other: "Other",
};

// For <select> fields, in PANTRY_CATEGORIES order.
export const CATEGORY_OPTIONS = PANTRY_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export type PantryItem = {
  id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  createdAt: number;
  lowStock: boolean;
  category: PantryCategory;
};

export function listPantryItems(): Promise<PantryItem[]> {
  return fetchJson("/pantry");
}

export type NewPantryItem = {
  ingredient: string;
  quantity?: number;
  unit?: string;
  expirationDate?: string;
  category?: PantryCategory;
};

// null clears a field; an omitted field is left unchanged.
export type PantryItemUpdates = Partial<{
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  lowStock: boolean;
  category: PantryCategory;
}>;

export function createPantryItem(input: NewPantryItem): Promise<PantryItem> {
  return fetchJson("/pantry", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePantryItem(
  id: string,
  updates: PantryItemUpdates,
): Promise<PantryItem> {
  return fetchJson(`/pantry/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deletePantryItem(id: string): Promise<void> {
  await fetchJson(`/pantry/${id}`, { method: "DELETE" });
}

export type PantryBatch = {
  create?: NewPantryItem[];
  update?: (PantryItemUpdates & { id: string })[];
  delete?: string[];
};

export type PantryBatchResult = {
  created: PantryItem[];
  updated: PantryItem[];
  deleted: string[];
};

// All or nothing: if any part fails, nothing is written.
export function applyPantryBatch(batch: PantryBatch): Promise<PantryBatchResult> {
  return fetchJson("/pantry/batch", {
    method: "POST",
    body: JSON.stringify(batch),
  });
}

// A receipt line as the AI read it, before review. Mirrors ReceiptProposal
// in pantry-agent/src/lib/receipt-items.ts.
export type ProposedItem = {
  receiptText: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  category: PantryCategory;
  expirationDate: string;
  // "provided" when the input gave this item's date; otherwise it's
  // estimated from the purchase date.
  expirationSource: "provided" | "estimated";
  // The existing pantry item's exact name when this duplicates one.
  existingIngredient: string | null;
};

export type ReceiptProposal = {
  purchaseDate: string;
  items: ProposedItem[];
  skipped: string[];
};

// Reads a receipt (images, PDFs, and/or pasted text) into proposed items.
// Writes nothing.
export function parseReceipt(
  files: Blob[],
  text: string,
): Promise<ReceiptProposal> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  if (text.trim()) form.append("text", text);
  return fetchJson("/pantry/ai/receipt", { method: "POST", body: form });
}

// How cooking a recipe changes one pantry row. Mirrors CookedProposal in
// pantry-agent/src/lib/pantry-usage.ts.
export type CookedChange = {
  pantryItemId: string;
  ingredient: string;
  unit: string | null;
  recipeIngredient: string;
  before: number | null;
  // Null when the amount left is unknown.
  after: number | null;
  action: "decrement" | "remove";
  confidence: "sure" | "estimate" | "unsure";
  note: string;
};

export type CookedProposal = {
  recipeTitle: string | null;
  changes: CookedChange[];
  unmatched: string[];
};

export type CookedRecipe =
  | { url: string; servings?: number }
  | { ingredientsText: string; servings?: number };

// Proposes pantry changes for a recipe that was cooked. Writes nothing.
export function planCooked(recipe: CookedRecipe): Promise<CookedProposal> {
  return fetchJson("/pantry/ai/cooked", {
    method: "POST",
    body: JSON.stringify(recipe),
  });
}
