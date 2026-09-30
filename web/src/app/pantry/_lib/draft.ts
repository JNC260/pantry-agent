import type {
  NewPantryItem,
  PantryCategory,
  PantryItem,
  PantryItemUpdates,
} from "@/lib/pantry-api";

// What the add and edit forms hold: every field as the string the input
// shows, so an empty field is "" rather than null.
export type Draft = {
  ingredient: string;
  quantity: string;
  unit: string;
  expirationDate: string;
  category: PantryCategory;
};

export const emptyDraft: Draft = {
  ingredient: "",
  quantity: "",
  unit: "",
  expirationDate: "",
  category: "other",
};

export function toDraft(item: PantryItem): Draft {
  return {
    ingredient: item.ingredient,
    quantity: item.quantity !== null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    expirationDate: item.expirationDate ?? "",
    category: item.category,
  };
}

// The request body for a new item; empty optional fields are left out.
export function toNewItem(draft: Draft): NewPantryItem {
  const input: NewPantryItem = {
    ingredient: draft.ingredient.trim(),
    category: draft.category,
  };
  if (draft.quantity.trim()) input.quantity = Number(draft.quantity);
  if (draft.unit.trim()) input.unit = draft.unit.trim();
  if (draft.expirationDate.trim()) input.expirationDate = draft.expirationDate;
  return input;
}

// Only the fields the edit actually changed. A field emptied in the form is
// sent as null, which clears it.
export function changedFields(item: PantryItem, draft: Draft): PantryItemUpdates {
  const updates: PantryItemUpdates = {};

  const ingredient = draft.ingredient.trim();
  if (ingredient !== item.ingredient) updates.ingredient = ingredient;

  const quantity = draft.quantity.trim();
  if (quantity !== (item.quantity !== null ? String(item.quantity) : "")) {
    updates.quantity = quantity ? Number(quantity) : null;
  }

  const unit = draft.unit.trim();
  if (unit !== (item.unit ?? "")) updates.unit = unit || null;

  const expirationDate = draft.expirationDate.trim();
  if (expirationDate !== (item.expirationDate ?? "")) {
    updates.expirationDate = expirationDate || null;
  }

  if (draft.category !== item.category) updates.category = draft.category;

  return updates;
}
