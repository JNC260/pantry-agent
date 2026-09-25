"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui";
import { Wordmark } from "@/components/Masthead";
import { PanelStillLife } from "@/components/graphics";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        throw new Error("Incorrect password");
      }

      const { token } = await res.json();
      localStorage.setItem("token", token);
      router.push("/chat");
    } catch {
      setError("That password didn’t match. Check it and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="relative flex min-h-56 flex-col justify-between gap-8 overflow-hidden bg-rosemary-fill p-7 text-on-rosemary sm:p-10">
        <Wordmark className="relative z-10 text-[22px] [&_em]:text-on-rosemary [&_circle]:fill-on-rosemary" />
        <p className="relative z-10 max-w-[22ch] font-display text-2xl italic leading-snug">
          Recipes from my own boards, checked against what’s actually in the
          kitchen.
        </p>
        <PanelStillLife className="absolute -bottom-10 -right-10 w-3/4 max-w-md" />
      </div>

      <div className="flex items-center px-7 py-12 sm:px-10">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-3xl font-medium">Log in</h1>
            <p className="text-[15px] text-walnut">
              Enter the password to open Pantry Agent.
            </p>
          </div>
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-paprika">{error}</p>}
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
