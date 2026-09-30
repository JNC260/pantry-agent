import { ReactNode } from "react";
import { LogoMark, Torchon } from "@/components/graphics";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-display text-[26px] font-semibold tracking-tight ${className}`}
    >
      <LogoMark className="h-[26px] w-[26px] flex-none" />
      <span>
        Pantry <em className="font-normal text-mulberry">Agent</em>
      </span>
    </span>
  );
}

export function Masthead({ children }: { children?: ReactNode }) {
  return (
    <header className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Wordmark />
        {children}
      </div>
      <Torchon className="mx-auto max-w-5xl" />
    </header>
  );
}
