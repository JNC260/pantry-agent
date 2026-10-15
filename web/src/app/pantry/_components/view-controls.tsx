import { Button } from "@/components/ui";

// Expand/collapse all sections, and the comfortable/compact row toggle.
// Expanding is moot while filtering (every match is shown), so those
// buttons are hidden then.
export function ViewControls({
  compact,
  onCompactChange,
  filtering,
  onExpandAll,
  onCollapseAll,
}: {
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  filtering: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const densities = [
    { label: "Comfortable", value: false },
    { label: "Compact", value: true },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-4">
        {!filtering && (
          <>
            <Button variant="text" onClick={onExpandAll}>
              Expand all
            </Button>
            <Button variant="text" onClick={onCollapseAll}>
              Collapse all
            </Button>
          </>
        )}
      </div>
      <div
        role="group"
        aria-label="Row size"
        className="inline-flex rounded-app border border-rule p-0.5 text-sm"
      >
        {densities.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            aria-pressed={compact === value}
            onClick={() => onCompactChange(value)}
            className={`cursor-pointer rounded-[2px] px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rosemary ${
              compact === value ? "bg-linen text-ink" : "text-walnut hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
