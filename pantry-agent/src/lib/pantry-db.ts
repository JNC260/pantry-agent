/**
 * Read-only access to the pantry, for grocery lists and for the receipt and
 * cooked-recipe routes. Writes always go through the api.
 *
 * The api owns the pantry_items table (schema and migrations in
 * api/src/pantry/pantry.db.ts); this reads the same database directly
 * instead of calling the api, so it must follow that schema.
 */
import { createClient, type Client } from "@libsql/client";

// Created on first use rather than at import, so a missing PANTRY_DB_URL
// only breaks grocery lists instead of crashing the whole agent server.
let pantryDb: Client | null = null;

function getPantryDb(): Client {
  const url = process.env.PANTRY_DB_URL;
  if (!url) throw new Error("PANTRY_DB_URL is not set");
  pantryDb ??= createClient({
    url,
    authToken: process.env.PANTRY_DB_AUTH_TOKEN,
  });
  return pantryDb;
}

// Must match OWNER_ID in api/src/auth/owner.ts, which owns this table.
const OWNER_ID = "owner";

export type PantryItem = {
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  lowStock: boolean;
};

export async function getPantryItems(): Promise<PantryItem[]> {
  const result = await getPantryDb().execute({
    sql: "SELECT ingredient, quantity, unit, expiration_date, low_stock FROM pantry_items WHERE user_id = ?",
    args: [OWNER_ID],
  });

  return result.rows.map((row) => ({
    ingredient: String(row.ingredient),
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit === null ? null : String(row.unit),
    expirationDate:
      row.expiration_date === null ? null : String(row.expiration_date),
    lowStock: Boolean(row.low_stock),
  }));
}

// A pantry item plus what the pantry-ai routes need to refer back to it.
export type PantryRow = PantryItem & { id: string; category: string };

export async function getPantryRows(): Promise<PantryRow[]> {
  const result = await getPantryDb().execute({
    sql: "SELECT id, ingredient, quantity, unit, expiration_date, low_stock, category FROM pantry_items WHERE user_id = ?",
    args: [OWNER_ID],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    ingredient: String(row.ingredient),
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit === null ? null : String(row.unit),
    expirationDate:
      row.expiration_date === null ? null : String(row.expiration_date),
    lowStock: Boolean(row.low_stock),
    category: String(row.category),
  }));
}
