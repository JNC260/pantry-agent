"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Modal, SelectField, TextField } from "@/components/ui";
import {
  applyPantryBatch,
  planCooked,
  type CookedRecipe,
  type PantryBatchResult,
} from "@/lib/pantry-api";
import { useLoadingMessage } from "@/lib/use-loading-message";
import {
  rowOutcome,
  toCookedBatch,
  toCookedRows,
  type CookedRow,
} from "../_lib/cooked-review";

const BATCH_OPTIONS = [
  { value: "0.5", label: "Half batch" },
  { value: "1", label: "As written" },
  { value: "1.5", label: "1½ batches" },
  { value: "2", label: "Double" },
  { value: "3", label: "Triple" },
];

const compactField =
  "w-full rounded-app border border-rule bg-linen px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:border-rosemary focus:ring-1 focus:ring-rosemary";

const formatAmount = (amount: number | null, unit: string | null) =>
  amount === null ? "?" : `${amount}${unit ? ` ${unit}` : ""}`;

// "I cooked this": give a recipe link or its ingredients, let the AI work out
// what was used, then review and apply. Nothing changes until "Update
// pantry". With `initialUrl` (from the chat's link) it starts reading
// straight away. The parent remounts it (via `key`) on every open.
export function CookedRecipeModal({
  open,
  onClose,
  onApplied,
  initialUrl,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: (result: PantryBatchResult) => void;
  initialUrl?: string;
}) {
  const [step, setStep] = useState<"input" | "planning" | "review">(
    initialUrl ? "planning" : "input",
  );
  const [url, setUrl] = useState(initialUrl ?? "");
  const [ingredientsText, setIngredientsText] = useState("");
  const [batch, setBatch] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [rows, setRows] = useState<CookedRow[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const loadingMessage = useLoadingMessage(step === "planning");

  async function plan(recipe: CookedRecipe) {
    try {
      const proposal = await planCooked(recipe);
      setRecipeTitle(proposal.recipeTitle);
      setRows(toCookedRows(proposal));
      setUnmatched(proposal.unmatched);
      setStep("review");
    } catch {
      setError(
        "Couldn't read that recipe. Check the link, or paste the ingredients instead.",
      );
      setStep("input");
    }
  }

  // The chat link opens this with a recipe already chosen. Guarded so React's
  // dev double-run doesn't send it twice.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!initialUrl || autoStarted.current) return;
    autoStarted.current = true;
    void plan({ url: initialUrl });
  }, [initialUrl]);

  function start() {
    const link = url.trim();
    const text = ingredientsText.trim();
    if (!link === !text) {
      setError(
        link
          ? "Use either the link or the pasted ingredients, not both."
          : "Add a recipe link or paste its ingredients.",
      );
      return;
    }
    setError(null);
    setStep("planning");
    const servings = Number(batch);
    void plan(link ? { url: link, servings } : { ingredientsText: text, servings });
  }

  function updateRow(index: number, changes: Partial<CookedRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }

  const pantryBatch = toCookedBatch(rows);
  const count =
    (pantryBatch.update?.length ?? 0) + (pantryBatch.delete?.length ?? 0);
  const incomplete = rows.some(
    (row) => row.selected && rowOutcome(row) === "needs-amount",
  );

  async function apply() {
    if (count === 0 || incomplete) return;
    setApplying(true);
    setError(null);
    try {
      onApplied(await applyPantryBatch(pantryBatch));
      onClose();
    } catch {
      setError("Couldn't update the pantry. Nothing was changed; try again.");
      setApplying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cooked a recipe" className="max-w-2xl">
      {step === "input" && (
        <div className="flex flex-col gap-5">
          <TextField
            label="Recipe link"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cooked-ingredients" className="text-sm font-medium text-ink">
              Or paste the ingredients
            </label>
            <textarea
              id="cooked-ingredients"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              rows={6}
              placeholder={"2 cups flour\n3 eggs\n1 cup milk"}
              className={compactField}
            />
          </div>
          <SelectField
            label="How much did you make?"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            options={BATCH_OPTIONS}
            className="w-48"
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {error && <p className="mr-auto text-sm text-paprika">{error}</p>}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={start}>Work out what I used</Button>
          </div>
        </div>
      )}

      {step === "planning" && (
        <p aria-live="polite" className="py-10 text-center font-display italic text-walnut">
          {loadingMessage}
        </p>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-5">
          {recipeTitle && (
            <p className="font-display text-lg italic">{recipeTitle}</p>
          )}

          {rows.length === 0 ? (
            <p className="text-walnut">
              Nothing in your pantry matched this recipe.
            </p>
          ) : (
            <ul className="flex max-h-[55vh] flex-col divide-y divide-rule overflow-y-auto border-y border-rule">
              {rows.map((row, index) => (
                <CookedRowItem
                  key={row.change.pantryItemId}
                  row={row}
                  onChange={(changes) => updateRow(index, changes)}
                />
              ))}
            </ul>
          )}

          {unmatched.length > 0 && (
            <p className="text-sm text-walnut">
              Not in your pantry: {unmatched.join(", ")}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {(error || incomplete) && (
              <p className="mr-auto text-sm text-paprika">
                {error ?? "Enter how much is left for each checked item."}
              </p>
            )}
            <Button variant="secondary" onClick={() => setStep("input")} disabled={applying}>
              Back
            </Button>
            <Button onClick={apply} disabled={applying || count === 0 || incomplete}>
              {applying ? "Updating…" : `Update ${count} item${count === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CookedRowItem({
  row,
  onChange,
}: {
  row: CookedRow;
  onChange: (changes: Partial<CookedRow>) => void;
}) {
  const { change } = row;
  const outcome = rowOutcome(row);

  return (
    <li className={`flex gap-3 py-3 ${row.selected ? "" : "opacity-50"}`}>
      <input
        type="checkbox"
        checked={row.selected}
        onChange={(e) => onChange({ selected: e.target.checked })}
        aria-label={`Update ${change.ingredient}`}
        className="mt-1 size-4 flex-none accent-rosemary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-medium">{change.ingredient}</span>
          <span className="text-sm text-walnut">
            {formatAmount(change.before, change.unit)} →
          </span>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="sr-only">Amount left</span>
            <input
              type="number"
              min="0"
              value={row.after}
              onChange={(e) => onChange({ after: e.target.value })}
              placeholder="left?"
              className={`${compactField} w-24`}
            />
            {change.unit && <span className="text-walnut">{change.unit}</span>}
          </label>
          {outcome === "remove" && (
            <span className="rounded-app bg-paprika-wash px-1.5 py-0.5 text-xs text-paprika">
              Remove — used up
            </span>
          )}
          {change.confidence !== "sure" && (
            <span className="rounded-app bg-saffron-wash px-1.5 py-0.5 text-xs">
              {change.confidence === "estimate" ? "Estimate" : "Not sure"}
            </span>
          )}
        </div>
        <p className="text-xs text-walnut">
          For {change.recipeIngredient}
          {change.note && ` · ${change.note}`}
        </p>
      </div>
    </li>
  );
}
