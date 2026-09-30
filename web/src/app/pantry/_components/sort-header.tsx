import type { SortKey, SortState } from "../_lib/list-view";

// A column heading that sorts by that column. The active column shows an
// arrow for its direction.
export function SortHeader({
  label,
  column,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex cursor-pointer items-center gap-1.5 font-display text-[17px] font-medium text-ink transition-colors ${
        active ? "" : "hover:text-rosemary"
      } ${className}`}
    >
      {label}
      {active && (
        <>
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3.5">
            <path
              d={sort.dir === "asc" ? "M3 7.5l3-3 3 3" : "M3 4.5l3 3 3-3"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">
            , sorted {sort.dir === "asc" ? "ascending" : "descending"}
          </span>
        </>
      )}
    </button>
  );
}
