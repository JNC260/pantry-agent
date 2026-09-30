/**
 * libSQL cache of the user's Pinterest boards and pins.
 *
 * Tables: boards_cache, pins_cache (keyed to a board), and cache_meta, which
 * records when each list was last fetched ("boards", "pins:<boardId>") for
 * the one-week freshness check. Uses PINTEREST_CACHE_DB_URL (Turso in
 * production) or a local SQLite file. The Pinterest OAuth token store
 * shares this database; see pinterest-token-store.ts.
 */
import { createClient } from "@libsql/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", ".."); // src/lib -> src -> project root

const dbUrl =
  process.env.PINTEREST_CACHE_DB_URL ??
  `file:${process.env.PINTEREST_CACHE_DB_PATH ?? join(PROJECT_ROOT, "pinterest-cache.db")}`;

export const client = createClient({
  url: dbUrl,
  authToken: process.env.PINTEREST_CACHE_DB_AUTH_TOKEN,
});

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by every caller that arrives while setup is running, so the tables
// are created once. Cleared on failure so the next call retries.
let tablesReady: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  tablesReady ??= createTables().catch((err: unknown) => {
    tablesReady = null;
    throw err;
  });
  return tablesReady;
}

async function createTables() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS boards_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS pins_cache (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        title TEXT,
        source_link TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cache_meta (
        cache_key TEXT PRIMARY KEY,
        fetched_at INTEGER NOT NULL
      )`,
    ],
    "write",
  );
}

async function isFresh(
  cacheKey: string,
  maxAgeMs = ONE_WEEK_MS,
): Promise<boolean> {
  await ensureTables();
  const result = await client.execute({
    sql: "SELECT fetched_at FROM cache_meta WHERE cache_key = ?",
    args: [cacheKey],
  });
  if (result.rows.length === 0) return false;
  const fetchedAt = Number(result.rows[0].fetched_at);
  return Date.now() - fetchedAt < maxAgeMs;
}

async function markFetched(cacheKey: string) {
  await client.execute({
    sql: `INSERT INTO cache_meta (cache_key, fetched_at) VALUES (?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET fetched_at = excluded.fetched_at`,
    args: [cacheKey, Date.now()],
  });
}

export async function getCachedBoards() {
  await ensureTables();
  const result = await client.execute("SELECT id, name FROM boards_cache");
  return result.rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}

export async function boardsAreFresh(maxAgeMs?: number) {
  return isFresh("boards", maxAgeMs);
}

export async function replaceCachedBoards(
  boards: { id: string; name: string }[],
) {
  await ensureTables();
  await client.batch(
    [
      "DELETE FROM boards_cache",
      ...boards.map((b) => ({
        sql: "INSERT INTO boards_cache (id, name) VALUES (?, ?)",
        args: [b.id, b.name],
      })),
    ],
    "write",
  );
  await markFetched("boards");
}

export async function getCachedPins(boardId: string) {
  await ensureTables();
  const result = await client.execute({
    sql: "SELECT id, board_id, title, source_link FROM pins_cache WHERE board_id = ?",
    args: [boardId],
  });
  return result.rows.map((r) => ({
    id: String(r.id),
    title: r.title === null ? null : String(r.title),
    sourceLink: r.source_link === null ? null : String(r.source_link),
  }));
}

export async function pinsAreFresh(boardId: string, maxAgeMs?: number) {
  return isFresh(`pins:${boardId}`, maxAgeMs);
}

export async function replaceCachedPins(
  boardId: string,
  pins: { id: string; title: string | null; sourceLink: string | null }[],
) {
  await ensureTables();
  await client.batch(
    [
      { sql: "DELETE FROM pins_cache WHERE board_id = ?", args: [boardId] },
      ...pins.map((p) => ({
        sql: "INSERT INTO pins_cache (id, board_id, title, source_link) VALUES (?, ?, ?, ?)",
        args: [p.id, boardId, p.title, p.sourceLink],
      })),
    ],
    "write",
  );
  await markFetched(`pins:${boardId}`);
}

// Every cached pin on a board that's still cached, with its board's id and
// name, in one query. Pins left behind by a board that has since been
// removed are skipped by the join.
async function getPinsWithBoards(boardId?: string) {
  await ensureTables();
  const result = await client.execute({
    sql: `SELECT p.id, p.title, p.source_link, p.board_id, b.name AS board_name
          FROM pins_cache p
          JOIN boards_cache b ON b.id = p.board_id
          ${boardId ? "WHERE p.board_id = ?" : ""}`,
    args: boardId ? [boardId] : [],
  });
  return result.rows.map((r) => ({
    id: String(r.id),
    title: r.title === null ? null : String(r.title),
    sourceLink: r.source_link === null ? null : String(r.source_link),
    boardId: String(r.board_id),
    boardName: String(r.board_name),
  }));
}

// Case-insensitive title search. Matching happens here rather than in SQL
// because SQLite's lower() only folds ASCII.
export async function searchCachedPins(query: string, boardId?: string) {
  const lowerQuery = query.toLowerCase();
  const pins = await getPinsWithBoards(boardId);
  return pins
    .filter((pin) => pin.title?.toLowerCase().includes(lowerQuery))
    .map(({ id, title, sourceLink, boardId }) => ({
      id,
      title,
      sourceLink,
      boardId,
    }));
}

export type LightweightPin = {
  id: string;
  title: string | null;
  boardName: string;
  sourceLink: string | null;
};

export async function getAllCachedPinsLightweight(): Promise<LightweightPin[]> {
  const pins = await getPinsWithBoards();
  return pins.map(({ id, title, boardName, sourceLink }) => ({
    id,
    title,
    boardName,
    sourceLink,
  }));
}
