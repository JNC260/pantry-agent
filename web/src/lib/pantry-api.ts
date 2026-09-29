import { authedFetch } from "./api";

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

export async function listPantryItems(): Promise<PantryItem[]> {
  const res = await authedFetch("/pantry");
  return res.json();
}

export async function createPantryItem(input: {
  ingredient: string;
  quantity?: number;
  unit?: string;
  expirationDate?: string;
  category?: PantryCategory;
}): Promise<PantryItem> {
  const res = await authedFetch("/pantry", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function updatePantryItem(
  id: string,
  updates: Partial<{
    ingredient: string;
    quantity: number;
    unit: string;
    expirationDate: string;
    lowStock: boolean;
    category: PantryCategory;
  }>,
): Promise<PantryItem> {
  const res = await authedFetch(`/pantry/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deletePantryItem(id: string): Promise<void> {
  await authedFetch(`/pantry/${id}`, { method: "DELETE" });
}
