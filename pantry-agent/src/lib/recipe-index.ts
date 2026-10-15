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
 */
import { client } from "./pinterest-cache";
import type { FailureReason, RecipeIndexEntry } from "./recipe-index-entry";

export type { RecipeIndexEntry };

export type RecipeIndexRow = RecipeIndexEntry & { indexedAt: number };

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
            attempts, indexed_at
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
      });
    }
  }
  return entries;
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
