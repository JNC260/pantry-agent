import { InputHTMLAttributes } from "react";

export function TextField({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent ${className}`}
      {...props}
    />
  );
}
