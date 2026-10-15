import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, toIndexEntry, type RecipeIndexEntry } from "./recipe-index-entry";

const url = "https://example.com/recipe";

const retrying = (attempts: number): RecipeIndexEntry => ({
  url,
  status: "retry",
  reason: "errors",
  error: "timeout",
  attempts,
});

describe("toIndexEntry", () => {
  it("records a read recipe as ok", () => {
    expect(
      toIndexEntry(
        { url, kind: "ok", title: "Soup", ingredients: ["leeks"], source: "ai" },
        retrying(2),
      ),
    ).toEqual({ url, status: "ok", title: "Soup", ingredients: ["leeks"], source: "ai" });
  });

  it("gives up on a final failure at once, counting the try", () => {
    expect(
      toIndexEntry(
        { url, kind: "failed", reason: "dead-link", error: "gone" },
        undefined,
      ),
    ).toEqual({ url, status: "failed", reason: "dead-link", error: "gone", attempts: 1 });
  });

  it("retries a transient error until it has failed MAX_ATTEMPTS times", () => {
    const transient = { url, kind: "transient" as const, error: "timeout" };
    expect(toIndexEntry(transient, undefined)).toMatchObject({
      status: "retry",
      attempts: 1,
    });
    expect(toIndexEntry(transient, retrying(MAX_ATTEMPTS - 2))).toMatchObject({
      status: "retry",
    });
    expect(toIndexEntry(transient, retrying(MAX_ATTEMPTS - 1))).toEqual({
      url,
      status: "failed",
      reason: "errors",
      error: `Failed ${MAX_ATTEMPTS} times; last error: timeout`,
      attempts: MAX_ATTEMPTS,
    });
  });
});
