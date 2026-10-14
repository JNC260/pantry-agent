import type {
  CookedChange,
  CookedProposal,
  PantryBatch,
} from "@/lib/pantry-api";

// One proposed change in the review step. `after` is the amount-left field
// as typed, so it can be blank.
export type CookedRow = {
  change: CookedChange;
  selected: boolean;
  after: string;
};

// Guesses the AI isn't sure of start unchecked.
export function toCookedRows(proposal: CookedProposal): CookedRow[] {
  return proposal.changes.map((change) => ({
    change,
    selected: change.confidence !== "unsure",
    after: change.after !== null ? String(change.after) : "",
  }));
}

export type RowOutcome = "remove" | "update" | "needs-amount";

// What applying a selected row would do: 0 or less removes the item; a
// blank or non-numeric amount can't be applied yet.
export function rowOutcome(row: CookedRow): RowOutcome {
  const value = row.after.trim();
  if (!value || Number.isNaN(Number(value))) return "needs-amount";
  return Number(value) <= 0 ? "remove" : "update";
}

export function toCookedBatch(rows: CookedRow[]): PantryBatch {
  const update: NonNullable<PantryBatch["update"]> = [];
  const remove: string[] = [];

  for (const row of rows) {
    if (!row.selected) continue;
    const outcome = rowOutcome(row);
    if (outcome === "remove") remove.push(row.change.pantryItemId);
    if (outcome === "update") {
      update.push({
        id: row.change.pantryItemId,
        quantity: Number(row.after),
      });
    }
  }

  return { update, delete: remove };
}
