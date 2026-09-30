import axios from "axios";
import {
  expireStoredAccessToken,
  hashToken,
  loadPinterestTokens,
  savePinterestTokens,
} from "./pinterest-token-store";

let cachedToken: string | null = null;
let expiresAt = 0; // epoch ms

// refresh a bit early (60s buffer) to avoid edge-case races
const EARLY_REFRESH_MS = 60_000;

// The refresh in progress, shared by every caller that needs a token while it
// runs. Pinterest rotates the refresh token on each use, so two parallel
// refreshes would race to spend the same one.
let inflight: Promise<string> | null = null;

// Pinterest's POST /oauth/token response for a refresh_token grant.
type PinterestTokenResponse = {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds
  refresh_token_expires_at?: number; // epoch seconds
};

function isValid(
  token: string | null,
  expiry: number,
  now: number,
): token is string {
  return !!token && now < expiry - EARLY_REFRESH_MS;
}

export async function getValidPinterestToken(): Promise<string> {
  if (isValid(cachedToken, expiresAt, Date.now())) {
    return cachedToken;
  }

  inflight ??= loadOrRefreshToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

// Pinterest rejected this access token before its expiry (e.g. revoked by a
// re-authorization), so the next call must refresh instead of reusing it.
export async function invalidatePinterestToken(rejected: string) {
  if (cachedToken === rejected) {
    cachedToken = null;
    expiresAt = 0;
  }
  try {
    await expireStoredAccessToken(rejected);
  } catch (err) {
    console.error("[pinterest-auth] failed to expire stored access token:", err);
  }
}

async function loadOrRefreshToken(): Promise<string> {
  const now = Date.now();

  const envRefreshToken = process.env.PINTEREST_REFRESH_TOKEN;
  if (!envRefreshToken) {
    throw new Error("PINTEREST_REFRESH_TOKEN is not set");
  }
  const seedHash = hashToken(envRefreshToken);

  // A stored chain only counts if it started from the current env token;
  // otherwise the OAuth flow was re-run and the env token is newer.
  const stored = await loadPinterestTokens();
  const current = stored?.seedHash === seedHash ? stored : null;
  if (stored && !current) {
    console.log(
      "[pinterest-auth] PINTEREST_REFRESH_TOKEN changed; starting from the env token",
    );
  }

  // Reuse an access token another process (or a previous run) already got.
  if (
    current &&
    isValid(current.accessToken, current.accessTokenExpiresAt, now)
  ) {
    cachedToken = current.accessToken;
    expiresAt = current.accessTokenExpiresAt;
    return cachedToken;
  }

  const refreshToken = current?.refreshToken ?? envRefreshToken;

  let data: PinterestTokenResponse;
  try {
    const response = await axios.post<PinterestTokenResponse>(
      "https://api.pinterest.com/v5/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
    data = response.data;
  } catch (err) {
    // Another process sharing the database (e.g. local dev and production)
    // may have spent this refresh token between our read and our request.
    const latest = await loadPinterestTokens().catch(() => null);
    if (
      latest?.seedHash === seedHash &&
      latest.refreshToken !== refreshToken &&
      isValid(latest.accessToken, latest.accessTokenExpiresAt, Date.now())
    ) {
      console.log(
        "[pinterest-auth] another process refreshed first; using its token",
      );
      cachedToken = latest.accessToken;
      expiresAt = latest.accessTokenExpiresAt;
      return cachedToken;
    }

    console.error(
      "[pinterest-auth] token refresh failed:",
      ...(axios.isAxiosError(err)
        ? [err.response?.status, err.response?.data ?? err.message]
        : [err]),
    );
    throw err;
  }

  if (!data.access_token) {
    throw new Error("Pinterest token refresh returned no access_token");
  }

  const newExpiresAt = now + data.expires_in * 1000;
  // Pinterest rotates the refresh token on every refresh; keep the old one
  // only if a response ever omits it.
  const newRefreshToken = data.refresh_token ?? refreshToken;
  const refreshTokenExpiresAt =
    data.refresh_token_expires_in != null
      ? now + data.refresh_token_expires_in * 1000
      : data.refresh_token_expires_at != null
        ? data.refresh_token_expires_at * 1000
        : (current?.refreshTokenExpiresAt ?? null);

  const accessToken = data.access_token;
  cachedToken = accessToken;
  expiresAt = newExpiresAt;

  try {
    const saved = await savePinterestTokens(
      {
        refreshToken: newRefreshToken,
        refreshTokenExpiresAt,
        accessToken,
        accessTokenExpiresAt: newExpiresAt,
        seedHash,
      },
      refreshToken,
    );
    if (!saved) {
      // Our access token is still good for this process; keep theirs stored.
      console.log(
        "[pinterest-auth] another process saved newer tokens first; keeping them",
      );
    }
  } catch (err) {
    // The access token still works for this process, but the rotated refresh
    // token is only in memory, so a restart may not be able to refresh.
    console.error("[pinterest-auth] failed to save rotated tokens:", err);
  }

  console.log(
    `[pinterest-auth] refreshed access token (expires ${new Date(newExpiresAt).toISOString()}` +
      (refreshTokenExpiresAt
        ? `, refresh token expires ${new Date(refreshTokenExpiresAt).toISOString()})`
        : ")"),
  );

  return accessToken;
}
