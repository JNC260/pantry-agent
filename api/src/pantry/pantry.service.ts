import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { pantryDb, ensurePantryTable } from './pantry.db';

export type PantryItem = {
  id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  createdAt: number;
};

const OWNER_ID = 'owner'; // single-user for now, matches the JWT's sub claim

@Injectable()
export class PantryService {
  async list(): Promise<PantryItem[]> {
    await ensurePantryTable();
    const result = await pantryDb.execute({
      sql: 'SELECT * FROM pantry_items WHERE user_id = ? ORDER BY ingredient ASC',
      args: [OWNER_ID],
    });
    return result.rows.map(rowToPantryItem);
  }

  async get(id: string): Promise<PantryItem | null> {
    await ensurePantryTable();
    const result = await pantryDb.execute({
      sql: 'SELECT * FROM pantry_items WHERE id = ? AND user_id = ?',
      args: [id, OWNER_ID],
    });
    if (result.rows.length === 0) return null;
    return rowToPantryItem(result.rows[0]);
  }

  async create(input: {
    ingredient: string;
    quantity?: number;
    unit?: string;
    expirationDate?: string;
  }): Promise<PantryItem> {
    await ensurePantryTable();
    const id = randomUUID();
    const createdAt = Date.now();

    await pantryDb.execute({
      sql: `INSERT INTO pantry_items
              (id, user_id, ingredient, quantity, unit, expiration_date, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        OWNER_ID,
        input.ingredient,
        input.quantity ?? null,
        input.unit ?? null,
        input.expirationDate ?? null,
        createdAt,
      ],
    });

    return {
      id,
      ingredient: input.ingredient,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expirationDate: input.expirationDate ?? null,
      createdAt,
    };
  }

  async update(
    id: string,
    updates: Partial<{
      ingredient: string;
      quantity: number | null;
      unit: string | null;
      expirationDate: string | null;
    }>,
  ): Promise<PantryItem | null> {
    await ensurePantryTable();
    const existing = await this.get(id);
    if (!existing) return null;

    const merged = { ...existing, ...updates };

    await pantryDb.execute({
      sql: `UPDATE pantry_items
              SET ingredient = ?, quantity = ?, unit = ?, expiration_date = ?
              WHERE id = ? AND user_id = ?`,
      args: [
        merged.ingredient,
        merged.quantity,
        merged.unit,
        merged.expirationDate,
        id,
        OWNER_ID,
      ],
    });

    return merged;
  }

  async delete(id: string): Promise<boolean> {
    await ensurePantryTable();
    const result = await pantryDb.execute({
      sql: 'DELETE FROM pantry_items WHERE id = ? AND user_id = ?',
      args: [id, OWNER_ID],
    });
    return result.rowsAffected > 0;
  }
}

function rowToPantryItem(row: Record<string, unknown>): PantryItem {
  return {
    id: String(row.id),
    ingredient: String(row.ingredient),
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit === null ? null : String(row.unit),
    expirationDate:
      row.expiration_date === null ? null : String(row.expiration_date),
    createdAt: Number(row.created_at),
  };
}
