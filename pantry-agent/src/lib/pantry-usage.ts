import { z } from "zod";
import type { PantryRow } from "./pantry-db";

/** What the pantry-usage agent returns (its structured output schema). */
export const usagePlanSchema = z.object({
  recipeTitle: z
    .string()
    .nullable()
    .describe("The recipe's name if it's clear from the input, otherwise null"),
  changes: z.array(
    z.object({
      pantryItemId: z
        .string()
        .describe("The id of the pantry row being used, copied exactly"),
      recipeIngredient: z
        .string()
        .describe("The recipe line this comes from, e.g. '2 cloves garlic'"),
      amountUsed: z
        .number()
        .nullable()
        .describe(
          "How much of that row the recipe uses, in the row's own unit; null when you can't tell",
        ),
      usesItAllUp: z
        .boolean()
        .describe("True when the recipe uses everything in that row"),
      confidence: z.enum(["sure", "estimate", "unsure"]),
      note: z
        .string()
        .describe("Short explanation, e.g. 'about 10 cloves in a head'"),
    }),
  ),
  unmatched: z
    .array(z.string())
    .describe("Recipe ingredients with no pantry match (excluding to-taste items)"),
});

export type UsagePlan = z.infer<typeof usagePlanSchema>;

export type UsageChange = {
  pantryItemId: string;
  ingredient: string;
  unit: string | null;
  recipeIngredient: string;
  before: number | null;
  // Null when the amount left is unknown (the user decides).
  after: number | null;
  // "remove" once nothing is left.
  action: "decrement" | "remove";
  confidence: "sure" | "estimate" | "unsure";
  note: string;
};

export type CookedProposal = {
  recipeTitle: string | null;
  changes: UsageChange[];
  unmatched: string[];
};

const CONFIDENCE_RANK = { sure: 0, estimate: 1, unsure: 2 } as const;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Turns the usage agent's plan into before -> after changes against the real
 * pantry. The agent only says how much was used; the subtraction happens
 * here so the arithmetic is exact. Drops changes to rows that don't exist,
 * adds up several uses of one row, never goes below 0, and marks used-up
 * rows for removal.
 */
export function toCookedProposal(
  plan: UsagePlan,
  pantry: PantryRow[],
): CookedProposal {
  const rows = new Map(pantry.map((row) => [row.id, row]));

  // All uses of each row, in order.
  const uses = new Map<string, UsagePlan["changes"]>();
  for (const change of plan.changes) {
    if (!rows.has(change.pantryItemId)) continue;
    uses.set(change.pantryItemId, [
      ...(uses.get(change.pantryItemId) ?? []),
      change,
    ]);
  }

  const changes = [...uses].map(([id, rowUses]): UsageChange => {
    const row = rows.get(id)!;
    const usedUp = rowUses.some((use) => use.usesItAllUp);
    const amounts = rowUses.map((use) => use.amountUsed);
    const knownTotal = amounts.every((a) => a !== null)
      ? amounts.reduce<number>((sum, a) => sum + Math.max(0, a ?? 0), 0)
      : null;

    let after: number | null;
    if (usedUp) after = 0;
    else if (row.quantity !== null && knownTotal !== null) {
      after = round(Math.max(0, row.quantity - knownTotal));
    } else after = null;

    const worst = rowUses.reduce<UsageChange["confidence"]>(
      (acc, use) =>
        CONFIDENCE_RANK[use.confidence] > CONFIDENCE_RANK[acc]
          ? use.confidence
          : acc,
      "sure",
    );

    return {
      pantryItemId: id,
      ingredient: row.ingredient,
      unit: row.unit,
      recipeIngredient: rowUses.map((use) => use.recipeIngredient).join("; "),
      before: row.quantity,
      after,
      action: after === 0 ? "remove" : "decrement",
      // Without a known amount left, the user has to decide.
      confidence: after === null ? "unsure" : worst,
      note: rowUses
        .map((use) => use.note)
        .filter(Boolean)
        .join(" "),
    };
  });

  return { recipeTitle: plan.recipeTitle, changes, unmatched: plan.unmatched };
}

// One pantry line for the usage prompt, with the id the agent must echo back.
export function formatUsagePantryLine(row: PantryRow): string {
  const amount = [row.quantity, row.unit]
    .filter((part) => part !== null && part !== "")
    .join(" ");
  return [
    `[id: ${row.id}]`,
    row.ingredient,
    amount ? `— ${amount}` : "— (no amount recorded)",
    row.expirationDate ? `(expires ${row.expirationDate})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
