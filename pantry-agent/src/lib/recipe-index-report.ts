/**
 * The "unreadable pins" report behind the web app's Pins page: recipe pins
 * the recipe index gave up on, each with a link to the pin on Pinterest so
 * the user can decide whether to keep it.
 */
import type { LightweightPin } from "./pinterest-cache";
import { siteOf } from "./blocked-sites";
import { isRecipeBoard } from "./recipe-boards";
import type { FailureReason } from "./recipe-index-entry";

// What the report needs from an index row; see RecipeIndexRow.
export type IndexRow =
  | { status: "ok" }
  | {
      status: "failed" | "retry";
      reason: FailureReason;
      error: string;
      attempts: number;
      indexedAt: number;
    };

export type UnreadableRecipe = {
  sourceLink: string;
  reason: FailureReason;
  error: string;
  attempts: number;
  lastTriedAt: string;
  // Every recipe pin saved with this link (a recipe can be on several
  // boards).
  pins: { id: string; url: string; title: string | null; boardName: string }[];
};

export type RecipeIndexReport = {
  counts: {
    recipes: number;
    indexed: number;
    unreadable: number;
    // Not tried yet, or retrying after a transient error.
    pending: number;
  };
  unreadable: UnreadableRecipe[];
  // Sites among the unreadable recipes that block automated reading (see
  // blocked-sites.ts), sorted.
  blockedSites: string[];
};

export const pinterestPinUrl = (pinId: string) =>
  `https://www.pinterest.com/pin/${pinId}/`;

export function buildRecipeIndexReport(
  pins: LightweightPin[],
  index: Map<string, IndexRow>,
  blockedSites: Set<string>,
): RecipeIndexReport {
  const pinsByLink = new Map<string, LightweightPin[]>();
  for (const pin of pins) {
    if (!pin.sourceLink || !isRecipeBoard(pin.boardName)) continue;
    const list = pinsByLink.get(pin.sourceLink) ?? [];
    list.push(pin);
    pinsByLink.set(pin.sourceLink, list);
  }

  const counts = { recipes: pinsByLink.size, indexed: 0, unreadable: 0, pending: 0 };
  const unreadable: UnreadableRecipe[] = [];

  for (const [sourceLink, linkPins] of pinsByLink) {
    const row = index.get(sourceLink);
    if (!row || row.status === "retry") {
      counts.pending++;
    } else if (row.status === "ok") {
      counts.indexed++;
    } else {
      counts.unreadable++;
      unreadable.push({
        sourceLink,
        reason: row.reason,
        error: row.error,
        attempts: row.attempts,
        lastTriedAt: new Date(row.indexedAt).toISOString(),
        pins: linkPins.map((pin) => ({
          id: pin.id,
          url: pinterestPinUrl(pin.id),
          title: pin.title || null,
          boardName: pin.boardName,
        })),
      });
    }
  }

  unreadable.sort(
    (a, b) =>
      a.pins[0].boardName.localeCompare(b.pins[0].boardName) ||
      (a.pins[0].title ?? "").localeCompare(b.pins[0].title ?? ""),
  );
  const reportedBlocked = new Set(
    unreadable.flatMap(({ sourceLink }) => {
      const site = siteOf(sourceLink);
      return site && blockedSites.has(site) ? [site] : [];
    }),
  );
  return { counts, unreadable, blockedSites: [...reportedBlocked].sort() };
}
