# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is an npm workspaces monorepo with three services that talk to each other over HTTP:

- **`pantry-agent/`** — a Mastra agent server (port 4111). Owns all Pinterest API access, recipe extraction, recommendations, and grocery lists. Exposes agents via Mastra's generated HTTP API (e.g. `POST /api/agents/pantryAgent/generate`), plus `GET /health/pinterest`.
- **`api/`** — a NestJS backend (port 3000, default). Authenticates the web client (JWT), owns pantry CRUD, and proxies chat messages to the Mastra server. Holds no agent logic itself.
- **`web/`** — a Next.js frontend (port 3001). Landing, login, chat, and pantry pages; calls `api/` with a bearer token.

Request flow: `web` → (JWT-authed) `api` `/chat` → `pantry-agent` Mastra HTTP API → Pinterest API / Tavily / Anthropic. In production `api` and `pantry-agent` run in one Railway container (`start.sh`), and only `api` is exposed.

File names are kebab-case throughout (Nest's `name.kind.ts` convention in `api/`).

### `pantry-agent` internals

- `src/mastra/index.ts` — the `Mastra` instance; all agents/workflows/scorers must be registered here (see `AGENTS.md` rule below). Calls `checkRequiredEnv()` explicitly: `mastra build` tree-shakes side-effect-only imports, so startup code must be a real call.
- `src/mastra/agents/pantry-agent.ts` — the main user-facing agent. Its instructions encode the actual tool-call protocol (e.g. board names must be resolved to ids via `get-boards` before `get-pins-from-board`; `extract-recipe` URLs must be copied verbatim from a prior tool result, never retyped; grocery lists always come from `generate-grocery-list`). Read this file's instructions before changing tool behavior — the agent's correctness depends on tool output shapes matching what the prompt describes.
- Sub-agents, each tool-less with structured output: `extraction-agent.ts` (recipe page → structured recipe), `pin-selection-agent.ts` (Haiku; shortlists pins by title/board), `grocery-match-agent.ts` (recipe vs pantry).
- `src/mastra/tools/` — one file per tool, named after its id (`get-boards`, `get-pins-from-board`, `search-pins`, `extract-recipe`, `recommend-recipes`, `generate-grocery-list`, `web-search`). `recommend-recipes` is the orchestrator: it shortlists cached pins via the pin-selection agent, lazily backfills the cache (boards with zero cached pins only — never re-fetches boards that already came back empty), verifies candidates via `extract-recipe`, and falls back to an empty result (triggering the agent to use web search) rather than guessing.
- `src/lib/` — pure logic, tested alongside in `*.test.ts`:
  - `pinterest-api.ts` — GET with one retry on 401 (fresh token) / 5xx / network; `pinterestGetAll` follows bookmarks.
  - `pinterest-auth.ts` + `pinterest-token-store.ts` — rotating OAuth tokens persisted in the cache DB (`pinterest_oauth`), single-flight refresh, compare-and-swap save; local dev and prod share this DB.
  - `pinterest-cache.ts` — libSQL cache for boards/pins with a 1-week freshness window (`cache_meta`).
  - `recipe-boards.ts` — the hard-coded list of recipe boards and pin filtering for recommendations.
  - `grocery-prompt.ts` — expiry classification and prompt lines for grocery lists.
  - `pantry-db.ts` — read-only access to the api's `pantry_items` table (must follow the api's schema).
  - `pinterest-health.ts` — startup + daily Pinterest check.
- Storage: `MastraCompositeStore` splits general Mastra storage (LibSQL, `mastra.db`) from observability data (DuckDB).

**Critical:** Before doing any Mastra-specific work (agents, tools, workflows, memory, storage), load the `mastra` skill (`pantry-agent/.agents/skills/mastra/SKILL.md`) first — per `pantry-agent/AGENTS.md`, cached knowledge of Mastra APIs is likely wrong since they change between versions.

### `api` internals

- `config/check-env.ts` — imported first in `main.ts`; startup fails if `AUTH_PASSWORD_HASH`, `JWT_SECRET`, or `PANTRY_DB_URL` is missing.
- `auth/` — `POST /auth/login` (`LoginDto`; bcrypt-compares against `AUTH_PASSWORD_HASH`; rate-limited 5/min/IP via `@nestjs/throttler`, with `trust proxy` set for Railway) issuing a 7-day JWT for `OWNER_ID`. `JwtAuthGuard` protects other routes via `Authorization: Bearer`.
- `chat/` — `ChatController` (guarded, `ChatRequestDto`) → `ChatService.sendMessage`, which POSTs to the Mastra server's `pantryAgent` generate endpoint (2-minute timeout → 504) and joins per-step text. `MASTRA_SERVER_URL` controls the target (default `http://localhost:4111`).
- `pantry/` — CRUD service/controller. `pantry.db.ts` owns the schema and column migrations. In `UpdatePantryItemDto`, `null` clears quantity/unit/expiry but is rejected (via `@OptionalNotNull`) for NOT NULL columns.
- `health/` — unauthenticated `GET /health` (Railway's health check).
- CORS origin is controlled by `WEB_ORIGIN` (default `http://localhost:3001`).

### `web` internals

- App Router pages: `src/app/page.tsx` (landing), `login/`, `chat/`, `pantry/`, and `privacy/`, which renders the repo root's `privacy.md` (the only copy; Pinterest requires the policy) at build time. The pantry page's pieces live in route-private `_components/` and `_lib/`.
- `src/lib/api.ts` — `authedFetch` attaches the JWT from `localStorage` and redirects to `/login` on a 401; `fetchJson` also throws `ApiError` on any non-2xx.
- `src/lib/freshness.ts` — expiry date parsing (local dates) and the expired/use-soon rules; the 3-day window matches `pantry-agent/src/lib/grocery-prompt.ts`.
- `src/lib/use-require-auth.ts`, `storage-keys.ts`, `chat-context.tsx` (conversation state in the root layout).
- Next.js version in this repo has breaking changes vs. typical training data — see `web/AGENTS.md`, which points to `node_modules/next/dist/docs/` for current API/conventions before writing Next.js code.

## Commands

Run from the repo root unless noted.

```sh
npm test            # every workspace's tests, then the api e2e suite
npm run typecheck   # all three workspaces
```

### Start everything (production build)
```sh
./start.sh
```
Starts `pantry-agent` (built Mastra output, port 4111) and `api` (built Nest output) together, and exits if either stops. Run each service's `build` step first — this script does not build.

### `pantry-agent`
```sh
npm run dev -w pantry-agent             # mastra dev
npm run build -w pantry-agent           # mastra build
npm run start -w pantry-agent           # mastra start (built output)
npm test -w pantry-agent                # vitest
npm run auth:pinterest -w pantry-agent  # one-time Pinterest OAuth flow
```

### `api`
```sh
npm run start:dev -w api     # nest start --watch
npm run build -w api
npm test -w api              # jest unit (*.spec.ts)
npm run test:e2e -w api      # jest e2e (in-memory DB, needs --experimental-vm-modules, set in the script)
npm run lint -w api          # eslint --fix
```

### `web`
```sh
npm run dev -w web       # next dev -p 3001
npm run build -w web
npm test -w web          # vitest
npm run typecheck -w web # next typegen && tsc (route types are generated, not committed)
npm run lint -w web
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint (api without `--fix`), tests, and all three builds.

## Environment

Each service loads its own env file; see its `.env.example` for every variable.
- `pantry-agent/.env` — Anthropic and Tavily keys, Pinterest OAuth (`PINTEREST_CLIENT_ID`/`SECRET` are needed on every refresh, not just once), cache/Mastra/pantry database URLs.
- `api/.env` — `AUTH_PASSWORD_HASH` (bcrypt hash), `JWT_SECRET`, `PANTRY_DB_URL`, `MASTRA_SERVER_URL`, `WEB_ORIGIN`, `PORT`.
- `web/.env.local` — `NEXT_PUBLIC_API_URL`.
