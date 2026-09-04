import { createClient } from "@libsql/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", ".."); // src/lib -> src -> project root

const dbUrl =
  process.env.PINTEREST_CACHE_DB_URL ??
  `file:${process.env.PINTEREST_CACHE_DB_PATH ?? join(PROJECT_ROOT, "pinterest-cache.db")}`;

const client = createClient({
  url: dbUrl,
  authToken: process.env.PINTEREST_CACHE_DB_AUTH_TOKEN,
});

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let initialized = false;

export async function ensureTables() {
  if (initialized) return;

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

  initialized = true;
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

// Used by the search tool in Session 9 to search across every cached board
export async function getAllCachedBoardIds(): Promise<string[]> {
  const boards = await getCachedBoards();
  return boards.map((b) => b.id);
}

export async function searchCachedPins(query: string, boardId?: string) {
  await ensureTables();

  const lowerQuery = query.toLowerCase();

  const boardIds = boardId ? [boardId] : await getAllCachedBoardIds();

  const matches: {
    id: string;
    title: string | null;
    sourceLink: string | null;
    boardId: string;
  }[] = [];

  for (const id of boardIds) {
    const pins = await getCachedPins(id);
    for (const pin of pins) {
      if (pin.title && pin.title.toLowerCase().includes(lowerQuery)) {
        matches.push({ ...pin, boardId: id });
      }
    }
  }

  return matches;
}
export async function getBoardNameMap(): Promise<Record<string, string>> {
  const boards = await getCachedBoards();
  const map: Record<string, string> = {};
  for (const b of boards) {
    map[b.id] = b.name;
  }
  return map;
}
