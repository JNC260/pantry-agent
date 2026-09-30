import { pinterestGet } from "./pinterest-api";
import { loadPinterestTokens } from "./pinterest-token-store";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type PinterestHealth =
  | { ok: true; refreshTokenExpiresAt: string | null }
  | { ok: false; error: string };

// Makes a real (cheap) Pinterest call, refreshing the access token first if
// it's due. Tools serve cached data for up to a week, so without this a dead
// token only shows up when the cache happens to miss.
export async function checkPinterestConnection(): Promise<PinterestHealth> {
  try {
    await pinterestGet("/boards", { page_size: 1 });
    const stored = await loadPinterestTokens();
    return {
      ok: true,
      refreshTokenExpiresAt: stored?.refreshTokenExpiresAt
        ? new Date(stored.refreshTokenExpiresAt).toISOString()
        : null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runCheck() {
  const health = await checkPinterestConnection();
  if (health.ok) {
    console.log(
      `[pinterest-health] Pinterest connection OK (refresh token expires ${health.refreshTokenExpiresAt ?? "unknown"})`,
    );
  } else {
    console.error(
      `[pinterest-health] Pinterest connection is BROKEN: ${health.error}. ` +
        "If refreshing keeps failing, run `npm run auth:pinterest -w pantry-agent` and update PINTEREST_REFRESH_TOKEN.",
    );
  }
}

// Checks at startup, then daily. The daily check also keeps the token chain
// alive: the refresh token expires after 60 days unused, and the access token
// (30 days) is refreshed here even if nobody chats.
export function startPinterestHealthChecks() {
  // guard against duplicate timers when `mastra dev` reloads this module
  const g = globalThis as { __pinterestHealthTimer?: NodeJS.Timeout };
  if (g.__pinterestHealthTimer) return;

  void runCheck();
  g.__pinterestHealthTimer = setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
  g.__pinterestHealthTimer.unref();
}
