"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api";

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
    <main className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end bg-black text-white rounded px-3 py-2 max-w-[80%]"
                : "self-start bg-gray-100 rounded px-3 py-2 max-w-[80%]"
            }
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="self-start text-gray-400 text-sm">Thinking…</div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I have chicken breast and kale, what should I make?"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
