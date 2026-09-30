import type { PantryItem } from "./pantry-db";

// Items expiring within this many days count as "use soon". Matches
// USE_SOON_DAYS in web/src/lib/freshness.ts, so the grocery list and the
// pantry page agree.
export const USE_SOON_DAYS = 3;

const MS_PER_DAY = 86_400_000;

export type Freshness = "expired" | "soon" | "fresh" | "none";

export function classifyFreshness(
  expirationDate: string | null,
  today = new Date(),
): Freshness {
  if (!expirationDate) return "none";
  // Stored as "YYYY-MM-DD". Build a local date: `new Date("YYYY-MM-DD")`
  // parses as UTC midnight, which is the previous day west of UTC.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expirationDate);
  if (!match) return "none";
  const expiry = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const daysUntil = Math.round(
    (expiry.getTime() - startOfToday.getTime()) / MS_PER_DAY,
  );

  if (daysUntil < 0) return "expired";
  if (daysUntil <= USE_SOON_DAYS) return "soon";
  return "fresh";
}

// The labels the grocery-match agent is told how to treat; see its
// instructions in grocery-match-agent.ts.
const FRESHNESS_LABELS: Partial<Record<Freshness, string>> = {
  expired: "[EXPIRED — do not count this as available]",
  soon: "[expires soon — still usable now]",
};

// One pantry line for the prompt, e.g.
// "Rice — 2 lb (running low) [expires soon — still usable now]".
export function formatPantryLine(item: PantryItem, today = new Date()): string {
  const amount = [item.quantity, item.unit]
    .filter((part) => part !== null && part !== "")
    .join(" ");
  return [
    item.ingredient + (amount ? ` — ${amount}` : ""),
    item.lowStock ? "(running low)" : null,
    FRESHNESS_LABELS[classifyFreshness(item.expirationDate, today)] ?? null,
  ]
    .filter(Boolean)
    .join(" ");
}

// One recipe line for the prompt, e.g. "garlic — 2 cloves".
export function formatRecipeLine(ingredient: {
  item: string;
  quantity: string | null;
}): string {
  return ingredient.quantity
    ? `${ingredient.item} — ${ingredient.quantity}`
    : ingredient.item;
}
