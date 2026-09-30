"use client";

import { useRef, useState } from "react";
import { Button, Modal, SelectField, TextField } from "@/components/ui";
import {
  CATEGORY_OPTIONS,
  createPantryItem,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import { emptyDraft, toNewItem, type Draft } from "../_lib/draft";

// Existing names to suggest while adding, so "Chicken breast" doesn't come
// back as "chicken breasts". De-duplicated ignoring case.
function ingredientSuggestions(items: PantryItem[]): string[] {
  return [
    ...new Map(
      items.map((item) => [item.ingredient.toLowerCase(), item.ingredient]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
}

// Stays open after each add so several items can go in at once. The parent
// remounts it (via `key`) on every open, so each open starts from an empty
// form.
export function AddItemModal({
  open,
  onClose,
  items,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  items: PantryItem[];
  onAdded: (item: PantryItem) => void;
}) {
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirms the last add, since the fields clearing is otherwise the only
  // sign it worked.
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const ingredientInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ingredient.trim()) {
      setError("Ingredient is required.");
      return;
    }

    setAdding(true);
    setError(null);
    setLastAdded(null);
    try {
      const created = await createPantryItem(toNewItem(form));
      onAdded(created);
      // Stay open for the next item: clear the fields and go back to the top.
      setForm(emptyDraft);
      setLastAdded(created.ingredient);
      ingredientInputRef.current?.focus();
    } catch {
      setError("Couldn't add that item. Try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add items"
      initialFocusRef={ingredientInputRef}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            ref={ingredientInputRef}
            label="Ingredient"
            value={form.ingredient}
            onChange={(e) =>
              setForm((f) => ({ ...f, ingredient: e.target.value }))
            }
            placeholder="e.g. Parmesan"
            list="pantry-ingredient-suggestions"
            autoComplete="off"
            // Hide Chrome's heavy datalist arrow; suggestions still
            // appear as you type. Needs !important to beat Chrome's own
            // style for it.
            inputClassName="bg-linen [&::-webkit-calendar-picker-indicator]:hidden!"
            className="col-span-2"
          />
          <datalist id="pantry-ingredient-suggestions">
            {ingredientSuggestions(items).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <SelectField
            label="Category"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as PantryCategory,
              }))
            }
            options={CATEGORY_OPTIONS}
          />
          <TextField
            label="Expires"
            value={form.expirationDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, expirationDate: e.target.value }))
            }
            type="date"
          />
          <TextField
            label="Quantity"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="1"
            type="number"
          />
          <TextField
            label="Unit"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            placeholder="wedge"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p aria-live="polite" className="mr-auto text-sm">
            {error ? (
              <span className="text-paprika">{error}</span>
            ) : (
              lastAdded && (
                <span className="text-rosemary">Added {lastAdded}.</span>
              )
            )}
          </p>
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
