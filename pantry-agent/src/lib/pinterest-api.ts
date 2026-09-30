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

const PAGE_SIZE = 250; // Pinterest's maximum (default is 25)
const MAX_PAGES = 40; // safety stop: 10,000 items

// GET every page of a Pinterest v5 list endpoint by following `bookmark`.
// Throws if any page fails, so callers never cache a partial list.
export async function pinterestGetAll<T = any>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T[]> {
  const items: T[] = [];
  let bookmark: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data: { items: T[]; bookmark?: string | null } = await pinterestGet(
      path,
      { ...params, page_size: PAGE_SIZE, ...(bookmark ? { bookmark } : {}) },
    );
    items.push(...data.items);
    bookmark = data.bookmark || null;
    if (!bookmark) return items;
  }

  console.warn(
    `[pinterest-api] GET ${path} stopped after ${MAX_PAGES} pages (${items.length} items); the rest were skipped`,
  );
  return items;
}
