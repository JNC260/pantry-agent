/**
 * Recipe sites that turn away automated reading, worked out from the recipe
 * index: a site with BLOCKED_AFTER or more unreadable links and none read.
 * Their pins are still recommended (by title, board, and description), but
 * nothing pays for, or waits on, another attempt to read their pages. A
 * site stops counting as blocked as soon as one of its links is read (the
 * indexer still tries the free direct fetch for new pins).
 */
import type { RecipeIndexEntry } from "./recipe-index-entry";

export const BLOCKED_AFTER = 3;

/** "example.com" for a link (lowercase, no www.), or null if it won't parse. */
export function siteOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function findBlockedSites(
  entries: Iterable<RecipeIndexEntry>,
): Set<string> {
  const tally = new Map<string, { unreadable: number; read: boolean }>();
  for (const entry of entries) {
    const site = siteOf(entry.url);
    if (!site) continue;
    const counts = tally.get(site) ?? { unreadable: 0, read: false };
    if (entry.status === "ok") counts.read = true;
    else if (entry.status === "failed" && entry.reason === "unreadable") {
      counts.unreadable++;
    }
    tally.set(site, counts);
  }
  return new Set(
    [...tally]
      .filter(([, c]) => !c.read && c.unreadable >= BLOCKED_AFTER)
      .map(([site]) => site),
  );
}

export function isOnBlockedSite(url: string, blocked: Set<string>): boolean {
  const site = siteOf(url);
  return site !== null && blocked.has(site);
}

/** What extract-recipe throws for a link on a blocked site. */
export class BlockedSiteError extends Error {
  constructor(readonly site: string) {
    super(
      `${site} blocks automated reading (every earlier attempt failed), so this recipe's page can't be read`,
    );
    this.name = "BlockedSiteError";
  }
}
