import { describe, expect, it } from "vitest";
import type { PantryItem } from "@/lib/pantry-api";
import { changedFields, emptyDraft, toDraft, toNewItem } from "./draft";

const item: PantryItem = {
  id: "1",
  ingredient: "Parmesan",
  quantity: 2,
  unit: "wedge",
  expirationDate: "2026-11-15",
  createdAt: 0,
  lowStock: false,
  category: "dairy_eggs",
};

describe("toDraft", () => {
  it("shows missing values as empty fields", () => {
    expect(
      toDraft({ ...item, quantity: null, unit: null, expirationDate: null }),
    ).toEqual({
      ingredient: "Parmesan",
      quantity: "",
      unit: "",
      expirationDate: "",
      category: "dairy_eggs",
    });
  });
});

describe("toNewItem", () => {
  it("trims text and leaves out empty optional fields", () => {
    expect(toNewItem({ ...emptyDraft, ingredient: "  Rice  " })).toEqual({
      ingredient: "Rice",
      category: "other",
    });
  });

  it("converts the quantity to a number", () => {
    expect(
      toNewItem({ ...emptyDraft, ingredient: "Rice", quantity: "1.5", unit: "lb " }),
    ).toMatchObject({ quantity: 1.5, unit: "lb" });
  });
});

describe("changedFields", () => {
  it("is empty when nothing changed, ignoring surrounding space", () => {
    expect(
      changedFields(item, { ...toDraft(item), ingredient: " Parmesan " }),
    ).toEqual({});
  });

  it("includes only the fields that changed", () => {
    expect(
      changedFields(item, { ...toDraft(item), quantity: "3", category: "other" }),
    ).toEqual({ quantity: 3, category: "other" });
  });

  it("sends null for fields that were emptied", () => {
    expect(
      changedFields(item, {
        ...toDraft(item),
        quantity: "",
        unit: " ",
        expirationDate: "",
      }),
    ).toEqual({ quantity: null, unit: null, expirationDate: null });
  });
});
