import { InputHTMLAttributes, useId } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  inputClassName?: string;
};

export function TextField({
  label,
  className = "",
  inputClassName = "bg-linen",
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const input = (
    <input
      id={inputId}
      className={`w-full rounded-app border border-rule px-3 py-2.5 text-[15px] text-ink placeholder:text-walnut outline-none transition-colors focus:border-rosemary focus:ring-1 focus:ring-rosemary ${inputClassName} ${label ? "" : className}`}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {input}
    </div>
  );
}
