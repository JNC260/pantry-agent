import axios from "axios";
import {
  hashToken,
  loadPinterestTokens,
  savePinterestTokens,
} from "./pinterest-token-store";

let cachedToken: string | null = null;
let expiresAt = 0; // epoch ms

// refresh a bit early (60s buffer) to avoid edge-case races
const EARLY_REFRESH_MS = 60_000;

function isValid(token: string | null, expiry: number, now: number): token is string {
  return !!token && now < expiry - EARLY_REFRESH_MS;
}

export async function getValidPinterestToken(): Promise<string> {
  const now = Date.now();

  if (isValid(cachedToken, expiresAt, now)) {
    return cachedToken;
  }

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
    console.log("[pinterest-auth] PINTEREST_REFRESH_TOKEN changed; starting from the env token");
  }

  // Reuse an access token another process (or a previous run) already got.
  if (current && isValid(current.accessToken, current.accessTokenExpiresAt, now)) {
    cachedToken = current.accessToken;
    expiresAt = current.accessTokenExpiresAt;
    return cachedToken;
  }

  const refreshToken = current?.refreshToken ?? envRefreshToken;

  let data: any;
  try {
    const response = await axios.post(
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
  } catch (err: any) {
    console.error(
      "[pinterest-auth] token refresh failed:",
      err.response?.status,
      err.response?.data ?? err.message,
    );
    throw err;
  }

  // Pinterest returns expires_in (seconds)
  const newExpiresAt = now + data.expires_in * 1000;
  // Pinterest rotates the refresh token on every refresh; keep the old one
  // only if a response ever omits it.
  const newRefreshToken: string = data.refresh_token ?? refreshToken;
  const refreshTokenExpiresAt =
    data.refresh_token_expires_in != null
      ? now + data.refresh_token_expires_in * 1000
      : data.refresh_token_expires_at != null
        ? data.refresh_token_expires_at * 1000
        : (current?.refreshTokenExpiresAt ?? null);

  cachedToken = data.access_token;
  expiresAt = newExpiresAt;

  try {
    await savePinterestTokens({
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt,
      accessToken: cachedToken,
      accessTokenExpiresAt: newExpiresAt,
      seedHash,
    });
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

  return cachedToken ?? "";
}
