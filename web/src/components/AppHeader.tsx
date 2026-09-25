"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Masthead } from "@/components/Masthead";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/pantry", label: "Pantry" },
];

const linkBase =
  "border-b-2 pb-1 text-[15px] transition-colors";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <Masthead>
      <nav className="flex items-baseline gap-7">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={
              pathname === link.href
                ? `${linkBase} border-mulberry font-medium text-ink`
                : `${linkBase} border-transparent font-medium text-walnut hover:text-rosemary`
            }
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className={`${linkBase} cursor-pointer border-transparent text-walnut hover:text-rosemary`}
        >
          Log out
        </button>
      </nav>
    </Masthead>
  );
}
