/**
 * The recipe index: each recipe pin's ingredient lines, keyed by the pin's
 * link, so recommendations can match on ingredients rather than titles.
 * Lives in the Pinterest cache database (table recipe_index); filled by
 * src/mastra/recipe-indexer.ts.
 *
 * A row is "ok" (title + ingredients), "failed" (won't be tried again
 * unless asked, so a bad link isn't paid for twice), or "retry" (a
 * transient error; tried again next run until it fails MAX_ATTEMPTS times —
 * see recipe-index-entry.ts).
 *
 * A failed row can also be marked "looks fine" by the user (accepted_at):
 * the page really is the recipe (a video, say) even though it can't be read.
 * It drops off the Pins page's unreadable list, is never tried again (not
 * even by --retry-failed), and is recommended by title, board, and
 * description whatever its failure reason. Saving a row leaves the mark
 * alone.
 */
import { client } from "./pinterest-cache";
import { findBlockedSites } from "./blocked-sites";
import type { FailureReason, RecipeIndexEntry } from "./recipe-index-entry";

export type { RecipeIndexEntry };

export type RecipeIndexRow = RecipeIndexEntry & {
  indexedAt: number;
  // When the user marked a failed link "looks fine" (ms), or null.
  acceptedAt: number | null;
};

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  tableReady ??= createTable().catch((err: unknown) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

async function createTable() {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS recipe_index (
      url TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      title TEXT,
      ingredients_json TEXT,
      source TEXT,
      error TEXT,
      indexed_at INTEGER NOT NULL
    )`,
  );
  // Columns added after the table first shipped.
  const columns = await client.execute("PRAGMA table_info(recipe_index)");
  const names = new Set(columns.rows.map((row) => String(row.name)));
  if (!names.has("attempts")) {
    await client.execute(
      "ALTER TABLE recipe_index ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1",
    );
  }
  if (!names.has("accepted_at")) {
    await client.execute(
      "ALTER TABLE recipe_index ADD COLUMN accepted_at INTEGER",
    );
  }
  if (!names.has("reason")) {
    await client.batch(
      [
        "ALTER TABLE recipe_index ADD COLUMN reason TEXT",
        `UPDATE recipe_index SET reason = CASE
           WHEN error LIKE 'link is dead%' THEN 'dead-link'
           WHEN error = 'not a single recipe' THEN 'not-a-recipe'
           ELSE 'unreadable' END
         WHERE status != 'ok'`,
      ],
      "write",
    );
  }
}

const REASONS: FailureReason[] = [
  "dead-link",
  "unreadable",
  "not-a-recipe",
  "errors",
];

/** Every indexed link, by url. */
export async function getRecipeIndex(): Promise<Map<string, RecipeIndexRow>> {
  await ensureTable();
  const result = await client.execute(
    `SELECT url, status, title, ingredients_json, source, error, reason,
            attempts, indexed_at, accepted_at
     FROM recipe_index`,
  );
  const entries = new Map<string, RecipeIndexRow>();
  for (const row of result.rows) {
    const url = String(row.url);
    const indexedAt = Number(row.indexed_at);
    if (row.status === "ok") {
      entries.set(url, {
        url,
        status: "ok",
        title: row.title === null ? null : String(row.title),
        ingredients: JSON.parse(String(row.ingredients_json)) as string[],
        source: row.source === "jsonld" ? "jsonld" : "ai",
        indexedAt,
        acceptedAt: null,
      });
    } else {
      const reason = REASONS.find((r) => r === row.reason) ?? "unreadable";
      entries.set(url, {
        url,
        status: row.status === "retry" ? "retry" : "failed",
        reason,
        error: String(row.error ?? ""),
        attempts: Number(row.attempts ?? 1),
        indexedAt,
        acceptedAt: row.accepted_at == null ? null : Number(row.accepted_at),
      });
    }
  }
  return entries;
}

/**
 * Marks a failed link "looks fine" (or takes the mark off). False if the
 * link has no failed row to mark.
 */
export async function setRecipeAccepted(
  url: string,
  accepted: boolean,
): Promise<boolean> {
  await ensureTable();
  const result = await client.execute({
    sql: "UPDATE recipe_index SET accepted_at = ? WHERE url = ? AND status = 'failed'",
    args: [accepted ? Date.now() : null, url],
  });
  return result.rowsAffected > 0;
}

/** Sites that block automated reading; see blocked-sites.ts. */
export async function getBlockedSites(): Promise<Set<string>> {
  return findBlockedSites((await getRecipeIndex()).values());
}

export async function saveRecipeIndexEntries(entries: RecipeIndexEntry[]) {
  if (entries.length === 0) return;
  await ensureTable();
  const now = Date.now();
  await client.batch(
    entries.map((entry) => ({
      sql: `INSERT INTO recipe_index
              (url, status, title, ingredients_json, source, error, reason,
               attempts, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
              status = excluded.status, title = excluded.title,
              ingredients_json = excluded.ingredients_json,
              source = excluded.source, error = excluded.error,
              reason = excluded.reason, attempts = excluded.attempts,
              indexed_at = excluded.indexed_at`,
      args:
        entry.status === "ok"
          ? [
              entry.url,
              "ok",
              entry.title,
              JSON.stringify(entry.ingredients),
              entry.source,
              null,
              null,
              1,
              now,
            ]
          : [
              entry.url,
              entry.status,
              null,
              null,
              null,
              entry.error,
              entry.reason,
              entry.attempts,
              now,
            ],
    })),
    "write",
  );
}
