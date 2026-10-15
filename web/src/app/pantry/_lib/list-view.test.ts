import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PantryItem } from "@/lib/pantry-api";
import {
  filterItems,
  groupByCategory,
  matchesStatus,
  sortItems,
} from "./list-view";

let nextId = 0;
const item = (overrides: Partial<PantryItem>): PantryItem => ({
  id: String(nextId++),
  ingredient: "Item",
  quantity: null,
  unit: null,
  expirationDate: null,
  createdAt: 0,
  lowStock: false,
  category: "other",
  ...overrides,
});

const names = (items: PantryItem[]) => items.map((i) => i.ingredient);

describe("sortItems", () => {
  const items = [
    item({ ingredient: "Rice", quantity: 2, category: "grains_pasta" }),
    item({ ingredient: "Apples", quantity: null, category: "produce" }),
    item({ ingredient: "Milk", quantity: 1, category: "dairy_eggs" }),
    item({ ingredient: "Kale", quantity: 5, category: "produce" }),
  ];

  it("sorts by name either way", () => {
    expect(names(sortItems(items, { key: "ingredient", dir: "asc" }))).toEqual([
      "Apples",
      "Kale",
      "Milk",
      "Rice",
    ]);
    expect(names(sortItems(items, { key: "ingredient", dir: "desc" }))).toEqual([
      "Rice",
      "Milk",
      "Kale",
      "Apples",
    ]);
  });

  it("keeps items with no quantity last in both directions", () => {
    expect(names(sortItems(items, { key: "quantity", dir: "asc" }))).toEqual([
      "Milk",
      "Rice",
      "Kale",
      "Apples",
    ]);
    expect(names(sortItems(items, { key: "quantity", dir: "desc" }))).toEqual([
      "Kale",
      "Rice",
      "Milk",
      "Apples",
    ]);
  });

  it("breaks ties by name", () => {
    const tied = [
      item({ ingredient: "Oats", quantity: 1 }),
      item({ ingredient: "Flour", quantity: 1 }),
    ];
    expect(names(sortItems(tied, { key: "quantity", dir: "desc" }))).toEqual([
      "Flour",
      "Oats",
    ]);
  });

  it("doesn't reorder the array it was given", () => {
    const before = names(items);
    sortItems(items, { key: "ingredient", dir: "desc" });
    expect(names(items)).toEqual(before);
  });
});

describe("filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 12)); // Sep 30, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const items = [
    item({ ingredient: "Kale", category: "produce", expirationDate: "2026-10-01" }),
    item({ ingredient: "Milk", category: "dairy_eggs", expirationDate: "2026-09-25" }),
    item({ ingredient: "Rice", category: "grains_pasta", lowStock: true }),
    item({ ingredient: "Parmesan", category: "dairy_eggs", expirationDate: "2026-12-01" }),
  ];

  it("matches the status filter", () => {
    expect(names(items.filter((i) => matchesStatus(i, "low")))).toEqual(["Rice"]);
    expect(names(items.filter((i) => matchesStatus(i, "expiring")))).toEqual([
      "Kale",
      "Milk",
    ]);
    expect(items.every((i) => matchesStatus(i, "all"))).toBe(true);
  });

  it("searches names case-insensitively, ignoring surrounding space", () => {
    expect(
      names(filterItems(items, { query: " KA ", status: "all" })),
    ).toEqual(["Kale"]);
  });

  it("combines search and status", () => {
    expect(
      names(filterItems(items, { query: "i", status: "expiring" })),
    ).toEqual(["Milk"]);
  });
});

describe("groupByCategory", () => {
  it("groups in category order, keeps item order, and skips empty categories", () => {
    const groups = groupByCategory([
      item({ ingredient: "Rice", category: "grains_pasta" }),
      item({ ingredient: "Kale", category: "produce" }),
      item({ ingredient: "Apples", category: "produce" }),
    ]);
    expect(
      groups.map((g) => [g.category, names(g.items)]),
    ).toEqual([
      ["produce", ["Kale", "Apples"]],
      ["grains_pasta", ["Rice"]],
    ]);
  });
});
