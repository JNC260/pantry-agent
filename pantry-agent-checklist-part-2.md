# Pantry Agent — Checklist, Part 2

Picks up right after Session 5 in your original checklist. You've got three working tools (`get-my-boards`, `get-pins-from-board`, `extract-recipe`). This part covers the three things you flagged:

1. Two real bugs in your Pinterest auth that are almost certainly why you keep needing to reauthorize
2. A caching layer so you're not refetching all boards/pins on every query
3. A pin search tool

Same rules as before: one session = 1–3 hours, don't skip ahead, leave yourself a note if you stop mid-session.

**Version note:** I pulled your actual repo before writing this, so the code below matches what you have installed (`@mastra/core ^1.50.1`, i.e. Mastra v1). One thing worth knowing explicitly: **v1 changed how `execute` receives its arguments.** Older Mastra examples (and the Part 1 checklist) use `execute: async ({ context }) => { const { x } = context; }`. Your installed version uses `execute: async (inputData, context) => { const { x } = inputData; }` instead — no destructuring `context` out of the first argument. You can see this for yourself: your own `pantry-tools.ts` already uses the new style. All code below matches it. [v1 migration notes, if you want the full list of what changed](https://mastra.ai/blog/announcing-mastra-1).

---

## Session 6 — Fix the Pinterest auth bugs (~1–2 hrs)

Goal: stop getting 401s mid-session. There are two separate bugs here, not one.

### Background: what's actually broken

Go open `src/mastra/tools/pantry-tools.ts` and look at both tools side by side.

**Bug 1 — `getMyBoardsTool` never refreshes.**
```ts
Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
```
This reads the access token straight out of your `.env` file. That value was written once, by hand, back in Session 3 (or whenever you last ran the OAuth flow). Pinterest access tokens are only valid for about 30 days ([Pinterest's own docs on this](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)) — so this specific tool is guaranteed to start failing once that token goes stale, no matter what else you fix.

**Bug 2 — `getPinsFromBoardTool` fetches a fresh token and then doesn't use it.**
```ts
const token = await getValidPinterestToken();

const response = await axios.get(
  `https://api.pinterest.com/v5/boards/${boardId}/pins`,
  {
    headers: {
      "User-Agent": "Mozilla/5.0 ...",
      Accept: "text/html,application/xhtml+xml...",
      ...
    },
  },
);
```
See it? `token` is fetched and then never appears in the `headers` object. Instead it sends browser-spoofing headers (User-Agent, Referer, etc.) — that pattern makes sense in `extractRecipe.ts`, where you're fetching an arbitrary recipe *website* that might block non-browser requests. It does not make sense here: `api.pinterest.com/v5/...` is Pinterest's actual REST API, and it authenticates via `Authorization: Bearer <token>`, not by pretending to be a browser. This call is currently going out with **no real auth at all**, which will 401 every time — and 401s are exactly the kind of thing that makes you think "ugh, I need to reauthorize again," even though the real fix has nothing to do with your OAuth flow.

This second bug is very likely the actual cause of your "I need to reauthorize a lot, even within one session" complaint — a 30-day access token doesn't normally cause same-session pain, but a tool call that's silently unauthenticated absolutely does.

The good news: `getValidPinterestToken()` in `pinterest-auth.ts` (the refresh-token logic) is written correctly. You don't need to touch that file. You just need both tools to actually call it and actually use what it returns.

### Step 1 — Fix both tools to use the same auth path

Docs to keep open: [createTool() reference](https://mastra.ai/reference/tools/create-tool)

Replace the contents of `src/mastra/tools/pantry-tools.ts` with:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";
import { getValidPinterestToken } from "../../lib/pinterest-auth";

export const getMyBoardsTool = createTool({
  id: "get-my-boards",
  description: "Lists the boards on the user's own Pinterest account",
  inputSchema: z.object({}),
  outputSchema: z.object({
    boards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async () => {
    const token = await getValidPinterestToken();

    const response = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const boards = response.data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    return { boards };
  },
});

export const getPinsFromBoardTool = createTool({
  id: "get-pins-from-board",
  description:
    "Lists the pins on a specific Pinterest board, including each pin's source link",
  inputSchema: z.object({
    boardId: z.string().describe("The Pinterest board ID to fetch pins from"),
  }),
  outputSchema: z.object({
    pins: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { boardId } = inputData;
    const token = await getValidPinterestToken();

    const response = await axios.get(
      `https://api.pinterest.com/v5/boards/${boardId}/pins`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const pins = response.data.items.map((p: any) => ({
      id: p.id,
      title: p.title ?? null,
      sourceLink: p.link ?? null,
    }));

    return { pins };
  },
});
```

What changed, concretely:
- `getMyBoardsTool` now calls `getValidPinterestToken()` instead of reading the raw env var.
- `getPinsFromBoardTool` now actually sends the token it fetches, and the browser-spoofing headers are gone (they were never doing anything useful against Pinterest's API anyway).

### Step 2 — Delete the stale env var (optional but recommended)

`PINTEREST_ACCESS_TOKEN` in your `.env` is no longer read by any tool — both now go through `getValidPinterestToken()`, which gets its access token from `PINTEREST_REFRESH_TOKEN` on demand. You can leave the old var in `.env` harmlessly, or remove it to avoid confusing yourself later. Just don't delete `PINTEREST_REFRESH_TOKEN` — that one's load-bearing.

### Step 3 — Test it

- [ ] `npm run dev`, open Studio at `http://localhost:4111`
- [ ] Ask "what boards do I have?" then "what pins are on board [id]?" back to back
- [ ] Add a temporary `console.log("refreshed token")` inside `getValidPinterestToken()` right after the `axios.post` call, so you can watch in your terminal when a refresh actually happens vs. when the cached token is reused
- [ ] Confirm no 401s in the terminal running `npm run dev`

### Step 4 — Commit

```
git add .
git commit -m "fix Pinterest auth: use refreshed token consistently in both tools"
git push
```

**Session 6 is done when:** you can call both board and pin tools repeatedly in one Studio session without a 401, and you've watched the console log confirm the refresh path is actually being used.

---

## Session 7 — Build a small cache (~1–3 hrs)

Goal: stop refetching every board and every pin on every query.

### Background: why not Mastra's `Memory`?

You linked [Mastra's memory docs](https://mastra.ai/docs/memory/overview) as a starting point, which was a reasonable place to look, but it's worth understanding *why* it's not actually the right tool for this job before you build around it. Mastra's `Memory` class gives you three things: conversation history, working memory (small structured facts like a user's name or preferences), and semantic recall (vector search over past chat messages). All three are about the agent remembering *the conversation* — not about caching a dataset the size of "every pin on every board." Trying to stuff that into working memory would be fighting the tool, not using it.

What you actually want is a plain cache: "have I fetched this before, and is it recent enough to trust?" You already have `LibSQLStore` wired up in `src/mastra/index.ts`, but it's reserved for Mastra's own internal tables (threads, messages, etc.) — not really meant for your own custom tables. So this session adds a **second, separate SQLite file** just for your Pinterest cache, using the same underlying library (`libsql`) directly. This keeps your cache fully independent of whatever Mastra does internally with its own storage, so a future Mastra upgrade can't quietly break your cache logic.

Docs to keep open: [@libsql/client on npm](https://www.npmjs.com/package/@libsql/client)

### Step 1 — Install the client

```
npm install @libsql/client
```

(`@mastra/libsql` already depends on this under the hood, but installing it directly means you're not relying on someone else's transitive dependency staying the same shape.)

### Step 2 — Create the cache module

New file `src/lib/pinterest-cache.ts`:

```ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: "file:./pinterest-cache.db",
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let initialized = false;

async function ensureTables() {
  if (initialized) return;

  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS boards_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS pins_cache (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        title TEXT,
        source_link TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cache_meta (
        cache_key TEXT PRIMARY KEY,
        fetched_at INTEGER NOT NULL
      )`,
    ],
    "write",
  );

  initialized = true;
}

async function isFresh(cacheKey: string, maxAgeMs = ONE_DAY_MS): Promise<boolean> {
  await ensureTables();
  const result = await client.execute({
    sql: "SELECT fetched_at FROM cache_meta WHERE cache_key = ?",
    args: [cacheKey],
  });
  if (result.rows.length === 0) return false;
  const fetchedAt = Number(result.rows[0].fetched_at);
  return Date.now() - fetchedAt < maxAgeMs;
}

async function markFetched(cacheKey: string) {
  await client.execute({
    sql: `INSERT INTO cache_meta (cache_key, fetched_at) VALUES (?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET fetched_at = excluded.fetched_at`,
    args: [cacheKey, Date.now()],
  });
}

export async function getCachedBoards() {
  await ensureTables();
  const result = await client.execute("SELECT id, name FROM boards_cache");
  return result.rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
}

export async function boardsAreFresh(maxAgeMs?: number) {
  return isFresh("boards", maxAgeMs);
}

export async function replaceCachedBoards(
  boards: { id: string; name: string }[],
) {
  await ensureTables();
  await client.batch(
    [
      "DELETE FROM boards_cache",
      ...boards.map((b) => ({
        sql: "INSERT INTO boards_cache (id, name) VALUES (?, ?)",
        args: [b.id, b.name],
      })),
    ],
    "write",
  );
  await markFetched("boards");
}

export async function getCachedPins(boardId: string) {
  await ensureTables();
  const result = await client.execute({
    sql: "SELECT id, board_id, title, source_link FROM pins_cache WHERE board_id = ?",
    args: [boardId],
  });
  return result.rows.map((r) => ({
    id: String(r.id),
    title: r.title === null ? null : String(r.title),
    sourceLink: r.source_link === null ? null : String(r.source_link),
  }));
}

export async function pinsAreFresh(boardId: string, maxAgeMs?: number) {
  return isFresh(`pins:${boardId}`, maxAgeMs);
}

export async function replaceCachedPins(
  boardId: string,
  pins: { id: string; title: string | null; sourceLink: string | null }[],
) {
  await ensureTables();
  await client.batch(
    [
      { sql: "DELETE FROM pins_cache WHERE board_id = ?", args: [boardId] },
      ...pins.map((p) => ({
        sql: "INSERT INTO pins_cache (id, board_id, title, source_link) VALUES (?, ?, ?, ?)",
        args: [p.id, boardId, p.title, p.sourceLink],
      })),
    ],
    "write",
  );
  await markFetched(`pins:${boardId}`);
}

// Used by the search tool in Session 9 to search across every cached board
export async function getAllCachedBoardIds(): Promise<string[]> {
  const boards = await getCachedBoards();
  return boards.map((b) => b.id);
}
```

A few things worth understanding, not just copying:
- **`cache_meta` is separate from the data tables.** This lets you ask "is this fresh?" without loading all the rows — you're just checking one timestamp per board or per pin-list.
- **`ON CONFLICT ... DO UPDATE`** is SQLite's upsert syntax — insert a new freshness timestamp, or overwrite the existing one if that key's already there.
- **`ONE_DAY_MS` is a starting guess**, not a rule. Your boards and pins probably don't change every day. You can bump this to a week and just add a manual "refresh" option (Session 8) for whenever you know you've actually added something on Pinterest.
- **Why a whole second `.db` file** instead of reusing `mastra.db`: Mastra owns the schema of its own storage file and can change it between versions. Keeping your cache in its own file means a Mastra upgrade can never accidentally corrupt or collide with your own tables.
- Add `pinterest-cache.db` to your `.gitignore` — it's local generated data, not something you want in version control (check your existing `.gitignore`, you likely already exclude `mastra.db` the same way).

### Step 3 — Sanity check it works, standalone

Before wiring this into your tools, prove it works on its own — same philosophy as Session 2's standalone Pinterest script.

- [ ] Create a throwaway `src/scratch.ts`:
  ```ts
  import { replaceCachedBoards, getCachedBoards, boardsAreFresh } from "./lib/pinterest-cache";

  async function main() {
    await replaceCachedBoards([{ id: "123", name: "Test Board" }]);
    console.log(await getCachedBoards());
    console.log("fresh?", await boardsAreFresh());
  }

  main();
  ```
- [ ] Run it with `npx tsx src/scratch.ts` (install `tsx` if you don't have it: `npm install -D tsx`)
- [ ] Confirm it prints your test board back, and `fresh? true`
- [ ] Delete `scratch.ts` once confirmed — it was just a smoke test

### Step 4 — Commit

```
git add .
git commit -m "add local Pinterest cache (boards + pins, with freshness tracking)"
git push
```

**Session 7 is done when:** you've proven, outside of the agent entirely, that you can write boards/pins into the cache and read them back with an accurate freshness check.

---

## Session 8 — Wire the cache into your tools (~1–2 hrs)

Goal: `getMyBoardsTool` and `getPinsFromBoardTool` check the cache first, and only hit Pinterest's API on a miss or explicit refresh.

### Step 1 — Update `pantry-tools.ts` to check cache first

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";
import { getValidPinterestToken } from "../../lib/pinterest-auth";
import {
  getCachedBoards,
  boardsAreFresh,
  replaceCachedBoards,
  getCachedPins,
  pinsAreFresh,
  replaceCachedPins,
} from "../../lib/pinterest-cache";

export const getMyBoardsTool = createTool({
  id: "get-my-boards",
  description:
    "Lists the boards on the user's own Pinterest account. Uses a local cache by default — pass refresh: true only if the user says a board is missing or out of date.",
  inputSchema: z.object({
    refresh: z
      .boolean()
      .optional()
      .describe("Set true to bypass the cache and refetch from Pinterest"),
  }),
  outputSchema: z.object({
    boards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const refresh = inputData?.refresh ?? false;

    if (!refresh && (await boardsAreFresh())) {
      const boards = await getCachedBoards();
      if (boards.length > 0) return { boards };
    }

    const token = await getValidPinterestToken();
    const response = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const boards = response.data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    await replaceCachedBoards(boards);
    return { boards };
  },
});

export const getPinsFromBoardTool = createTool({
  id: "get-pins-from-board",
  description:
    "Lists the pins on a specific Pinterest board, including each pin's source link. Uses a local cache by default — pass refresh: true only if the user says a pin is missing.",
  inputSchema: z.object({
    boardId: z.string().describe("The Pinterest board ID to fetch pins from"),
    refresh: z
      .boolean()
      .optional()
      .describe("Set true to bypass the cache and refetch from Pinterest"),
  }),
  outputSchema: z.object({
    pins: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { boardId } = inputData;
    const refresh = inputData.refresh ?? false;

    if (!refresh && (await pinsAreFresh(boardId))) {
      const pins = await getCachedPins(boardId);
      if (pins.length > 0) return { pins };
    }

    const token = await getValidPinterestToken();
    const response = await axios.get(
      `https://api.pinterest.com/v5/boards/${boardId}/pins`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const pins = response.data.items.map((p: any) => ({
      id: p.id,
      title: p.title ?? null,
      sourceLink: p.link ?? null,
    }));

    await replaceCachedPins(boardId, pins);
    return { pins };
  },
});
```

Notice the pattern is identical in both tools: check freshness → if fresh and non-empty, return cache → otherwise hit the API and refill the cache. This is the "refetch if it couldn't find something" behavior you asked for, but pushed down to the tool level rather than left as something the agent has to reason about on its own.

### Step 2 — Nudge the agent's instructions

Open `src/mastra/agents/pantry-agent.ts` and add a line so the agent knows *when* it's appropriate to ask for a refresh, rather than defaulting to it constantly:

```ts
instructions: `You are a helpful assistant for managing recipes and pantry items.
  Use the get-my-boards tool when the user asks about their Pinterest boards.
  Board and pin data is cached locally, so most calls will be fast and won't hit Pinterest directly.
  Only pass refresh: true if the user says something looks missing, wrong, or out of date —
  don't refresh by default just because you're unsure.

  ...(keep the rest of your existing instructions unchanged)...`,
```

### Step 3 — Test it

- [ ] `npm run dev`, restart Studio
- [ ] Ask for your boards twice in a row — the second call should be near-instant (no network round trip to Pinterest). Add a temporary `console.log("cache hit")` / `console.log("cache miss, fetching")` in the tool to see this happening in your terminal
- [ ] Ask a question that would require refreshing (e.g. "I just added a new board, can you check again?") and confirm the agent passes `refresh: true`
- [ ] Delete the temporary console.logs once you've seen both paths work

### Step 4 — Commit

```
git add .
git commit -m "wire local cache into board and pin tools"
git push
```

**Session 8 is done when:** asking for your boards or pins twice in a row is visibly faster the second time, and you've confirmed both the cache-hit and cache-miss/refresh paths actually run.

---

## Session 9 — Pin search tool (~1–3 hrs)

Goal: let the agent search across your cached pins for ones matching some criteria, instead of you having to name a board and eyeball the list yourself.

### Step 1 — Add a search helper to the cache module

Open `src/lib/pinterest-cache.ts` again and add:

```ts
export async function searchCachedPins(query: string, boardId?: string) {
  await ensureTables();

  const lowerQuery = query.toLowerCase();

  const boardIds = boardId ? [boardId] : await getAllCachedBoardIds();

  const matches: {
    id: string;
    title: string | null;
    sourceLink: string | null;
    boardId: string;
  }[] = [];

  for (const id of boardIds) {
    const pins = await getCachedPins(id);
    for (const pin of pins) {
      if (pin.title && pin.title.toLowerCase().includes(lowerQuery)) {
        matches.push({ ...pin, boardId: id });
      }
    }
  }

  return matches;
}
```

This is intentionally the simplest possible version: a case-insensitive substring match on pin titles, run across every board you've already cached. It won't catch "chicken soup" if the user asks for "poultry stew" — that's a real limitation, and worth naming as a stretch goal rather than solving now: a smarter version would ask an LLM to judge whether each cached title matches the user's intent, or embed titles into a vector store for semantic search (the same `LibSQLVector` your `@mastra/libsql` package already includes). Get the dumb version working first; you'll know quickly whether it's good enough for your own use or genuinely needs the upgrade.

### Step 2 — Create the tool

New file `src/mastra/tools/searchPins.ts`:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchCachedPins } from "../../lib/pinterest-cache";

export const searchPinsTool = createTool({
  id: "search-pins",
  description:
    "Searches the user's cached Pinterest pins by keyword, optionally limited to one board. Use this when the user describes what kind of recipe they're looking for rather than naming a specific pin.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Keyword or phrase to search for in pin titles, e.g. 'chicken'"),
    boardId: z
      .string()
      .optional()
      .describe("Limit the search to this board only, if known"),
  }),
  outputSchema: z.object({
    matches: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        sourceLink: z.string().nullable(),
        boardId: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { query, boardId } = inputData;
    const matches = await searchCachedPins(query, boardId);
    return { matches };
  },
});
```

### Step 3 — Attach it to the agent

In `src/mastra/agents/pantry-agent.ts`:

```ts
import { searchPinsTool } from "../tools/searchPins";

export const pantryAgent = new Agent({
  // ...
  tools: { getMyBoardsTool, getPinsFromBoardTool, extractRecipeTool, searchPinsTool },
});
```

Also worth a line in `instructions` so the agent knows this exists and doesn't just fall back to listing an entire board when the user is describing what they want:

```
Use the search-pins tool when the user describes what they're looking for
(e.g. "find me something with chicken") rather than naming a specific board or pin.
If search-pins returns no matches, it's reasonable to suggest the user try get-my-boards
and get-pins-from-board with refresh: true, in case the cache is missing something new.
```

### Step 4 — Test it

- [ ] `npm run dev`, restart Studio
- [ ] Make sure you've got a few boards/pins already cached (run `get-my-boards` and `get-pins-from-board` on at least one board first, in this same session, so there's something to search)
- [ ] Ask: "do I have any pins about chicken?" — confirm it calls `search-pins`, not `get-pins-from-board`
- [ ] Ask something with zero matches (e.g. a word you know isn't in any of your pin titles) and check the agent handles an empty result gracefully rather than making something up
- [ ] Try a case where the "obvious" keyword isn't literally in the title (e.g. searching "poultry" for a pin titled "Chicken Piccata") — confirm to yourself that it correctly finds nothing, so you know exactly where this version's limits are

### Step 5 — Commit

```
git add .
git commit -m "add pin search tool over the local cache"
git push
```

**Session 9 is done when:** you can ask your agent to find pins by description rather than by board name, and you have a clear, honest sense of where the substring-match approach breaks down (which is a legitimate, presentable "here's what I'd improve next" story, not something to hide).

---

## Where things stand after Session 9

Auth is consistent and actually authenticated on every call. Boards and pins are cached locally with freshness tracking, so repeat queries don't round-trip to Pinterest. You can search pins by description instead of only by board name. That's the full loop you described at the start of this round: cache it, refresh only when needed, and search over what you've got.

Natural next stretch goals, not urgent: semantic search over pin titles (or even over extracted recipe content, once you're caching that too) using `LibSQLVector`; and eventually looping `extract-recipe` over every cached pin on a board so you're not extracting one recipe at a time.
