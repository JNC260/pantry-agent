"use client";

import { useState } from "react";
import { freshness } from "@/lib/freshness";
import {
  CATEGORY_LABELS,
  deletePantryItem,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import {
  groupByCategory,
  itemAnchor,
  type SortKey,
  type SortState,
} from "../_lib/list-view";
import { EditItemForm } from "./edit-item-form";
import { ItemRow } from "./item-row";
import { SortHeader } from "./sort-header";
import { tableColumns } from "./table-columns";

const COLUMNS: { label: string; column: SortKey }[] = [
  { label: "Ingredient", column: "ingredient" },
  { label: "Quantity", column: "quantity" },
  { label: "Expires", column: "expires" },
];

// The sortable item list, in one section per category. Sections can be
// collapsed, except while filtering, when every match is shown. At most one
// row is being edited, and at most one is asking "Delete?", at a time.
export function PantryTable({
  items,
  sort,
  onSort,
  compact,
  collapsed,
  filtering,
  onToggleCategory,
  onItemChange,
  onItemDelete,
}: {
  items: PantryItem[];
  sort: SortState;
  onSort: (column: SortKey) => void;
  compact: boolean;
  collapsed: PantryCategory[];
  filtering: boolean;
  onToggleCategory: (category: PantryCategory) => void;
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
        className={`flex flex-wrap gap-x-5 gap-y-1 border-b border-ink pb-2 sm:grid ${tableColumns(compact)}`}
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
      {groupByCategory(items).map(({ category, items: groupItems }) => {
        const expanded = filtering || !collapsed.includes(category);
        const listId = `category-${category}`;
        return (
          <section key={category}>
            <h2 className="sticky top-0 z-10 border-b border-rule bg-paper">
              <button
                type="button"
                onClick={() => onToggleCategory(category)}
                disabled={filtering}
                aria-expanded={expanded}
                aria-controls={expanded ? listId : undefined}
                className="flex w-full cursor-pointer items-center gap-2.5 py-2.5 text-left transition-colors hover:text-rosemary disabled:cursor-default disabled:hover:text-ink"
              >
                {!filtering && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className={`size-3 flex-none text-walnut transition-transform ${expanded ? "" : "-rotate-90"}`}
                  >
                    <path
                      d="M3 4.5l3 3 3-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="font-display text-lg font-medium">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="text-sm tabular-nums text-walnut">
                  {groupItems.length}
                </span>
                {!expanded && <ExpirySummary items={groupItems} />}
              </button>
            </h2>
            {expanded && (
              <ul id={listId}>
                {groupItems.map((item) => (
                  // scroll-mt clears the sticky section header when a notice
                  // link jumps here.
                  <li
                    key={item.id}
                    id={itemAnchor(item)}
                    className={`scroll-mt-16 border-rule transition-colors [&+&]:border-t target:bg-linen target:shadow-[-12px_0_0_var(--linen),12px_0_0_var(--linen)] ${compact ? "py-1.5" : "py-4"}`}
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
                        compact={compact}
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
            )}
          </section>
        );
      })}
    </div>
  );
}

// On a collapsed section's header, so expired or soon-to-expire items in it
// aren't hidden from view.
function ExpirySummary({ items }: { items: PantryItem[] }) {
  const expired = items.filter((item) => freshness(item) === "expired").length;
  const soon = items.filter((item) => freshness(item) === "soon").length;
  const dot = "before:size-[7px] before:rounded-full before:bg-current before:content-['']";
  return (
    <span className="ml-auto flex gap-4 text-sm font-semibold tabular-nums">
      {expired > 0 && (
        <span className={`inline-flex items-center gap-1.5 text-paprika ${dot}`}>
          {expired} expired
        </span>
      )}
      {soon > 0 && (
        <span className={`inline-flex items-center gap-1.5 text-saffron ${dot}`}>
          {soon} use soon
        </span>
      )}
    </span>
  );
}
