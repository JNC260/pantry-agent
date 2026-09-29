import { SelectHTMLAttributes, useId } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: readonly { value: string; label: string }[];
};

// Native <select> styled to match TextField.
export function SelectField({
  label,
  options,
  className = "",
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        {/* appearance-none so the select takes TextField's exact height;
            the native arrow is replaced by the chevron below. */}
        <select
          id={selectId}
          className="w-full cursor-pointer appearance-none rounded-app border border-rule bg-linen py-2.5 pl-3 pr-9 text-[15px] leading-6 text-ink outline-none transition-colors focus:border-rosemary focus:ring-1 focus:ring-rosemary"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-walnut"
        >
          <path
            d="M3 4.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
