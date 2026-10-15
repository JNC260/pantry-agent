/**
 * Fills the recipe index from the command line (the first backfill, or a
 * retry of failed links). Writes to the shared cache database, so it
 * indexes production's pins too.
 *
 *   npm run index:recipes -w pantry-agent -- --limit 50
 *   npm run index:recipes -w pantry-agent -- --limit 50 --retry-failed
 *   npm run index:recipes -w pantry-agent -- --status
 */
import { parseArgs } from "node:util";
import { getAllCachedPinsLightweight } from "../lib/pinterest-cache";
import { getRecipeIndex } from "../lib/recipe-index";
import { buildRecipeIndexReport } from "../lib/recipe-index-report";
import { indexPendingRecipes } from "../mastra/recipe-indexer";

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "50" },
    "retry-failed": { type: "boolean", default: false },
    status: { type: "boolean", default: false },
  },
});

async function printStatus() {
  const [pins, index] = await Promise.all([
    getAllCachedPinsLightweight(),
    getRecipeIndex(),
  ]);
  console.log(buildRecipeIndexReport(pins, index).counts);
}

if (values.status) {
  await printStatus();
} else {
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit <= 0) {
    console.error("--limit must be a positive whole number");
    process.exit(1);
  }
  const summary = await indexPendingRecipes({
    limit,
    retryFailed: values["retry-failed"],
    log: console.log,
  });
  console.log(summary);
  await printStatus();
}
