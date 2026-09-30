import { Injectable } from '@nestjs/common';
import type { Row, Value } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { pantryDb, ensurePantryTable } from './pantry.db';
import { OWNER_ID } from '../auth/owner';
import type { PantryCategory } from './categories';
import type { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import type { UpdatePantryItemDto } from './dto/update-pantry-item.dto';

export type PantryItem = {
  id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  expirationDate: string | null;
  createdAt: number;
  lowStock: boolean;
  category: PantryCategory;
};

// Update DTO field -> column. Also the allow-list of columns an update may
// write, since these names are interpolated into the SQL.
const UPDATABLE_COLUMNS: Record<keyof UpdatePantryItemDto, string> = {
  ingredient: 'ingredient',
  quantity: 'quantity',
  unit: 'unit',
  expirationDate: 'expiration_date',
  lowStock: 'low_stock',
  category: 'category',
};

/**
 * CRUD for the owner's pantry items in libSQL. Methods return null (or
 * false) when an item doesn't exist, and the controller turns that into a
 * 404.
 */
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

  async create(input: CreatePantryItemDto): Promise<PantryItem> {
    await ensurePantryTable();
    const id = randomUUID();
    const createdAt = Date.now();

    await pantryDb.execute({
      sql: `INSERT INTO pantry_items
              (id, user_id, ingredient, quantity, unit, expiration_date, created_at, low_stock, category)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        OWNER_ID,
        input.ingredient,
        input.quantity ?? null,
        input.unit ?? null,
        input.expirationDate ?? null,
        createdAt,
        input.lowStock ?? false,
        input.category ?? 'other',
      ],
    });

    return {
      id,
      ingredient: input.ingredient,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expirationDate: input.expirationDate ?? null,
      createdAt,
      lowStock: input.lowStock ?? false,
      category: input.category ?? 'other',
    };
  }

  async update(
    id: string,
    updates: UpdatePantryItemDto,
  ): Promise<PantryItem | null> {
    await ensurePantryTable();

    // Only the fields that were sent are written, so an edit never
    // overwrites a column it didn't touch.
    const fields = (
      Object.keys(UPDATABLE_COLUMNS) as (keyof UpdatePantryItemDto)[]
    ).filter((field) => updates[field] !== undefined);
    if (fields.length === 0) return this.get(id);

    const result = await pantryDb.execute({
      sql: `UPDATE pantry_items
              SET ${fields.map((field) => `${UPDATABLE_COLUMNS[field]} = ?`).join(', ')}
              WHERE id = ? AND user_id = ?
              RETURNING *`,
      args: [...fields.map((field) => updates[field] ?? null), id, OWNER_ID],
    });
    return result.rows.length > 0 ? rowToPantryItem(result.rows[0]) : null;
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

// libSQL returns loosely typed column values; narrow each to what the
// schema stores.
function asText(value: Value): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: Value): number | null {
  return typeof value === 'number' || typeof value === 'bigint'
    ? Number(value)
    : null;
}

function rowToPantryItem(row: Row): PantryItem {
  return {
    id: asText(row.id) ?? '',
    ingredient: asText(row.ingredient) ?? '',
    quantity: asNumber(row.quantity),
    unit: asText(row.unit),
    expirationDate: asText(row.expiration_date),
    createdAt: asNumber(row.created_at) ?? 0,
    lowStock: Boolean(row.low_stock),
    category: (asText(row.category) ?? 'other') as PantryCategory,
  };
}
