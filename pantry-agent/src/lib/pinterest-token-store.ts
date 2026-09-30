import { createHash } from "node:crypto";
import { client } from "./pinterest-cache";

// Pinterest rotates the refresh token on every refresh, so the latest one has
// to outlive the process. Stored as a single row in the same libSQL database
// as the Pinterest cache.

export type StoredPinterestTokens = {
  refreshToken: string;
  refreshTokenExpiresAt: number | null; // epoch ms
  accessToken: string | null;
  accessTokenExpiresAt: number; // epoch ms
  // Hash of the env refresh token this chain started from. If the env value
  // changes (the OAuth flow was re-run), the env token wins over the stored one.
  seedHash: string;
};

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  await client.execute(`CREATE TABLE IF NOT EXISTS pinterest_oauth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    refresh_token TEXT NOT NULL,
    refresh_token_expires_at INTEGER,
    access_token TEXT,
    access_token_expires_at INTEGER NOT NULL,
    seed_hash TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  initialized = true;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadPinterestTokens(): Promise<StoredPinterestTokens | null> {
  await ensureTable();
  const result = await client.execute("SELECT * FROM pinterest_oauth WHERE id = 1");
  const row = result.rows[0];
  if (!row) return null;
  return {
    refreshToken: String(row.refresh_token),
    refreshTokenExpiresAt:
      row.refresh_token_expires_at == null ? null : Number(row.refresh_token_expires_at),
    accessToken: row.access_token == null ? null : String(row.access_token),
    accessTokenExpiresAt: Number(row.access_token_expires_at),
    seedHash: String(row.seed_hash),
  };
}

// Saves tokens obtained by refreshing `usedRefreshToken`. Only overwrites the
// stored row if it still holds that token (or came from a different seed), so
// a process that lost a refresh race can't replace the winner's newer tokens.
// Returns false when another process had already saved newer tokens.
export async function savePinterestTokens(
  tokens: StoredPinterestTokens,
  usedRefreshToken: string,
): Promise<boolean> {
  await ensureTable();
  const result = await client.execute({
    sql: `INSERT INTO pinterest_oauth (
            id, refresh_token, refresh_token_expires_at, access_token,
            access_token_expires_at, seed_hash, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            refresh_token = excluded.refresh_token,
            refresh_token_expires_at = excluded.refresh_token_expires_at,
            access_token = excluded.access_token,
            access_token_expires_at = excluded.access_token_expires_at,
            seed_hash = excluded.seed_hash,
            updated_at = excluded.updated_at
          WHERE pinterest_oauth.refresh_token = ?
             OR pinterest_oauth.seed_hash != excluded.seed_hash`,
    args: [
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
      tokens.accessToken,
      tokens.accessTokenExpiresAt,
      tokens.seedHash,
      Date.now(),
      usedRefreshToken,
    ],
  });
  return result.rowsAffected > 0;
}

// Only expires the stored access token if it's still the rejected one, so a
// newer token saved by another process is left alone.
export async function expireStoredAccessToken(accessToken: string) {
  await ensureTable();
  await client.execute({
    sql: `UPDATE pinterest_oauth SET access_token_expires_at = 0
          WHERE id = 1 AND access_token = ?`,
    args: [accessToken],
  });
}
