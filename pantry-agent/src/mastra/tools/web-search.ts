import { createTavilySearchTool } from "@mastra/tavily";

/**
 * General web search (Tavily). The agent falls back to it when nothing in the
 * user's own pins fits, and says so when it does.
 */
export const webSearchTool = createTavilySearchTool();
