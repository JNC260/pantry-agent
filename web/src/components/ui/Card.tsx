import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-app border border-border bg-surface p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
