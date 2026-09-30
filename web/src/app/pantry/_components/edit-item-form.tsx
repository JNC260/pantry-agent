"use client";

import { useState } from "react";
import { Button, SelectField, TextField } from "@/components/ui";
import {
  CATEGORY_OPTIONS,
  updatePantryItem,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import { changedFields, toDraft, type Draft } from "../_lib/draft";

// Replaces an item's row while it's being edited. Saves only the fields that
// changed; saving with no changes just closes the form.
export function EditItemForm({
  item,
  onSaved,
  onCancel,
}: {
  item: PantryItem;
  onSaved: (updated: PantryItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(fields: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...fields }));
  }

  async function save() {
    if (!draft.ingredient.trim()) {
      setError("Ingredient is required.");
      return;
    }
    const updates = changedFields(item, draft);
    if (Object.keys(updates).length === 0) {
      onCancel();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onSaved(await updatePantryItem(item.id, updates));
    } catch {
      setError("Couldn't save changes. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,0.5fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
        <TextField
          label="Ingredient"
          value={draft.ingredient}
          onChange={(e) => update({ ingredient: e.target.value })}
          className="col-span-2 lg:col-span-1"
        />
        <SelectField
          label="Category"
          value={draft.category}
          onChange={(e) =>
            update({ category: e.target.value as PantryCategory })
          }
          options={CATEGORY_OPTIONS}
          className="col-span-2 lg:col-span-1"
        />
        <TextField
          label="Quantity"
          value={draft.quantity}
          onChange={(e) => update({ quantity: e.target.value })}
          type="number"
        />
        <TextField
          label="Unit"
          value={draft.unit}
          onChange={(e) => update({ unit: e.target.value })}
        />
        <TextField
          label="Expires"
          value={draft.expirationDate}
          onChange={(e) => update({ expirationDate: e.target.value })}
          type="date"
          className="col-span-2 lg:col-span-1"
        />
      </div>
      {error && <p className="text-sm text-paprika">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
