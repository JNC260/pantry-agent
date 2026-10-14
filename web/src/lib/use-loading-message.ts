"use client";

import { useEffect, useState } from "react";

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

// A cooking-themed status that changes every 2s while `active`, for waits
// on the agent. Starts from the first message each time it becomes active.
export function useLoadingMessage(active: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => {
      clearInterval(id);
      setIndex(0);
    };
  }, [active]);

  return LOADING_MESSAGES[index];
}
