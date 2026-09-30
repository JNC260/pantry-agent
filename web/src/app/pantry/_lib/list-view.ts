import {
  CATEGORY_LABELS,
  type PantryCategory,
  type PantryItem,
} from "@/lib/pantry-api";
import { freshness } from "@/lib/freshness";

export type SortKey = "ingredient" | "category" | "quantity" | "expires";
export type SortState = { key: SortKey; dir: "asc" | "desc" };
export type StatusFilter = "all" | "low" | "expiring";
export type CategoryFilter = PantryCategory | "all";

export const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All items" },
  { value: "low", label: "Low stock" },
  { value: "expiring", label: "Expiring soon or expired" },
];

// The id each row is rendered with, so the expiry notices can link to it.
export function itemAnchor(item: PantryItem): string {
  return `item-${item.id}`;
}

const byName = (a: PantryItem, b: PantryItem) =>
  a.ingredient.localeCompare(b.ingredient);

// Compare two possibly-missing values; missing always sorts last, whichever
// direction the column is sorted in.
function compareMissingLast<T>(
  a: T | null,
  b: T | null,
  compare: (a: T, b: T) => number,
  direction: 1 | -1,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b) * direction;
}

export function sortItems(
  items: PantryItem[],
  { key, dir }: SortState,
): PantryItem[] {
  const direction = dir === "asc" ? 1 : -1;
  const primary: Record<SortKey, (a: PantryItem, b: PantryItem) => number> = {
    ingredient: (a, b) => byName(a, b) * direction,
    category: (a, b) =>
      CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]) *
      direction,
    quantity: (a, b) =>
      compareMissingLast(a.quantity, b.quantity, (x, y) => x - y, direction),
    // "YYYY-MM-DD" compares correctly as a string.
    expires: (a, b) =>
      compareMissingLast(
        a.expirationDate,
        b.expirationDate,
        (x, y) => x.localeCompare(y),
        direction,
      ),
  };
  // Ties fall back to name A–Z, so e.g. sorting by category lists each
  // category's items alphabetically.
  return [...items].sort((a, b) => primary[key](a, b) || byName(a, b));
}

export function matchesStatus(item: PantryItem, filter: StatusFilter): boolean {
  if (filter === "low") return item.lowStock;
  if (filter === "expiring") {
    const status = freshness(item);
    return status === "expired" || status === "soon";
  }
  return true;
}

export function filterItems(
  items: PantryItem[],
  {
    query,
    status,
    category,
  }: { query: string; status: StatusFilter; category: CategoryFilter },
): PantryItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      item.ingredient.toLowerCase().includes(needle) &&
      matchesStatus(item, status) &&
      (category === "all" || item.category === category),
  );
}
