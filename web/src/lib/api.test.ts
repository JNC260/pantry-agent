import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchJson } from "./api";
import { CHAT_HISTORY_KEY, TOKEN_KEY } from "./storage-keys";

// Just enough of the browser for authedFetch: localStorage and location.
function stubBrowser(saved: Record<string, string>) {
  const storage = new Map(Object.entries(saved));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  const location = { href: "/pantry" };
  vi.stubGlobal("window", { location });
  return { storage, location };
}

function stubFetch(status: number, body: unknown = {}) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
  });

  it("sends the saved token and returns the parsed body", async () => {
    stubBrowser({ [TOKEN_KEY]: "jwt" });
    const fetch = stubFetch(200, [{ id: "1" }]);

    await expect(fetchJson("/pantry")).resolves.toEqual([{ id: "1" }]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://api.test/pantry");
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt" });
  });

  it("throws ApiError with the status on any other failure", async () => {
    stubBrowser({ [TOKEN_KEY]: "jwt" });
    stubFetch(502, { message: "Bad Gateway" });

    const error = await fetchJson("/chat", { method: "POST" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      message: "POST /chat failed with 502",
    });
  });

  it("on a 401, signs out and sends the user to /login", async () => {
    const { storage, location } = stubBrowser({
      [TOKEN_KEY]: "expired",
      [CHAT_HISTORY_KEY]: "[]",
    });
    stubFetch(401);

    await expect(fetchJson("/pantry")).rejects.toThrow("Session expired");
    expect(storage.has(TOKEN_KEY)).toBe(false);
    expect(storage.has(CHAT_HISTORY_KEY)).toBe(false);
    expect(location.href).toBe("/login");
  });
});
