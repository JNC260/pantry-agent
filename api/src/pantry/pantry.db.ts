import { createClient } from '@libsql/client';

export const pantryDb = createClient({
  url: process.env.PANTRY_DB_URL!,
  authToken: process.env.PANTRY_DB_AUTH_TOKEN,
});

let initialized = false;

export async function ensurePantryTable() {
  if (initialized) return;

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

  try {
    await pantryDb.execute(
      `ALTER TABLE pantry_items ADD COLUMN low_stock INTEGER NOT NULL DEFAULT 0`,
    );
  } catch (err) {
    // column already exists on every run after the first — expected, ignore
  }

  try {
    await pantryDb.execute(
      `ALTER TABLE pantry_items ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`,
    );
  } catch {
    // column already exists on every run after the first — expected, ignore
  }

  initialized = true;
}
