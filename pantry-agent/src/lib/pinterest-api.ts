import axios from "axios";
import {
  getValidPinterestToken,
  invalidatePinterestToken,
} from "./pinterest-auth";

const BASE_URL = "https://api.pinterest.com/v5";
const RETRY_DELAY_MS = 1_000;

function describe(err: any): string {
  if (err.response) {
    return `${err.response.status} ${JSON.stringify(err.response.data)}`;
  }
  return err.code ?? err.message;
}

// Worth one more try: server errors and network failures with no response.
function isTransient(err: any): boolean {
  return !err.response || err.response.status >= 500;
}

// GET a Pinterest v5 endpoint. Retries once if Pinterest rejects the access
// token (401: fetch a fresh one) or the failure looks transient.
export async function pinterestGet<T = any>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  async function attempt() {
    // Refresh failures propagate as-is; pinterest-auth already logged them.
    const token = await getValidPinterestToken();
    try {
      const response = await axios.get(`${BASE_URL}${path}`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data as T;
    } catch (err: any) {
      if (err.response?.status === 401) await invalidatePinterestToken(token);
      err.fromRequest = true;
      throw err;
    }
  }

  try {
    return await attempt();
  } catch (err: any) {
    if (!err.fromRequest) throw err;
    const retryable = err.response?.status === 401 || isTransient(err);
    console.error(
      `[pinterest-api] GET ${path} failed: ${describe(err)}${retryable ? "; retrying once" : ""}`,
    );
    if (!retryable) throw new Error(`Pinterest API error: ${describe(err)}`);

    if (err.response?.status !== 401) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    try {
      return await attempt();
    } catch (retryErr: any) {
      if (!retryErr.fromRequest) throw retryErr;
      console.error(`[pinterest-api] GET ${path} failed again: ${describe(retryErr)}`);
      throw new Error(`Pinterest API error: ${describe(retryErr)}`);
    }
  }
}
