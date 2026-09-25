import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-app border border-rule p-6 ${className}`}>
      {children}
    </div>
  );
}
