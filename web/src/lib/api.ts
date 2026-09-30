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
