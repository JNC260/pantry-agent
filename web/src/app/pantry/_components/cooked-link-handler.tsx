"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Opens the cooked-recipe flow when the page is reached through the chat's
// "update your pantry" link (/pantry?cooked=<recipe url>), then drops the
// param so a refresh doesn't start it again. Render inside <Suspense>:
// useSearchParams makes everything up to the nearest boundary client-only.
export function CookedLinkHandler({
  onCookedLink,
}: {
  onCookedLink: (url: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cooked = searchParams.get("cooked");

  useEffect(() => {
    if (!cooked) return;
    onCookedLink(cooked);
    router.replace("/pantry", { scroll: false });
  }, [cooked, onCookedLink, router]);

  return null;
}
