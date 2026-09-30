import { CHAT_HISTORY_KEY } from "@/lib/storage-keys";

export async function authedFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem(CHAT_HISTORY_KEY);
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
