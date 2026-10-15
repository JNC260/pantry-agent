import { PANTRY_CATEGORIES, type PantryCategory } from "@/lib/pantry-api";

// How the pantry list is laid out, remembered per browser. Not in
// storage-keys.ts: these aren't cleared on logout.
export type ViewPrefs = { compact: boolean; collapsed: PantryCategory[] };

const PREFS_KEY = "pantryView";

const DEFAULT_PREFS: ViewPrefs = { compact: false, collapsed: [] };

// Anything unreadable falls back to the defaults, and unknown categories
// (e.g. from an older version) are dropped.
export function parsePrefs(raw: string | null): ViewPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PREFS;
    const { compact, collapsed } = parsed as Record<string, unknown>;
    return {
      compact: compact === true,
      collapsed: Array.isArray(collapsed)
        ? PANTRY_CATEGORIES.filter((c) => collapsed.includes(c))
        : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Storage can be missing (server render) or throw (blocked site data), so
// both directions quietly fall back.
export function loadPrefs(): ViewPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ViewPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered this time; the view still works.
  }
}
