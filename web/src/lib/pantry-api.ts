import { authedFetch } from "./api";

export type PantryItem = {
  id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  createdAt: number;
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
