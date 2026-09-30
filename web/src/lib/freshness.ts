import type { PantryItem } from "@/lib/pantry-api";

// Items expiring within this many days count as "use soon". The grocery list
// tool in pantry-agent (generateGroceryList.ts) uses the same window.
export const USE_SOON_DAYS = 3;

const MS_PER_DAY = 86_400_000;

// Expiration dates come from <input type="date">, i.e. "YYYY-MM-DD". Built
// as a local date: `new Date("YYYY-MM-DD")` would be UTC midnight, which is
// the previous day west of UTC.
export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// "2026-10-01" -> "Oct 1, 2026"; anything unparseable is shown as-is.
export function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : value;
}

// Whole days from today until the date; negative once it has passed.
export function daysUntil(value: string, today = new Date()): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - startOfToday.getTime()) / MS_PER_DAY);
}

export type Freshness = "expired" | "soon" | "fresh" | "none";

export function freshness(
  item: Pick<PantryItem, "expirationDate">,
  today = new Date(),
): Freshness {
  if (!item.expirationDate) return "none";
  const days = daysUntil(item.expirationDate, today);
  if (days === null) return "fresh";
  if (days < 0) return "expired";
  if (days <= USE_SOON_DAYS) return "soon";
  return "fresh";
}

export function freshnessLabel(item: Pick<PantryItem, "expirationDate">): string {
  if (!item.expirationDate) return "No date";
  const date = formatDate(item.expirationDate);
  switch (freshness(item)) {
    case "expired":
      return `Expired ${date}`;
    case "soon":
      return `Use by ${date}`;
    default:
      return `Expires ${date}`;
  }
}
