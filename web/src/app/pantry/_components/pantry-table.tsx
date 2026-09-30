"use client";

import { useState } from "react";
import { deletePantryItem, type PantryItem } from "@/lib/pantry-api";
import { itemAnchor, type SortKey, type SortState } from "../_lib/list-view";
import { EditItemForm } from "./edit-item-form";
import { ItemRow } from "./item-row";
import { SortHeader } from "./sort-header";
import { TABLE_COLUMNS } from "./table-columns";

const COLUMNS: { label: string; column: SortKey }[] = [
  { label: "Ingredient", column: "ingredient" },
  { label: "Category", column: "category" },
  { label: "Quantity", column: "quantity" },
  { label: "Expires", column: "expires" },
];

// The sortable item list. At most one row is being edited, and at most one
// is asking "Delete?", at a time.
export function PantryTable({
  items,
  sort,
  onSort,
  onItemChange,
  onItemDelete,
}: {
  items: PantryItem[];
  sort: SortState;
  onSort: (column: SortKey) => void;
  onItemChange: (item: PantryItem) => void;
  onItemDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
  }

  function cancelDelete() {
    setDeletingId(null);
    setDeleteError(null);
  }

  async function confirmDelete(id: string) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePantryItem(id);
      onItemDelete(id);
      setDeletingId(null);
    } catch {
      setDeleteError("Couldn't delete that item. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div
        className={`flex flex-wrap gap-x-5 gap-y-1 border-b border-ink pb-2 sm:grid ${TABLE_COLUMNS}`}
      >
        {COLUMNS.map(({ label, column }) => (
          <SortHeader
            key={column}
            label={label}
            column={column}
            sort={sort}
            onSort={onSort}
            className="justify-self-start"
          />
        ))}
      </div>
      <ul className="border-b border-rule">
        {items.map((item) => (
          <li
            key={item.id}
            id={itemAnchor(item)}
            className="scroll-mt-6 border-rule py-4 transition-colors [&+&]:border-t target:bg-linen target:shadow-[-12px_0_0_var(--linen),12px_0_0_var(--linen)]"
          >
            {editingId === item.id ? (
              <EditItemForm
                item={item}
                onSaved={(updated) => {
                  onItemChange(updated);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ItemRow
                item={item}
                confirmingDelete={deletingId === item.id}
                deleting={deleting}
                deleteError={deleteError}
                onChange={onItemChange}
                onEdit={() => setEditingId(item.id)}
                onDelete={() => startDelete(item.id)}
                onConfirmDelete={() => confirmDelete(item.id)}
                onCancelDelete={cancelDelete}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
