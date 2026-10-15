"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, TextField } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import { NestedArcs } from "@/components/graphics";
import { useChat } from "@/lib/chat-context";
import { useLoadingMessage } from "@/lib/use-loading-message";
import { useRequireAuth } from "@/lib/use-require-auth";

const linkClasses =
  "text-mulberry underline underline-offset-[3px] hover:text-mulberry-deep break-words";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  a: ({ children, href, ...props }) =>
    // Links into the app (e.g. the agent's "update your pantry" link) stay in
    // this tab; recipe pages and other sites open a new one.
    href?.startsWith("/") && !href.startsWith("//") ? (
      <Link href={href} className={linkClasses}>
        {children}
      </Link>
    ) : (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer"
        className={linkClasses}
      >
        {children}
      </a>
    ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-3 last:mb-0 flex flex-col gap-1.5 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:size-2 [&>li]:before:rounded-full [&>li]:before:bg-rosemary [&>li]:before:content-['']">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 last:mb-0 flex flex-col gap-1.5 list-decimal pl-5 marker:text-rosemary marker:font-medium">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  code: ({ children }) => (
    <code className="rounded-app bg-paper px-1 py-0.5 text-[0.9em]">
      {children}
    </code>
  ),
};

export default function ChatPage() {
  const { messages, sending, hydrated, unread, send, clear, markRead } =
    useChat();
  useRequireAuth();
  const [input, setInput] = useState("");
  const loadingMessage = useLoadingMessage(sending);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (unread) markRead();
  }, [unread, markRead]);

  // After you send, show your message and the loading line at the bottom.
  // When a reply lands, show it from its first line rather than jumping past
  // it to the end. The first scroll (arriving on the page) is instant.
  useEffect(() => {
    const container = scrollRef.current;
    const last = messages[messages.length - 1];
    if (!container || !last) return;

    const behavior = hasScrolledRef.current ? "smooth" : "instant";
    hasScrolledRef.current = true;

    if (last.role === "user") {
      container.scrollTo({ top: container.scrollHeight, behavior });
    } else {
      container
        .querySelector("[data-last-message]")
        ?.scrollIntoView({ block: "start", behavior });
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setInput("");
    send(input);
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />

      <main className="min-h-0 flex-1 px-4 py-6 sm:px-6">
        <div className="relative mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-app bg-sage-wash">
          <NestedArcs className="pointer-events-none absolute -right-16 -top-16 w-44 sm:w-64" />

          <div
            ref={scrollRef}
            className="relative flex-1 overflow-y-auto px-5 py-10 sm:px-12"
          >
            <div className="flex max-w-2xl flex-col gap-7">
              {hydrated && messages.length === 0 && !sending && (
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-3xl font-medium">
                    What’s in the kitchen?
                  </h1>
                  <p className="max-w-[52ch] text-walnut">
                    Tell me what you have on hand and I&apos;ll find something
                    to make from your Pinterest boards.
                  </p>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <p
                    key={i}
                    className="max-w-[36ch] whitespace-pre-wrap font-display text-[21px] italic leading-snug text-mulberry"
                  >
                    {m.content}
                  </p>
                ) : (
                  <div
                    key={i}
                    data-last-message={
                      i === messages.length - 1 ? true : undefined
                    }
                    className="max-w-[62ch] scroll-mt-6 border-l-2 border-rosemary pl-5"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ),
              )}
              {sending && (
                <p className="font-display italic text-rosemary">
                  {loadingMessage}
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative flex flex-col gap-3 border-t border-sage-mid px-5 py-5 sm:flex-row sm:items-end sm:px-12"
          >
            <TextField
              label="Ask about dinner"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I have chicken breast and kale, what should I make?"
              className="flex-1"
              inputClassName="bg-paper"
            />
            <Button
              type="submit"
              disabled={sending || !hydrated}
              className="sm:self-end"
            >
              Send
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="text"
                onClick={clear}
                disabled={sending}
                className="self-start sm:mb-3 sm:self-end"
              >
                Clear conversation
              </Button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
