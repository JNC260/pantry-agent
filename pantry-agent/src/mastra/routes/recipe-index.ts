import { registerApiRoute } from "@mastra/core/server";
import { z } from "zod";
import { getAllCachedPinsLightweight } from "../../lib/pinterest-cache";
import { refreshRecipeBoards } from "../../lib/pinterest-refresh";
import { getRecipeIndex, setRecipeAccepted } from "../../lib/recipe-index";
import { findBlockedSites } from "../../lib/blocked-sites";
import { buildRecipeIndexReport } from "../../lib/recipe-index-report";

const acceptBody = z.object({
  url: z.string().min(1),
  accepted: z.boolean(),
});

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

/**
 * POST /recipe-index/accept { url, accepted }: marks an unreadable recipe
 * link "looks fine" (accepted: true) or takes the mark off, then returns
 * the report. A marked link leaves the unreadable list, isn't read again,
 * and is recommended by title, board, and description (see recipe-index.ts).
 * 400 for a bad body; 404 if the link isn't one the index gave up on.
 */
export const recipeIndexAcceptRoute = registerApiRoute("/recipe-index/accept", {
  method: "POST",
  handler: async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = acceptBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Expected { url: string, accepted: boolean }" }, 400);
    }
    const { url, accepted } = parsed.data;
    if (!(await setRecipeAccepted(url, accepted))) {
      return c.json({ error: "No unreadable recipe with that link" }, 404);
    }
    return c.json(await currentReport());
  },
});
