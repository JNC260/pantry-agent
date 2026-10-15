import { describe, expect, it } from "vitest";
import { ingredientWords, lineMentions, matchRecipes } from "./ingredient-match";

describe("ingredientWords", () => {
  it("drops accents, case, punctuation, and plurals", () => {
    expect(ingredientWords("1/2 cup Crème Fraîche")).toEqual([
      "cup",
      "creme",
      "fraiche",
    ]);
    expect(ingredientWords("tomatoes, berries, eggs, swiss")).toEqual([
      "tomato",
      "berry",
      "egg",
      "swiss",
    ]);
  });
});

describe("lineMentions", () => {
  it.each([
    ["creme fraiche", "1/2 cup crème fraîche"],
    ["Chicken thighs", "4 boneless skinless chicken thighs"],
    ["Shredded mozzarella", "8 oz mozzarella cheese"],
    ["egg", "2 large eggs, beaten"],
  ])("finds %s in %s", (name, line) => {
    expect(lineMentions(name, line)).toBe(true);
  });

  it.each([
    ["egg", "1 eggplant"],
    ["olive oil", "2 tbsp vegetable oil"],
    ["dinner", "1 lb pasta"],
    ["", "1 lb pasta"],
  ])("doesn't find %s in %s", (name, line) => {
    expect(lineMentions(name, line)).toBe(false);
  });
});

describe("matchRecipes", () => {
  const recipes = [
    { id: "a", ingredients: ["1 lb pasta", "1 cup crème fraîche"] },
    { id: "b", ingredients: ["2 chicken thighs", "1/2 cup creme fraiche"] },
    { id: "c", ingredients: ["4 eggs"] },
  ];

  it("ranks recipes by how many of the ingredients they use", () => {
    const matches = matchRecipes(
      ["crème fraîche", "chicken", "dinner"],
      recipes,
    );
    expect(matches.map((m) => [m.recipe.id, m.matched])).toEqual([
      ["b", ["crème fraîche", "chicken"]],
      ["a", ["crème fraîche"]],
    ]);
  });
});
