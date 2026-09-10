"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage.content }),
      });
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto w-full">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">
          Pantry Agent
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 py-4">
        {messages.length === 0 && !sending && (
          <p className="text-sm text-muted">
            Tell me what you have on hand and I&apos;ll find something to
            make from your Pinterest boards.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end bg-accent text-accent-foreground rounded-app px-3 py-2 max-w-[80%] text-sm leading-relaxed"
                : "self-start bg-surface border border-border text-foreground rounded-app px-3 py-2 max-w-[80%] text-sm leading-relaxed"
            }
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="self-start text-muted text-sm">Thinking…</div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-border p-4"
      >
        <TextField
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I have chicken breast and kale, what should I make?"
          className="flex-1"
        />
        <Button type="submit" disabled={sending}>
          Send
        </Button>
      </form>
    </main>
  );
}
