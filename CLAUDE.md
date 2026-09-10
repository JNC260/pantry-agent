# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is an npm workspaces monorepo with three services that talk to each other over HTTP:

- **`pantry-agent/`** — a Mastra agent server (port 4111). Owns all Pinterest API access, recipe extraction, and recommendation logic. Exposes agents via Mastra's generated HTTP API (e.g. `POST /api/agents/pantryAgent/generate`).
- **`api/`** — a NestJS backend (port 3000, default). Thin layer that authenticates the web client (JWT) and proxies chat messages to the Mastra server. Holds no agent logic itself.
- **`web/`** — a Next.js frontend (port 3001). Login page + chat UI, calls `api/` with a bearer token.

Request flow: `web` → (JWT-authed) `api` `/chat` → `pantry-agent` Mastra HTTP API → Pinterest API / web search.

### `pantry-agent` internals

- `src/mastra/index.ts` — the `Mastra` instance; all agents/workflows/scorers must be registered here (see `AGENTS.md` rule below).
- `src/mastra/agents/pantry-agent.ts` — the main user-facing agent. Its instructions encode the actual tool-call protocol (e.g. board names must be resolved to ids via `get-boards` before `get-pins-from-board`; `extract-recipe` URLs must be copied verbatim from a prior tool result, never retyped). Read this file's instructions before changing tool behavior — the agent's correctness depends on tool output shapes matching what the prompt describes.
- `src/mastra/agents/extraction-agent.ts` — a tool-less agent used only for structured extraction from raw HTML.
- `src/mastra/tools/` — one file per tool (`getBoards`, `getPins`, `searchPins`, `extractRecipe`, `recommendRecipes`, `webSearchTool`). `recommendRecipes` is the orchestrator: it searches cached pins, lazily backfills the cache (boards with zero cached pins only — never re-fetches boards that already came back empty), verifies top candidates via `extractRecipe`, and falls back to an empty result (triggering the agent to use web search) rather than guessing.
- `src/lib/pinterest-cache.ts` — libSQL-backed cache (`pinterest-cache.db`) for boards/pins, with a 1-week freshness window (`cache_meta` table). Read paths generally check freshness before hitting Pinterest.
- `src/lib/pinterest-auth.ts` — in-memory Pinterest OAuth token cache/refresh (refresh token flow, 60s early-refresh buffer).
- Storage: `MastraCompositeStore` splits general Mastra storage (LibSQL, `mastra.db`) from observability data (DuckDB).

**Critical:** Before doing any Mastra-specific work (agents, tools, workflows, memory, storage), load the `mastra` skill (`pantry-agent/.agents/skills/mastra/SKILL.md`) first — per `pantry-agent/AGENTS.md`, cached knowledge of Mastra APIs is likely wrong since they change between versions.

### `api` internals

- `auth/` — password login (`POST /auth/login`, bcrypt-compares against `AUTH_PASSWORD` env hash) issuing a JWT; `JwtAuthGuard` protects other routes via `Authorization: Bearer` header.
- `chat/` — `ChatController` (guarded) → `ChatService.sendMessage`, which POSTs to the Mastra server's `pantryAgent` generate endpoint and unwraps `{ text }`. `MASTRA_SERVER_URL` env var controls the target (default `http://localhost:4111`).
- CORS origin is controlled by `WEB_ORIGIN` (default `http://localhost:3001`).

### `web` internals

- App Router pages: `src/app/login/page.tsx`, `src/app/chat/page.tsx`.
- `src/lib/api.ts` — `authedFetch` wraps `fetch` against `NEXT_PUBLIC_API_URL`, attaches the JWT from `localStorage`, and redirects to `/login` on a 401.
- Next.js version in this repo has breaking changes vs. typical training data — see `web/AGENTS.md`, which points to `node_modules/next/dist/docs/` for current API/conventions before writing Next.js code.

## Commands

Run from repo root (or the relevant workspace directory).

### Start everything (production build)
```sh
./start.sh
```
Starts `pantry-agent` (built Mastra output, port 4111) and `api` (built Nest output) together. Run each service's `build` step first (see below) — this script does not build.

### `pantry-agent`
```sh
cd pantry-agent
npm run dev     # mastra dev
npm run build   # mastra build
npm run start   # mastra start (built output)
```
No test suite currently configured.

### `api`
```sh
cd api
npm run start:dev     # nest start --watch
npm run build          # nest build
npm run lint            # eslint --fix
npm run test             # jest (unit, *.spec.ts)
npm run test -- <path>  # single test file
npm run test:e2e        # jest against test/jest-e2e.json
```

### `web`
```sh
cd web
npm run dev    # next dev --turbopack -p 3001
npm run build  # next build
npm run lint   # eslint
```

## Environment

Each service loads its own `.env`:
- `pantry-agent/.env` — Pinterest OAuth (`PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `PINTEREST_REFRESH_TOKEN`), model provider keys, optional `MASTRA_DB_URL`/`MASTRA_DB_AUTH_TOKEN`, `PINTEREST_CACHE_DB_URL`/`PINTEREST_CACHE_DB_PATH`.
- `api/.env` — `AUTH_PASSWORD` (bcrypt hash), `JWT_SECRET`, `MASTRA_SERVER_URL`, `WEB_ORIGIN`, `PORT`.
- `web/.env.local` — `NEXT_PUBLIC_API_URL`.
