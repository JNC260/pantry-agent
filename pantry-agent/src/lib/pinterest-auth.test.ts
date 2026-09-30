import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPinterestTokens } from "./pinterest-token-store";

// Created once so they survive vi.resetModules() below.
const store = vi.hoisted(() => ({
  loadPinterestTokens: vi.fn(),
  savePinterestTokens: vi.fn(),
  expireStoredAccessToken: vi.fn(),
  hashToken: (token: string) => `hash:${token}`,
}));
vi.mock("./pinterest-token-store", () => store);

const HOUR_MS = 3_600_000;

// pinterest-auth keeps the current token in module state, so each test
// imports a fresh copy.
async function loadAuth() {
  vi.resetModules();
  return import("./pinterest-auth");
}

function tokenResponse(accessToken: string, refreshToken = "rotated") {
  return {
    data: {
      access_token: accessToken,
      expires_in: 3600,
      refresh_token: refreshToken,
    },
  };
}

function stored(overrides: Partial<StoredPinterestTokens>): StoredPinterestTokens {
  return {
    refreshToken: "stored-refresh",
    refreshTokenExpiresAt: null,
    accessToken: "stored-access",
    accessTokenExpiresAt: Date.now() + HOUR_MS,
    seedHash: "hash:env-refresh",
    ...overrides,
  };
}

const sentRefreshToken = (post: ReturnType<typeof vi.spyOn>, call = 0) =>
  (post.mock.calls[call][1] as URLSearchParams).get("refresh_token");

describe("getValidPinterestToken", () => {
  beforeEach(() => {
    vi.stubEnv("PINTEREST_REFRESH_TOKEN", "env-refresh");
    vi.stubEnv("PINTEREST_CLIENT_ID", "id");
    vi.stubEnv("PINTEREST_CLIENT_SECRET", "secret");
    store.loadPinterestTokens.mockResolvedValue(null);
    store.savePinterestTokens.mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shares one refresh between concurrent callers", async () => {
    const { getValidPinterestToken } = await loadAuth();
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("A"));

    const tokens = await Promise.all([
      getValidPinterestToken(),
      getValidPinterestToken(),
      getValidPinterestToken(),
    ]);

    expect(tokens).toEqual(["A", "A", "A"]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(sentRefreshToken(post)).toBe("env-refresh");
    // Saved with the rotated refresh token, guarded by the one it spent.
    expect(store.savePinterestTokens).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "rotated", accessToken: "A" }),
      "env-refresh",
    );
  });

  it("keeps using the token in memory until it expires", async () => {
    const { getValidPinterestToken } = await loadAuth();
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("A"));

    await getValidPinterestToken();
    await getValidPinterestToken();

    expect(post).toHaveBeenCalledTimes(1);
    expect(store.loadPinterestTokens).toHaveBeenCalledTimes(1);
  });

  it("reuses a valid stored access token without refreshing", async () => {
    store.loadPinterestTokens.mockResolvedValue(stored({}));
    const { getValidPinterestToken } = await loadAuth();
    const post = vi.spyOn(axios, "post");

    await expect(getValidPinterestToken()).resolves.toBe("stored-access");
    expect(post).not.toHaveBeenCalled();
  });

  it("refreshes with the stored (rotated) refresh token once access expires", async () => {
    store.loadPinterestTokens.mockResolvedValue(
      stored({ accessTokenExpiresAt: Date.now() - 1 }),
    );
    const { getValidPinterestToken } = await loadAuth();
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("B"));

    await expect(getValidPinterestToken()).resolves.toBe("B");
    expect(sentRefreshToken(post)).toBe("stored-refresh");
  });

  it("ignores a stored chain that started from a different env token", async () => {
    store.loadPinterestTokens.mockResolvedValue(
      stored({ seedHash: "hash:older-env-token" }),
    );
    const { getValidPinterestToken } = await loadAuth();
    const post = vi.spyOn(axios, "post").mockResolvedValue(tokenResponse("C"));

    await expect(getValidPinterestToken()).resolves.toBe("C");
    expect(sentRefreshToken(post)).toBe("env-refresh");
  });

  it("uses another process's token when it won the refresh race", async () => {
    store.loadPinterestTokens
      .mockResolvedValueOnce(stored({ accessTokenExpiresAt: 0 }))
      .mockResolvedValueOnce(
        stored({ refreshToken: "their-refresh", accessToken: "theirs" }),
      );
    const { getValidPinterestToken } = await loadAuth();
    vi.spyOn(axios, "post").mockRejectedValue(new Error("invalid_grant"));

    await expect(getValidPinterestToken()).resolves.toBe("theirs");
  });

  it("refreshes again after the token is invalidated", async () => {
    const { getValidPinterestToken, invalidatePinterestToken } =
      await loadAuth();
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce(tokenResponse("A"))
      .mockResolvedValueOnce(tokenResponse("B"));

    await getValidPinterestToken();
    await invalidatePinterestToken("A");

    await expect(getValidPinterestToken()).resolves.toBe("B");
    expect(store.expireStoredAccessToken).toHaveBeenCalledWith("A");
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("fails when Pinterest returns no access token", async () => {
    const { getValidPinterestToken } = await loadAuth();
    vi.spyOn(axios, "post").mockResolvedValue({ data: { expires_in: 3600 } });

    await expect(getValidPinterestToken()).rejects.toThrow(
      "returned no access_token",
    );
  });

  it("fails clearly without PINTEREST_REFRESH_TOKEN", async () => {
    vi.stubEnv("PINTEREST_REFRESH_TOKEN", "");
    const { getValidPinterestToken } = await loadAuth();

    await expect(getValidPinterestToken()).rejects.toThrow(
      "PINTEREST_REFRESH_TOKEN is not set",
    );
  });
});
