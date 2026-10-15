import { describe, expect, it } from "vitest";
import { findBlockedSites, isOnBlockedSite, siteOf } from "./blocked-sites";
import type { RecipeIndexEntry } from "./recipe-index-entry";

const ok = (url: string): RecipeIndexEntry => ({
  url,
  status: "ok",
  title: null,
  ingredients: ["salt"],
  source: "jsonld",
});

const failed = (
  url: string,
  reason: "unreadable" | "dead-link" = "unreadable",
  status: "failed" | "retry" = "failed",
): RecipeIndexEntry => ({ url, status, reason, error: "nope", attempts: 1 });

describe("siteOf", () => {
  it("drops the scheme, www, and case", () => {
    expect(siteOf("http://WWW.HalfBakedHarvest.com/waffles/")).toBe(
      "halfbakedharvest.com",
    );
    expect(siteOf("https://cmx.weightwatchers.com/x")).toBe(
      "cmx.weightwatchers.com",
    );
  });

  it("returns null for a link that won't parse", () => {
    expect(siteOf("not a url")).toBeNull();
  });
});

describe("findBlockedSites", () => {
  it("blocks a site with enough unreadable links and none read", () => {
    const blocked = findBlockedSites([
      failed("https://www.halfbakedharvest.com/a"),
      failed("http://halfbakedharvest.com/b"),
      failed("https://www.halfbakedharvest.com/c"),
    ]);
    expect([...blocked]).toEqual(["halfbakedharvest.com"]);
  });

  it("doesn't block a site with fewer unreadable links", () => {
    expect(
      findBlockedSites([failed("https://a.com/1"), failed("https://a.com/2")]).size,
    ).toBe(0);
  });

  it("doesn't block a site once any of its links was read", () => {
    expect(
      findBlockedSites([
        failed("https://a.com/1"),
        failed("https://a.com/2"),
        failed("https://a.com/3"),
        ok("https://www.a.com/4"),
      ]).size,
    ).toBe(0);
  });

  it("counts only links given up on as unreadable", () => {
    expect(
      findBlockedSites([
        failed("https://a.com/1"),
        failed("https://a.com/2"),
        failed("https://a.com/3", "dead-link"),
        failed("https://a.com/4", "unreadable", "retry"),
        failed("bad link"),
      ]).size,
    ).toBe(0);
  });
});

describe("isOnBlockedSite", () => {
  it("matches any link on a blocked site", () => {
    const blocked = new Set(["halfbakedharvest.com"]);
    expect(isOnBlockedSite("http://www.halfbakedharvest.com/x", blocked)).toBe(true);
    expect(isOnBlockedSite("https://example.com/x", blocked)).toBe(false);
    expect(isOnBlockedSite("garbage", blocked)).toBe(false);
  });
});
