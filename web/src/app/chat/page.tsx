"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, TextField } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";
import { NestedArcs } from "@/components/graphics";
import { useChat } from "@/lib/chat-context";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  a: ({ children, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className="text-mulberry underline underline-offset-[3px] hover:text-mulberry-deep break-words"
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

const LOADING_MESSAGES = [
  "Simmering…",
  "Percolating…",
  "Chopping ingredients…",
  "Whisking…",
  "Preheating the oven…",
  "Reducing the sauce…",
  "Tasting for seasoning…",
  "Plating up…",
];

export default function ChatPage() {
  const { messages, sending, hydrated, unread, send, clear, markRead } =
    useChat();
  const [input, setInput] = useState("");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (unread) markRead();
  }, [unread, markRead]);

  useEffect(() => {
    if (!sending) return;
    const id = setInterval(() => {
      setLoadingIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, [sending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setInput("");
    setLoadingIndex(0);
    send(input);
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />

      <main className="min-h-0 flex-1 px-4 py-6 sm:px-6">
        <div className="relative mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-app bg-sage-wash">
          <NestedArcs className="pointer-events-none absolute -right-16 -top-16 w-44 sm:w-64" />

          <div className="relative flex-1 overflow-y-auto px-5 py-10 sm:px-12">
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
                    className="max-w-[62ch] border-l-2 border-rosemary pl-5"
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
                  {LOADING_MESSAGES[loadingIndex]}
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
