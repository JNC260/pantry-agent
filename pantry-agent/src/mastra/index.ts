import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from "@mastra/core/storage";
import { registerApiRoute } from "@mastra/core/server";
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import { pantryAgent } from "./agents/pantry-agent";
import { recipeExtractionAgent } from "./agents/extraction-agent";
import { pinSelectionAgent } from "./agents/pin-selection-agent";
import { groceryMatchAgent } from "./agents/grocery-match-agent";
import { receiptAgent } from "./agents/receipt-agent";
import { pantryUsageAgent } from "./agents/pantry-usage-agent";
import { ingredientListAgent } from "./agents/ingredient-list-agent";
import { parseReceiptRoute, planCookedRoute } from "./routes/pantry-ai";
import { recipeIndexReportRoute } from "./routes/recipe-index";
import {
  checkPinterestConnection,
  startPinterestHealthChecks,
} from "../lib/pinterest-health";
import { checkRequiredEnv } from "../lib/check-env";
import { startRecipeIndexing } from "./recipe-indexer";

checkRequiredEnv();

export const mastra = new Mastra({
  agents: {
    pantryAgent,
    recipeExtractionAgent,
    pinSelectionAgent,
    groceryMatchAgent,
    receiptAgent,
    pantryUsageAgent,
    ingredientListAgent,
  },
  server: {
    // Receipt uploads arrive as base64 (several screenshots or a PDF), well
    // past the 4.5 MB default. The api caps each file before forwarding.
    bodySizeLimit: 20 * 1024 * 1024,
    apiRoutes: [
      parseReceiptRoute,
      planCookedRoute,
      recipeIndexReportRoute,
      registerApiRoute("/health/pinterest", {
        method: "GET",
        // createHandler runs once at server startup, which is where the
        // startup + daily Pinterest checks and recipe indexing are kicked
        // off.
        createHandler: async () => {
          startPinterestHealthChecks();
          startRecipeIndexing();
          return async (c) => {
            const health = await checkPinterestConnection();
            return c.json(health, health.ok ? 200 : 503);
          };
        },
      }),
    ],
  },
  storage: new MastraCompositeStore({
    id: "composite-storage",
    default: new LibSQLStore({
      id: "mastra-storage",
      url: process.env.MASTRA_DB_URL ?? "file:./mastra.db",
      authToken: process.env.MASTRA_DB_AUTH_TOKEN,
    }),
    domains: {
      observability: await new DuckDBStore().getStore("observability"),
    },
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
