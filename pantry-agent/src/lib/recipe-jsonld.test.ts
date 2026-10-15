import { describe, expect, it } from "vitest";
import { parseRecipeJsonLd } from "./recipe-jsonld";

const page = (...blocks: string[]) =>
  `<html><head>${blocks
    .map((b) => `<script type="application/ld+json">${b}</script>`)
    .join("")}</head><body></body></html>`;

describe("parseRecipeJsonLd", () => {
  it("reads a top-level Recipe", () => {
    const html = page(
      JSON.stringify({
        "@type": "Recipe",
        name: "Chicken &amp; Cr&#232;me Sauce",
        recipeIngredient: ["2 chicken thighs", "1/2 cup cr&#232;me fra&#xEE;che"],
      }),
    );
    expect(parseRecipeJsonLd(html)).toEqual({
      title: "Chicken & Crème Sauce",
      ingredients: ["2 chicken thighs", "1/2 cup crème fraîche"],
    });
  });

  it("finds a Recipe in an @graph, skipping broken and unrelated blocks", () => {
    const html = page(
      "{not json",
      JSON.stringify({ "@type": "WebSite", name: "Blog" }),
      JSON.stringify({
        "@graph": [
          { "@type": "WebPage" },
          {
            "@type": ["Recipe", "NewsArticle"],
            name: "Pasta",
            recipeIngredient: ["<b>1 lb</b> pasta", "  ", 3],
          },
        ],
      }),
    );
    expect(parseRecipeJsonLd(html)).toEqual({
      title: "Pasta",
      ingredients: ["1 lb pasta"],
    });
  });

  it("returns null without recipe ingredients", () => {
    expect(parseRecipeJsonLd(page(JSON.stringify({ "@type": "Recipe" })))).toBeNull();
    expect(parseRecipeJsonLd("<html></html>")).toBeNull();
  });
});
