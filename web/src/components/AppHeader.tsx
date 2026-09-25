"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/pantry", label: "Pantry" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            Pantry Agent
          </span>
        </div>
        <nav className="flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-sm font-medium text-foreground"
                  : "text-sm font-medium text-muted hover:text-foreground"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <Button variant="secondary" onClick={handleLogout}>
        Log out
      </Button>
    </header>
  );
}
