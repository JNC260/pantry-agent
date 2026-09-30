import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatDate,
  freshness,
  freshnessLabel,
  parseDate,
} from "./freshness";

// Late evening, so a UTC-based parse of a date would land on the wrong day.
const TODAY = new Date(2026, 8, 30, 22, 30); // Sep 30, 2026, local time

describe("parseDate", () => {
  it("reads YYYY-MM-DD as a local date", () => {
    const date = parseDate("2026-10-01");
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([
      2026, 9, 1,
    ]);
  });

  it("rejects anything else", () => {
    expect(parseDate("10/01/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats a date for display", () => {
    expect(formatDate("2026-10-01")).toBe("Oct 1, 2026");
  });

  it("shows an unparseable value as-is", () => {
    expect(formatDate("someday")).toBe("someday");
  });
});

describe("daysUntil", () => {
  it("counts whole days from today", () => {
    expect(daysUntil("2026-09-30", TODAY)).toBe(0);
    expect(daysUntil("2026-10-03", TODAY)).toBe(3);
    expect(daysUntil("2026-09-29", TODAY)).toBe(-1);
  });

  it("counts across a daylight saving change", () => {
    // US clocks fall back on Nov 1, 2026, so that day is 25 hours long.
    expect(daysUntil("2026-11-02", new Date(2026, 9, 31))).toBe(2);
  });
});

describe("freshness", () => {
  it.each([
    [null, "none"],
    ["2026-09-29", "expired"],
    ["2026-09-30", "soon"],
    ["2026-10-03", "soon"],
    ["2026-10-04", "fresh"],
    ["not a date", "fresh"],
  ] as const)("%s -> %s", (expirationDate, expected) => {
    expect(freshness({ expirationDate }, TODAY)).toBe(expected);
  });
});

describe("freshnessLabel", () => {
  it.each([
    [null, "No date"],
    ["2026-09-29", "Expired Sep 29, 2026"],
    ["2026-10-01", "Use by Oct 1, 2026"],
    ["2026-11-15", "Expires Nov 15, 2026"],
  ] as const)("%s -> %s", (expirationDate, expected) => {
    expect(freshnessLabel({ expirationDate }, TODAY)).toBe(expected);
  });
});
