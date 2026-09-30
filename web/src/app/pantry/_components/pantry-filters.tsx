import { Button, SelectField, TextField } from "@/components/ui";
import { CATEGORY_LABELS, type PantryCategory } from "@/lib/pantry-api";
import {
  statusOptions,
  type CategoryFilter,
  type StatusFilter,
} from "../_lib/list-view";

// Search, status, and category controls above the table, plus a
// "N of M items" count and a reset once any of them is in use.
export function PantryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  categories,
  visibleCount,
  totalCount,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  // Only the categories that have items, so the list never offers an empty
  // one.
  categories: PantryCategory[];
  visibleCount: number;
  totalCount: number;
  onClear: () => void;
}) {
  const filtering =
    search.trim() !== "" || status !== "all" || category !== "all";
  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
      <TextField
        label="Search"
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search ingredients…"
        className="w-52"
      />
      <SelectField
        label="Status"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        options={statusOptions}
        className="w-60"
      />
      <SelectField
        label="Category"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
        options={categoryOptions}
        className="w-56"
      />
      {filtering && (
        <div className="flex basis-full items-baseline gap-4 pb-3 sm:ml-auto sm:basis-auto">
          <p className="text-sm tabular-nums text-walnut">
            {visibleCount} of {totalCount} items
          </p>
          <Button variant="text" onClick={onClear}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
