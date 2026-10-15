import { registerApiRoute } from "@mastra/core/server";
import { getAllCachedPinsLightweight } from "../../lib/pinterest-cache";
import { refreshRecipeBoards } from "../../lib/pinterest-refresh";
import { getRecipeIndex } from "../../lib/recipe-index";
import { findBlockedSites } from "../../lib/blocked-sites";
import { buildRecipeIndexReport } from "../../lib/recipe-index-report";

async function currentReport() {
  const [pins, index] = await Promise.all([
    getAllCachedPinsLightweight(),
    getRecipeIndex(),
  ]);
  return buildRecipeIndexReport(pins, index, findBlockedSites(index.values()));
}

/**
 * GET /recipe-index/report: how far the recipe index has got, and the
 * recipe pins it couldn't read, for the web app's Pins page (relayed by the
 * api's GET /recipe-index/report).
 */
export const recipeIndexReportRoute = registerApiRoute("/recipe-index/report", {
  method: "GET",
  handler: async (c) => c.json(await currentReport()),
});

/**
 * POST /recipe-index/refresh: re-downloads the recipe boards from Pinterest
 * (so pins deleted or edited there drop off the report), then returns the
 * report, plus any boards that couldn't be refreshed. Nothing is re-indexed
 * here; fixed links are read by the next daily run. 502 if Pinterest can't
 * be reached at all.
 */
export const recipeIndexRefreshRoute = registerApiRoute("/recipe-index/refresh", {
  method: "POST",
  handler: async (c) => {
    let refresh;
    try {
      refresh = await refreshRecipeBoards();
    } catch (err) {
      console.error("[recipe-index] refresh failed:", err);
      return c.json({ error: "Couldn't reach Pinterest" }, 502);
    }
    return c.json({ ...(await currentReport()), failedBoards: refresh.failedBoards });
  },
});
