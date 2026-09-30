"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/api";
import { CHAT_HISTORY_KEY } from "@/lib/storage-keys";

export type Message = { role: "user" | "assistant"; content: string };

type ChatContextValue = {
  messages: Message[];
  sending: boolean;
  // False until saved history has been read, so the first render doesn't
  // flash the empty state or overwrite storage with [].
  hydrated: boolean;
  // A reply arrived that the chat page hasn't shown yet.
  unread: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
  markRead: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const { role, content } = value as Record<string, unknown>;
  return (role === "user" || role === "assistant") && typeof content === "string";
}

function loadHistory(): Message[] {
  const raw = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isMessage)) return parsed;
  } catch {
    // fall through to discard the bad value
  }
  localStorage.removeItem(CHAT_HISTORY_KEY);
  return [];
}

// Lives in the root layout so the conversation, and any request in flight,
// survive navigating between pages.
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [unread, setUnread] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  // localStorage only exists in the browser, so it can't be read during the
  // server render; loading it after mount avoids a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
      } else {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
      }
    } catch {
      // Storage full or blocked; the conversation still works in memory.
    }
  }, [messages, hydrated]);

  async function send(text: string) {
    if (!text.trim() || sending || !hydrated) return;

    const userMessage: Message = { role: "user", content: text };
    const history = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const { reply } = await fetchJson<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setUnread(true);
    } catch {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Try again." },
      ]);
      setUnread(true);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  }

  function clear() {
    requestRef.current?.abort();
    requestRef.current = null;
    setSending(false);
    setUnread(false);
    setMessages([]);
    localStorage.removeItem(CHAT_HISTORY_KEY);
  }

  function markRead() {
    setUnread(false);
  }

  return (
    <ChatContext.Provider
      value={{ messages, sending, hydrated, unread, send, clear, markRead }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside ChatProvider");
  return value;
}
