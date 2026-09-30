import { CHAT_HISTORY_KEY, TOKEN_KEY } from "@/lib/storage-keys";

export async function authedFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    // A full page load rather than router.push: this runs outside React (no
    // router here), and it drops any in-memory state from the old session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  return res;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// authedFetch plus the JSON body, throwing on any non-2xx response so an
// error body is never mistaken for data.
export async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await authedFetch(path, options);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `${options.method ?? "GET"} ${path} failed with ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}
