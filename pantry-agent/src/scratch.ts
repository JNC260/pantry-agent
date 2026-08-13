import { scoredSearchByIngredients } from "./mastra/scorers/scoreByIngredient";

async function main() {
  const results = await scoredSearchByIngredients(["steak", "sesame"]);
  console.log(results);
}

main();
