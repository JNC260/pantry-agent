import { Button, SelectField, TextField } from "@/components/ui";
import { statusOptions, type StatusFilter } from "../_lib/list-view";

// Search and status controls above the table, plus a "N of M items" count
// and a reset once either is in use.
export function PantryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  visibleCount,
  totalCount,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  visibleCount: number;
  totalCount: number;
  onClear: () => void;
}) {
  const filtering = search.trim() !== "" || status !== "all";

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
