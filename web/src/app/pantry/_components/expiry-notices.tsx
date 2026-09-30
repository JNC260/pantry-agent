"use client";

import { useEffect, useRef, useState } from "react";
import { AppleCoreIcon, CitrusIcon } from "@/components/graphics";
import { formatDate, freshness } from "@/lib/freshness";
import type { PantryItem } from "@/lib/pantry-api";
import { itemAnchor } from "../_lib/list-view";

type NoticeKind = "expired" | "soon";

type Notice = {
  kind: NoticeKind;
  Icon: (props: { className?: string }) => React.ReactNode;
  title: string;
  wash: string;
  items: PantryItem[];
  // Shown after the item name, e.g. "by Oct 1, 2026".
  describe: (date: string) => string;
};

// Soonest first; ties by name so the order is stable.
const byExpiration = (a: PantryItem, b: PantryItem) =>
  a.expirationDate!.localeCompare(b.expirationDate!) ||
  a.ingredient.localeCompare(b.ingredient);

function buildNotices(items: PantryItem[]): Notice[] {
  const expired = items
    .filter((item) => freshness(item) === "expired")
    .sort(byExpiration);
  const useSoon = items
    .filter((item) => freshness(item) === "soon")
    .sort(byExpiration);

  const notices: Notice[] = [];
  if (expired.length > 0) {
    notices.push({
      kind: "expired",
      Icon: AppleCoreIcon,
      title: "Toss these now",
      wash: "bg-paprika-wash",
      items: expired,
      describe: (date) => `expired ${date}`,
    });
  }
  if (useSoon.length > 0) {
    notices.push({
      kind: "soon",
      Icon: CitrusIcon,
      title: "Use these first",
      wash: "bg-saffron-wash",
      items: useSoon,
      describe: (date) => `by ${date}`,
    });
  }
  return notices;
}

// The expanded list for a notice. Each name jumps to its row in the table
// below, where the edit/delete actions live.
function NoticeItems({ items, describe }: Pick<Notice, "items" | "describe">) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col items-start">
          <a
            href={`#${itemAnchor(item)}`}
            className="underline decoration-current/40 underline-offset-[3px] transition-colors hover:decoration-current"
          >
            {item.ingredient}
          </a>
          <span className="text-walnut">
            {describe(formatDate(item.expirationDate!))}
          </span>
        </li>
      ))}
    </ul>
  );
}

// "Toss these now" and "Use these first" buttons above the table, each
// opening a list of the matching items. Renders nothing when neither applies.
export function ExpiryNotices({ items }: { items: PantryItem[] }) {
  const [openNotice, setOpenNotice] = useState<NoticeKind | null>(null);
  const noticesRef = useRef<HTMLDivElement>(null);

  // The notice lists float over the page, so close them like any popover:
  // on a click elsewhere or Escape.
  useEffect(() => {
    if (!openNotice) return;
    function onPointerDown(e: PointerEvent) {
      if (!noticesRef.current?.contains(e.target as Node)) setOpenNotice(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenNotice(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openNotice]);

  const notices = buildNotices(items);
  if (notices.length === 0) return null;

  return (
    <div ref={noticesRef} className="flex flex-wrap items-start gap-2">
      {notices.map((notice) => {
        const open = notice.kind === openNotice;
        return (
          <div key={notice.kind} className="relative">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? `notice-${notice.kind}` : undefined}
              onClick={() => setOpenNotice(open ? null : notice.kind)}
              className={`inline-flex cursor-pointer items-center gap-2.5 rounded-app py-2 pl-3 pr-2.5 text-ink transition-shadow hover:ring-1 hover:ring-walnut/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosemary ${open ? "rounded-b-none" : ""} ${notice.wash}`}
            >
              <notice.Icon className="size-[18px] flex-none" />
              <span className="font-display text-base font-medium">
                {notice.title}
              </span>
              <span className="text-sm tabular-nums text-walnut">
                {notice.items.length}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                className={`size-3 text-walnut transition-transform ${open ? "rotate-180" : ""}`}
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
            </button>
            {open && (
              // Floats over the content below rather than pushing it
              // down; inset-x-0 keeps it exactly the button's width.
              <div
                id={`notice-${notice.kind}`}
                className={`absolute inset-x-0 top-full z-20 rounded-b-app border border-walnut/30 border-t-walnut/20 px-3 pb-3 pt-2.5 ${notice.wash}`}
              >
                <NoticeItems items={notice.items} describe={notice.describe} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
