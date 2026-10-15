"use client";

import { useCallback, useRef, useState } from "react";
import { useDismiss } from "../_lib/use-dismiss";

const itemClasses =
  "w-full cursor-pointer px-3 py-1.5 text-left text-sm transition-colors hover:bg-linen focus-visible:bg-linen focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

// Compact rows' actions, behind a "⋯" button instead of spelled out.
export function RowMenu({
  ingredient,
  lowStock,
  flagging,
  onMarkLow,
  onEdit,
  onDelete,
}: {
  ingredient: string;
  lowStock: boolean;
  flagging: boolean;
  onMarkLow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(menuRef, open, close);

  // Each action closes the menu first, so it isn't left open behind an edit
  // form or the delete confirmation.
  function choose(action: () => void) {
    return () => {
      setOpen(false);
      action();
    };
  }

  return (
    <div ref={menuRef} className="relative justify-self-end">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Actions for ${ingredient}`}
        className="grid size-7 cursor-pointer place-items-center rounded-app text-walnut transition-colors hover:bg-linen hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rosemary"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
          <circle cx="3" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="13" cy="8" r="1.4" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex min-w-36 flex-col rounded-app border border-rule bg-paper py-1 shadow-md">
          {!lowStock && (
            <button
              type="button"
              onClick={choose(onMarkLow)}
              disabled={flagging}
              className={itemClasses}
            >
              Mark low
            </button>
          )}
          <button type="button" onClick={choose(onEdit)} className={itemClasses}>
            Edit
          </button>
          <button
            type="button"
            onClick={choose(onDelete)}
            className={`${itemClasses} text-paprika`}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
