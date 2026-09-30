import axios, { AxiosError, AxiosHeaders } from "axios";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  getValidPinterestToken,
  invalidatePinterestToken,
} from "./pinterest-auth";
import { pinterestGet, pinterestGetAll } from "./pinterest-api";

vi.mock("./pinterest-auth", () => ({
  getValidPinterestToken: vi.fn(),
  invalidatePinterestToken: vi.fn(),
}));

function httpError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    {
      status,
      statusText: "",
      data: { message: "nope" },
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );
}

const networkError = () => new AxiosError("socket hang up", "ECONNRESET");

describe("pinterestGet", () => {
  let get: MockInstance<typeof axios.get>;

  beforeEach(() => {
    vi.mocked(getValidPinterestToken).mockResolvedValue("token-1");
    get = vi.spyOn(axios, "get");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the response body, sending the token and params", async () => {
    get.mockResolvedValueOnce({ data: { items: [] } });

    await expect(pinterestGet("/boards", { page_size: 1 })).resolves.toEqual({
      items: [],
    });
    expect(get).toHaveBeenCalledWith("https://api.pinterest.com/v5/boards", {
      params: { page_size: 1 },
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("on a 401, drops the token and retries at once with a fresh one", async () => {
    vi.mocked(getValidPinterestToken)
      .mockResolvedValueOnce("token-1")
      .mockResolvedValueOnce("token-2");
    get
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce({ data: "ok" });

    await expect(pinterestGet("/boards")).resolves.toBe("ok");
    expect(invalidatePinterestToken).toHaveBeenCalledWith("token-1");
    expect(get.mock.calls[1][1]?.headers).toEqual({
      Authorization: "Bearer token-2",
    });
  });

  it.each([
    ["a server error", () => httpError(503)],
    ["a network failure", networkError],
  ])("retries %s once after a short delay", async (_, makeError) => {
    vi.useFakeTimers();
    get.mockRejectedValueOnce(makeError()).mockResolvedValueOnce({ data: "ok" });

    const result = pinterestGet("/boards");
    await vi.advanceTimersByTimeAsync(999);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("ok");
    expect(get).toHaveBeenCalledTimes(2);
    expect(invalidatePinterestToken).not.toHaveBeenCalled();
  });

  it("doesn't retry a client error", async () => {
    get.mockRejectedValueOnce(httpError(404));

    await expect(pinterestGet("/boards/x/pins")).rejects.toThrow(
      'Pinterest API error: 404 {"message":"nope"}',
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("gives up after the one retry", async () => {
    get.mockRejectedValue(httpError(401));

    await expect(pinterestGet("/boards")).rejects.toThrow(
      "Pinterest API error: 401",
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("lets a token refresh failure through without retrying", async () => {
    vi.mocked(getValidPinterestToken).mockRejectedValueOnce(
      new Error("refresh failed"),
    );

    await expect(pinterestGet("/boards")).rejects.toThrow("refresh failed");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("pinterestGetAll", () => {
  beforeEach(() => {
    vi.mocked(getValidPinterestToken).mockResolvedValue("token-1");
  });

  it("follows bookmarks until the last page", async () => {
    const get = vi
      .spyOn(axios, "get")
      .mockResolvedValueOnce({ data: { items: [1, 2], bookmark: "p2" } })
      .mockResolvedValueOnce({ data: { items: [3], bookmark: null } });

    await expect(pinterestGetAll<number>("/boards")).resolves.toEqual([
      1, 2, 3,
    ]);
    expect(get.mock.calls.map((call) => call[1]?.params)).toEqual([
      { page_size: 250 },
      { page_size: 250, bookmark: "p2" },
    ]);
  });

  it("fails as a whole if a later page fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(axios, "get")
      .mockResolvedValueOnce({ data: { items: [1], bookmark: "p2" } })
      .mockRejectedValueOnce(httpError(404));

    await expect(pinterestGetAll("/boards")).rejects.toThrow("404");
  });
});
