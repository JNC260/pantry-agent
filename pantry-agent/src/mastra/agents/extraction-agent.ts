// src/mastra/agents/recipe-extraction-agent.ts
import { Agent } from "@mastra/core/agent";

export const recipeExtractionAgent = new Agent({
  id: "recipe-extraction-agent",
  name: "Recipe Extraction Agent",
  instructions:
    "You extract structured recipe data from raw recipe-page HTML. Return only the requested structured output. You have no tools available and should never attempt to call one.",
  model: "anthropic/claude-sonnet-4-6",
  // no tools registered — nothing for it to recurse into
});
