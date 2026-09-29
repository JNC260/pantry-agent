import { createClient } from "@libsql/client";

const pantryDb = createClient({
  url: process.env.PANTRY_DB_URL!,
  authToken: process.env.PANTRY_DB_AUTH_TOKEN,
});

const OWNER_ID = "owner";

export type PantryItem = {
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  lowStock: boolean;
};

export async function getPantryItems(): Promise<PantryItem[]> {
  const result = await pantryDb.execute({
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
