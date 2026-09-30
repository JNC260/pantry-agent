"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { useChat } from "@/lib/chat-context";
import { TOKEN_KEY } from "@/lib/storage-keys";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/pantry", label: "Pantry" },
];

const linkBase =
  "border-b-2 pb-1 text-[15px] transition-colors";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { sending, unread, clear } = useChat();

  // Only needed off the chat page, which shows its own loading state.
  const chatStatus =
    pathname === "/chat" ? null : sending ? "reply loading" : unread ? "new reply" : null;

  function handleLogout() {
    clear();
    localStorage.removeItem(TOKEN_KEY);
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
            {link.href === "/chat" && chatStatus && (
              <span
                title={chatStatus === "new reply" ? "New reply" : "Reply loading"}
                className={`ml-1.5 inline-block size-2 rounded-full bg-mulberry align-middle ${
                  chatStatus === "reply loading" ? "animate-pulse" : ""
                }`}
              >
                <span className="sr-only">({chatStatus})</span>
              </span>
            )}
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
