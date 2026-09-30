import { createClient } from '@libsql/client';

export const pantryDb = createClient({
  url: process.env.PANTRY_DB_URL!,
  authToken: process.env.PANTRY_DB_AUTH_TOKEN,
});

// Columns added after the table was first created. Older databases get them
// on startup; new ones get them right after CREATE TABLE.
const ADDED_COLUMNS: Record<string, string> = {
  low_stock: 'INTEGER NOT NULL DEFAULT 0',
  category: "TEXT NOT NULL DEFAULT 'other'",
};

async function createPantryTable() {
  await pantryDb.execute(`
    CREATE TABLE IF NOT EXISTS pantry_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ingredient TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      expiration_date TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  const { rows } = await pantryDb.execute('PRAGMA table_info(pantry_items)');
  const existing = new Set(rows.map((row) => row.name));
  for (const [column, definition] of Object.entries(ADDED_COLUMNS)) {
    if (!existing.has(column)) {
      await pantryDb.execute(
        `ALTER TABLE pantry_items ADD COLUMN ${column} ${definition}`,
      );
    }
  }
}

// Shared by every request that arrives while setup is running, so it runs
// once. Cleared on failure so the next request retries.
let tableReady: Promise<void> | null = null;

export function ensurePantryTable(): Promise<void> {
  tableReady ??= createPantryTable().catch((err: unknown) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}
