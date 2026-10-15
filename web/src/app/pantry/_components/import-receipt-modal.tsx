"use client";

import { useState } from "react";
import { Button, Modal, TextField } from "@/components/ui";
import {
  applyPantryBatch,
  CATEGORY_OPTIONS,
  parseReceipt,
  type PantryBatchResult,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import { useLoadingMessage } from "@/lib/use-loading-message";
import type { Draft } from "../_lib/draft";
import {
  canMerge,
  formatLocalDate,
  restoredRow,
  shiftPurchaseDate,
  toReceiptBatch,
  toReviewRows,
  type ReviewRow,
} from "../_lib/receipt-review";
import { shrinkImage } from "../_lib/shrink-image";

// Matches the api's limit.
const MAX_FILES = 6;

const compactField =
  "w-full rounded-app border border-rule bg-linen px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:border-rosemary focus:ring-1 focus:ring-rosemary";

// Upload a receipt (or paste one), let the AI read it, then review and add.
// Nothing is written until "Add items". The parent remounts it (via `key`) on
// every open, so each open starts fresh.
export function ImportReceiptModal({
  open,
  onClose,
  items,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  items: PantryItem[];
  onApplied: (result: PantryBatchResult) => void;
}) {
  const [step, setStep] = useState<"input" | "parsing" | "review">("input");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [purchaseDate, setPurchaseDate] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const loadingMessage = useLoadingMessage(step === "parsing");

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, MAX_FILES));
  }

  async function read() {
    if (files.length === 0 && !text.trim()) {
      setError("Add a receipt file or paste some text.");
      return;
    }
    setError(null);
    setStep("parsing");
    try {
      const shrunk = await Promise.all(files.map(shrinkImage));
      const proposal = await parseReceipt(shrunk, text);
      setPurchaseDate(proposal.purchaseDate);
      setRows(toReviewRows(proposal, items));
      setSkipped(proposal.skipped);
      setStep("review");
    } catch {
      setError("Couldn't read that receipt. Try again, or try a clearer photo.");
      setStep("input");
    }
  }

  function updateRow(key: string, changes: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }

  function updateDraft(row: ReviewRow, fields: Partial<Draft>) {
    updateRow(row.key, {
      draft: { ...row.draft, ...fields },
      // A date the user typed is theirs, not an estimate.
      ...("expirationDate" in fields ? { expiryEstimated: false } : {}),
    });
  }

  function changePurchaseDate(value: string) {
    setRows((prev) => shiftPurchaseDate(prev, purchaseDate, value));
    if (value) setPurchaseDate(value);
  }

  function restore(name: string) {
    setSkipped((prev) => prev.filter((s) => s !== name));
    setRows((prev) => [
      ...prev,
      restoredRow(name, purchaseDate || formatLocalDate(new Date()), `restored-${prev.length}`),
    ]);
  }

  const batch = toReceiptBatch(rows);
  const count = (batch.create?.length ?? 0) + (batch.update?.length ?? 0);

  async function apply() {
    if (count === 0) return;
    setApplying(true);
    setError(null);
    try {
      onApplied(await applyPantryBatch(batch));
      onClose();
    } catch {
      setError("Couldn't add those items. Nothing was changed; try again.");
      setApplying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import a receipt" className="max-w-3xl">
      {step === "input" && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-walnut">
            Upload an order receipt (PDF or screenshots) or a photo of a paper
            receipt. For a long receipt, take several screenshots — up to{" "}
            {MAX_FILES}. You&apos;ll review everything before it&apos;s added.
          </p>

          <div className="flex flex-col gap-2">
            <label className={`${compactField} cursor-pointer text-center text-walnut hover:border-rosemary`}>
              Choose files or take a photo
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{file.name}</span>
                    <Button
                      variant="danger-text"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="receipt-text" className="text-sm font-medium text-ink">
              Or paste the receipt or a list
            </label>
            <textarea
              id="receipt-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={"From an order email, or a quick list:\n2 lb chicken thighs, dozen eggs, 3 cans black beans"}
              className={compactField}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {error && <p className="mr-auto text-sm text-paprika">{error}</p>}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={read}>Read receipt</Button>
          </div>
        </div>
      )}

      {step === "parsing" && (
        <p aria-live="polite" className="py-10 text-center font-display italic text-walnut">
          {loadingMessage}
        </p>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <TextField
              label="Purchased"
              type="date"
              value={purchaseDate}
              onChange={(e) => changePurchaseDate(e.target.value)}
              className="w-44"
            />
            <p className="text-sm text-walnut">
              Dates marked est. are estimates from the purchase date — adjust
              any you know.
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-walnut">No food items found on that receipt.</p>
          ) : (
            <ul className="flex max-h-[55vh] flex-col divide-y divide-rule overflow-y-auto border-y border-rule">
              {rows.map((row) => (
                <ReviewRowItem
                  key={row.key}
                  row={row}
                  onToggle={(selected) => updateRow(row.key, { selected })}
                  onMode={(mode) => updateRow(row.key, { mode })}
                  onDraft={(fields) => updateDraft(row, fields)}
                />
              ))}
            </ul>
          )}

          {skipped.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-walnut">
                Skipped as not food ({skipped.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {skipped.map((name) => (
                  <li key={name} className="flex items-center justify-between gap-3">
                    <span>{name}</span>
                    <Button variant="text" onClick={() => restore(name)}>
                      Add back
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {error && <p className="mr-auto text-sm text-paprika">{error}</p>}
            <Button variant="secondary" onClick={() => setStep("input")} disabled={applying}>
              Back
            </Button>
            <Button onClick={apply} disabled={applying || count === 0}>
              {applying
                ? "Adding…"
                : `Add ${count} item${count === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReviewRowItem({
  row,
  onToggle,
  onMode,
  onDraft,
}: {
  row: ReviewRow;
  onToggle: (selected: boolean) => void;
  onMode: (mode: ReviewRow["mode"]) => void;
  onDraft: (fields: Partial<Draft>) => void;
}) {
  const { draft, existing } = row;
  const mergeable = canMerge(row);

  return (
    <li className={`flex gap-3 py-3 ${row.selected ? "" : "opacity-50"}`}>
      <input
        type="checkbox"
        checked={row.selected}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Include ${draft.ingredient || row.receiptText}`}
        className="mt-2.5 size-4 flex-none accent-rosemary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,1.2fr)]">
          <input
            aria-label="Ingredient"
            value={draft.ingredient}
            onChange={(e) => onDraft({ ingredient: e.target.value })}
            className={`${compactField} col-span-2 sm:col-span-1`}
          />
          <select
            aria-label="Category"
            value={draft.category}
            onChange={(e) => onDraft({ category: e.target.value as PantryCategory })}
            className={`${compactField} col-span-2 cursor-pointer sm:col-span-1`}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Quantity"
            type="number"
            value={draft.quantity}
            onChange={(e) => onDraft({ quantity: e.target.value })}
            placeholder="Qty"
            className={compactField}
          />
          <input
            aria-label="Unit"
            value={draft.unit}
            onChange={(e) => onDraft({ unit: e.target.value })}
            placeholder="Unit"
            className={compactField}
          />
          <label className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
            <span className="sr-only">
              {row.expiryEstimated ? "Expires (estimated)" : "Expires"}
            </span>
            <input
              type="date"
              value={draft.expirationDate}
              onChange={(e) => onDraft({ expirationDate: e.target.value })}
              className={compactField}
            />
            {row.expiryEstimated && (
              <span aria-hidden="true" className="text-xs text-walnut">
                est.
              </span>
            )}
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-walnut">
          <span className="truncate">{row.receiptText}</span>
          {existing && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-app bg-sage-wash px-1.5 py-0.5 text-rosemary">
                You already have {existing.ingredient}
                {existing.quantity !== null &&
                  ` (${existing.quantity}${existing.unit ? ` ${existing.unit}` : ""})`}
              </span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`mode-${row.key}`}
                  checked={row.mode === "new"}
                  onChange={() => onMode("new")}
                  className="accent-rosemary"
                />
                Add as new row
              </label>
              <label
                className={`flex items-center gap-1 ${mergeable ? "" : "opacity-50"}`}
                title={mergeable ? undefined : "Merging needs a quantity in the same unit"}
              >
                <input
                  type="radio"
                  name={`mode-${row.key}`}
                  checked={row.mode === "merge"}
                  onChange={() => onMode("merge")}
                  disabled={!mergeable}
                  className="accent-rosemary"
                />
                Merge
              </label>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
