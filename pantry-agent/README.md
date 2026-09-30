# pantry-agent

The Mastra application: the agent, its tools, and a few small single-purpose sub-agents. See the [root README](../README.md) for the full project overview and architecture.

## What's here

**Main agent:** `pantryAgent` — orchestrates everything below based on the conversation.

**Tools:**

- `getBoardsTool` / `getPinsFromBoardTool` — Pinterest boards/pins, cached locally (see `src/lib/pinterest-cache.ts`) with a freshness window and self-healing refetch on a cache miss
- `searchPinsTool` — keyword search over cached pins
- `recommendRecipesTool` — the ingredient/style-based recommendation pipeline (candidate selection → extraction → presentation)
- `extractRecipeTool` — turns a recipe webpage into structured data
- `generateGroceryListTool` — diffs a chosen recipe against pantry data (quantity, low-stock, expiration aware)
- `webSearchTool` — Tavily web search, used as a fallback when nothing in saved pins fits

**Sub-agents** (each with one narrow job, given structured output to return):

- `recipeExtractionAgent` — parses raw recipe-page content into structured fields
- `pinSelectionAgent` — judges which cached pins are worth extracting, given the user's request and a lightweight title/board list
- `groceryMatchAgent` — compares a recipe's ingredients against pantry contents, with real judgment for equivalence ("chicken stock" covers "chicken broth") and rough quantity sufficiency

## Running it

```bash
npm install
npm run dev    # Studio + local API at localhost:4111
npm run build  # production build → .mastra/output
npm run start  # run the production build
```

## Environment variables

```
ANTHROPIC_API_KEY=
TAVILY_API_KEY=

# Pinterest (the running app only needs the refresh token; client
# id/secret/redirect URI are only needed once, to generate it — see
# src/lib/pinterest-auth-flow.ts)
PINTEREST_REFRESH_TOKEN=

# Turso — Pinterest cache. Unset both and it falls back to a local
# file (pinterest-cache.db) for dev.
PINTEREST_CACHE_DB_URL=
PINTEREST_CACHE_DB_AUTH_TOKEN=

# Turso — pantry data (read-only from this side; api/ owns writes)
PANTRY_DB_URL=
PANTRY_DB_AUTH_TOKEN=

# Turso — Mastra's own internal storage (observability, etc.).
# Unset and it falls back to a local file (mastra.db).
MASTRA_DB_URL=
MASTRA_DB_AUTH_TOKEN=
```

In production this server is never exposed publicly — `api/` reaches it over an internal `localhost` connection inside the same container. See the root README for why.
