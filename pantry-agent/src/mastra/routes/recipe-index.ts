import { registerApiRoute } from "@mastra/core/server";
import { getAllCachedPinsLightweight } from "../../lib/pinterest-cache";
import { getRecipeIndex } from "../../lib/recipe-index";
import { buildRecipeIndexReport } from "../../lib/recipe-index-report";

/**
 * GET /recipe-index/report: how far the recipe index has got, and the
 * recipe pins it couldn't read, for the web app's Pins page (relayed by the
 * api's GET /recipe-index/report).
 */
export const recipeIndexReportRoute = registerApiRoute("/recipe-index/report", {
  method: "GET",
  handler: async (c) => {
    const [pins, index] = await Promise.all([
      getAllCachedPinsLightweight(),
      getRecipeIndex(),
    ]);
    return c.json(buildRecipeIndexReport(pins, index));
  },
});
