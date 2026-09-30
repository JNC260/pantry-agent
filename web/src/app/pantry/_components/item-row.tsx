"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { freshness, freshnessLabel, type Freshness } from "@/lib/freshness";
import {
  CATEGORY_LABELS,
  updatePantryItem,
  type PantryItem,
} from "@/lib/pantry-api";
import { TABLE_COLUMNS } from "./table-columns";

const freshnessStyles: Record<Freshness, string> = {
  expired: "text-paprika font-semibold before:bg-current",
  soon: "text-saffron font-semibold before:bg-current",
  fresh: "text-rosemary before:bg-current",
  none: "text-walnut before:border before:border-current",
};

// One item's row when it isn't being edited: its details, the low-stock
// toggle, and Edit/Delete (with an inline "Delete?" confirmation).
export function ItemRow({
  item,
  confirmingDelete,
  deleting,
  deleteError,
  onChange,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  item: PantryItem;
  confirmingDelete: boolean;
  deleting: boolean;
  deleteError: string | null;
  onChange: (item: PantryItem) => void;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  async function setLowStock(lowStock: boolean) {
    // Optimistic: show the pill change immediately, revert if the save fails.
    onChange({ ...item, lowStock });
    setFlagging(true);
    setFlagError(null);
    try {
      onChange(await updatePantryItem(item.id, { lowStock }));
    } catch {
      onChange(item);
      setFlagError("Couldn't update low stock. Try again.");
    } finally {
      setFlagging(false);
    }
  }

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-5 gap-y-1 ${TABLE_COLUMNS}`}
    >
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display text-[19px] font-medium">
          {item.ingredient}
        </span>
        {item.lowStock && (
          <span className="inline-flex items-center gap-1 self-center rounded-full bg-saffron-wash py-0.5 pl-2.5 pr-1 text-xs font-semibold text-saffron">
            Low stock
            <button
              type="button"
              onClick={() => setLowStock(false)}
              disabled={flagging}
              aria-label={`Remove low stock flag from ${item.ingredient}`}
              title="Remove low stock flag"
              className="grid size-4 cursor-pointer place-items-center rounded-full leading-none transition-colors hover:bg-saffron hover:text-saffron-wash focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2">
                <path
                  d="M2 2l6 6M8 2l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        )}
      </span>
      {/* On phones the columns stack, so the category moves under the name
          instead. */}
      <span className="text-sm text-walnut max-sm:col-span-2 max-sm:row-start-2 max-sm:-mt-1 max-sm:text-xs">
        {CATEGORY_LABELS[item.category]}
      </span>
      <span
        className={`text-[15px] tabular-nums ${item.lowStock ? "text-saffron" : ""}`}
      >
        {item.quantity !== null && item.quantity}
        {item.unit && (
          <span className={`text-sm ${item.lowStock ? "" : "text-walnut"}`}>
            {item.quantity !== null ? " " : ""}
            {item.unit}
          </span>
        )}
      </span>
      <span
        className={`inline-flex items-center gap-2 whitespace-nowrap text-sm tabular-nums before:size-[7px] before:flex-none before:rounded-full before:content-[''] ${freshnessStyles[freshness(item)]}`}
      >
        {freshnessLabel(item)}
      </span>

      {confirmingDelete ? (
        // Kept short enough to fit the 190px actions column on one line.
        <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap sm:col-span-1 sm:justify-self-end">
          <span className="text-sm">Delete?</span>
          <Button
            variant="danger-text"
            onClick={onConfirmDelete}
            disabled={deleting}
            aria-label={`Yes, delete ${item.ingredient}`}
          >
            {deleting ? "Deleting…" : "Yes"}
          </Button>
          <Button variant="text" onClick={onCancelDelete} disabled={deleting}>
            Cancel
          </Button>
          {deleteError && (
            <span className="basis-full whitespace-normal text-sm text-paprika">
              {deleteError}
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-4 justify-self-end">
          {/* Hidden rather than removed when flagged, so the actions column
              keeps its width and the quantity/expiry columns don't shift. */}
          <button
            type="button"
            onClick={() => setLowStock(true)}
            disabled={item.lowStock || flagging}
            aria-label={`Mark ${item.ingredient} as low stock`}
            className={`group inline-flex cursor-pointer items-center gap-1 text-sm text-walnut transition-colors hover:text-saffron disabled:cursor-not-allowed disabled:opacity-50 ${item.lowStock ? "invisible" : ""}`}
          >
            <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
              <path
                d="M2 6.5l2.5 2.5L10 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="underline decoration-rule underline-offset-[3px] group-hover:decoration-current">
              Mark low
            </span>
          </button>
          <Button variant="text" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger-text" onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
      {flagError && (
        <p className="col-span-full text-sm text-paprika">{flagError}</p>
      )}
    </div>
  );
}
