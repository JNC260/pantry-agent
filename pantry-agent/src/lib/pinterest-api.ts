import axios from "axios";
import {
  getValidPinterestToken,
  invalidatePinterestToken,
} from "./pinterest-auth";

const BASE_URL = "https://api.pinterest.com/v5";
const RETRY_DELAY_MS = 1_000;

// The fields this app reads from Pinterest's board and pin objects.
export type PinterestBoard = { id: string; name: string };
export type PinterestPin = {
  id: string;
  title?: string | null;
  link?: string | null; // the URL back to the original recipe site
};

function statusOf(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response) {
      return `${err.response.status} ${JSON.stringify(err.response.data)}`;
    }
    return err.code ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

// Worth one more try: server errors and network failures with no response.
function isTransient(err: unknown): boolean {
  return !axios.isAxiosError(err) || !err.response || err.response.status >= 500;
}

type RequestResult<T> = { data: T } | { error: unknown };

// One GET with a valid token. Request failures come back as a value so the
// caller can decide whether to retry; token refresh failures throw as-is
// (pinterest-auth already logged them, and retrying won't help).
async function requestOnce<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<RequestResult<T>> {
  const token = await getValidPinterestToken();
  try {
    const response = await axios.get<T>(`${BASE_URL}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return { data: response.data };
  } catch (error) {
    if (statusOf(error) === 401) await invalidatePinterestToken(token);
    return { error };
  }
}

// GET a Pinterest v5 endpoint. Retries once if Pinterest rejects the access
// token (401: fetch a fresh one) or the failure looks transient.
export async function pinterestGet<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const first = await requestOnce<T>(path, params);
  if ("data" in first) return first.data;

  const unauthorized = statusOf(first.error) === 401;
  const retryable = unauthorized || isTransient(first.error);
  console.error(
    `[pinterest-api] GET ${path} failed: ${describeError(first.error)}${retryable ? "; retrying once" : ""}`,
  );
  if (!retryable) {
    throw new Error(`Pinterest API error: ${describeError(first.error)}`);
  }

  // A 401 retries right away with the fresh token; anything else backs off.
  if (!unauthorized) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  const second = await requestOnce<T>(path, params);
  if ("data" in second) return second.data;

  console.error(
    `[pinterest-api] GET ${path} failed again: ${describeError(second.error)}`,
  );
  throw new Error(`Pinterest API error: ${describeError(second.error)}`);
}

const PAGE_SIZE = 250; // Pinterest's maximum (default is 25)
const MAX_PAGES = 40; // safety stop: 10,000 items

// GET every page of a Pinterest v5 list endpoint by following `bookmark`.
// Throws if any page fails, so callers never cache a partial list.
export async function pinterestGetAll<T>(
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
