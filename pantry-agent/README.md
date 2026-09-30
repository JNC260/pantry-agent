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
npm run dev             # agent server + Mastra Studio at localhost:4111
npm run build           # production build -> .mastra/output
npm run start           # run the production build
npm test                # Vitest unit tests
npm run typecheck
npm run auth:pinterest  # one-time Pinterest OAuth; saves a refresh token to .env
```

Pure logic lives in `src/lib` next to its tests (`*.test.ts`): Pinterest
requests and token refresh, the recipe-board list, and the grocery prompt.
Tools in `src/mastra/tools` wire that logic to Mastra and the agents.

## Environment variables

See [`.env.example`](./.env.example) for every variable and what it's for.
Missing ones are listed in the log at startup. Two things worth knowing:

- Pinterest's client ID and secret are needed on **every** token refresh, not
  just when generating the refresh token.
- Pinterest rotates the refresh token on each use, so after the first run the
  current one lives in the cache database (`pinterest_oauth` table), not in
  `.env`. Changing `PINTEREST_REFRESH_TOKEN` (e.g. after re-running
  `auth:pinterest`) starts a fresh chain.

In production this server is never exposed publicly: `api/` reaches it over
`localhost` inside the same container. See the root README for why.
