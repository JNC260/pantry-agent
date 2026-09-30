"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOKEN_KEY } from "@/lib/storage-keys";

// Sends a visitor with no saved token to /login. This is only a UX guard:
// the api rejects any request without a valid token regardless.
export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      router.push("/login");
    }
  }, [router]);
}
