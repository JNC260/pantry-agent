# Pantry Agent — Setup Checklist

Goal of this doc: get from zero to a working local agent, one 1–3 hour session at a time.
Check things off as you go. Don't skip ahead to Session 2 until Session 1's goal is met — the point of each session is a small, real win you can see.

---

## Session 0 — Tooling check (~15–20 min)

You already have most of this as a working engineer. Just confirm, don't reinstall blindly.

- [x] Node.js LTS installed → run `node -v` in a terminal, should show v20 or v22+. If missing/old, grab it from nodejs.org.
- [x] VS Code installed, with these extensions if you don't have them: ESLint, Prettier
- [x] Git installed and a GitHub account ready
- [x] Create a **new, public** GitHub repo now, called something like `pantry-agent`. Do this on day one, not at the end — an empty repo with a good README that grows commit-by-commit over two months is itself part of the portfolio story.
- [x] Anthropic API key from console.anthropic.com — since you already use Claude Code daily, this is infra you already understand. Note: this is pay-as-you-go, separate from your claude.ai subscription; keep an eye on usage while you're testing.

**Session 0 is done when:** you have an empty GitHub repo cloned locally in a folder you'll work in.

---

## Session 1 — "Hello, agent" (~1–2 hrs)

Goal: see a working agent respond to you locally. Nothing recipe-specific yet — just get the shape of Mastra in your hands.

- [x] In your project folder, run:
  ```
  npm create mastra@latest pantry-agent -- --llm anthropic
  ```
  This is an interactive CLI — it'll ask a couple questions (project name, LLM provider — say anthropic). It scaffolds a working example agent, a tool, and a workflow for you.
- [x] `cd pantry-agent`, then `npm run dev`
- [x] Open **Mastra Studio** at `http://localhost:4111` — this is the UI for poking at agents/tools/workflows without writing a frontend.
- [x] In Studio, chat with the example agent that ships with the scaffold (it's usually a weather assistant). Ask it a few things. Watch it call its tool.
- [x] Open the actual code in `src/` and find: the `Agent` definition, the `Tool` definition, how they're wired together. Don't try to memorize it — just get oriented on the shape: an agent has instructions + a model + a list of tools; a tool has a name, an input schema, and a function.
- [x] Commit: `git commit -m "scaffold mastra project"`, push to your repo.

**Session 1 is done when:** you've had a working conversation with an agent running on your machine, and you can point to the 2-3 files that make it work.

---

## Session 2 — Pinterest developer access (~1–2 hrs)

Goal: prove you can pull your own board data, _before_ wiring it into an agent. Do this step early — API approval sometimes isn't instant.

- [x] Go to developers.pinterest.com, log in with your normal Pinterest account, create a new app.
- [x] When requesting scopes, ask only for `pins:read` and `boards:read` — you're not posting anything, just reading. Fewer scopes = smoother approval.
- [x] Set up OAuth: note your client ID/secret, and set a redirect URI for local dev (e.g. `http://localhost:3000/callback`).
- [x] Write a **tiny standalone script** — not inside Mastra yet — that does the OAuth flow and lists your boards. This isolates "does my Pinterest access work" from "does my agent work," so when something breaks later you know which layer to debug.
- [x] Once that script prints your board names, you're good.

**Session 2 is done when:** a plain Node script (outside of Mastra) successfully lists your Pinterest boards.

---

## Session 3 — Your first real tool (~1–2 hrs)

Goal: replace the example weather tool with a real one of yours — an agent tool that lists your Pinterest boards.

Docs to keep open in a tab while you work:

- [createTool() reference](https://mastra.ai/reference/tools/create-tool) — the exact shape every tool must follow
- [Using Tools in agents](https://mastra.ai/docs/agents/using-tools) — how tools get attached

### Background you need first: tokens don't persist yet

Your Session 2 script does the full browser login every time you run it, and doesn't save the access token anywhere. That's fine for a one-off test, but a tool that an _agent_ calls repeatedly needs a token sitting around ready to use — you don't want your agent popping open a browser mid-conversation.

For now, the simplest fix: **run your Session 2 script once, copy the `access_token` it got, and paste it into your `.env`** as a temporary shortcut:

```
PINTEREST_ACCESS_TOKEN=paste_it_here
```

This is a shortcut, not the final design — Pinterest access tokens expire (they're not permanent), so at some point (flag it as a stretch task, not now) you'll want to store the refresh token too and auto-refresh. For this session, don't worry about that — just get a tool working with a token you pasted in by hand.

### Step 1 — Create the tool file

Inside your `pantry-agent` project, create `src/mastra/tools/getMyBoards.ts`:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

export const getMyBoardsTool = createTool({
  id: "get-my-boards",
  description: "Lists the boards on the user's own Pinterest account",
  inputSchema: z.object({}), // no input needed — it always fetches "my" boards
  outputSchema: z.object({
    boards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async () => {
    const response = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: {
        Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
      },
    });

    const boards = response.data.items.map((b: any) => ({
      id: b.id,
      name: b.name,
    }));

    return { boards };
  },
});
```

This is the same logic as your Session 2 script's board-listing part — just repackaged into the shape Mastra expects. Notice: `id`, `description`, `inputSchema`, `outputSchema`, and an `execute` function are **all required** — a plain object without `createTool()` silently fails, so don't skip the wrapper.

### Step 2 — Make sure axios is installed in the Mastra project

This is a separate `node_modules` from your throwaway `pinterest-test` folder — you need to install it again here:

```
npm install axios
```

### Step 3 — Attach the tool to your agent

Open the agent file the scaffold created (likely `src/mastra/agents/weather-agent.ts` or similar — check your Session 1 notes for the exact filename). Import your new tool and add it:

```ts
import { getMyBoardsTool } from "../tools/getMyBoards";

export const pantryAgent = new Agent({
  name: "Pantry Agent",
  instructions: `You are a helpful assistant for managing recipes and pantry items.
    Use the get-my-boards tool when the user asks about their Pinterest boards.`,
  model: "anthropic/claude-sonnet-4-6",
  tools: { getMyBoardsTool },
});
```

(You can rename the agent/file, or keep the example one and just swap its tools — either is fine for now, don't over-think naming yet.)

### Step 4 — Test it

- [x] `npm run dev`, open Studio at `http://localhost:4111`
- [x] Chat with your agent: ask "What Pinterest boards do I have?"
- [x] Confirm in the Studio UI that it actually **calls the tool** (Studio shows tool calls in the conversation trace) rather than just guessing an answer
- [x] If it errors: check the terminal running `npm run dev` for the actual error — most common issues are a stale/expired token (rerun Session 2's script and repaste it), or a typo in the tool's `id` not matching what's referenced in `tools: {}`

### Step 5 — Commit

```
git add .
git commit -m "add getMyBoards tool"
git push
```

**Session 3 is done when:** your agent can answer a question using _your_ real Pinterest data, not the example weather API, and you've watched Studio confirm it actually called your tool (not just hallucinated an answer).

---

## Session 4 — Get pins from one board (~1 hr)

Goal: given a board, get a list of its pins and the source link on each one — no AI yet, just plain data fetching.

Doc to keep open: [Pinterest API v5 reference](https://developers.pinterest.com/docs/api/v5/) — search for the `GET /boards/{board_id}/pins` endpoint.

### Step 1 — Add a `getPinsFromBoard` tool

Same pattern as `getMyBoards`, new file `src/mastra/tools/getPinsFromBoard.ts`:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

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
  execute: async ({ context }) => {
    const { boardId } = context;

    const response = await axios.get(
      `https://api.pinterest.com/v5/boards/${boardId}/pins`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
        },
      },
    );

    const pins = response.data.items.map((p: any) => ({
      id: p.id,
      title: p.title ?? null,
      sourceLink: p.link ?? null, // this is the URL back to the original recipe site
    }));

    return { pins };
  },
});
```

- [x] Add this tool to your agent's `tools: {}` object alongside `getMyBoardsTool`
- [x] In Studio, ask: "What pins are on board [paste one of your board IDs from Session 3]?"
- [x] Confirm you get back pin titles and, importantly, a `sourceLink` for at least a few of them (some pins might not have one — that's fine, expected, just skip those later)

**Session 4 is done when:** you can ask your agent for the pins on a specific board and see real source links printed back.

---

## Session 5 — Fetch and extract one recipe (~1-2 hrs)

Goal: take a single source link from Session 4, pull down that webpage, and have the LLM turn its messy HTML into clean structured JSON — the single hardest, highest-value piece of the whole project.

Docs to keep open:

- [Structured output docs](https://mastra.ai/docs/agents/structured-output) — the `structuredOutput` pattern below comes straight from here
- [Agent.generate() reference](https://mastra.ai/reference/agents/generate)

### Step 1 — Add a tool to fetch and extract a recipe

New file `src/mastra/tools/extractRecipe.ts`:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

const recipeSchema = z.object({
  title: z.string(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      quantity: z
        .string()
        .nullable()
        .describe("e.g. '2 cups', '1 lb' — keep as a string since units vary"),
    }),
  ),
  steps: z.array(z.string()),
  cuisine: z.string().nullable(),
  mainProtein: z.string().nullable(),
  totalTimeMinutes: z.number().nullable(),
});

export const extractRecipeTool = createTool({
  id: "extract-recipe",
  description:
    "Fetches a recipe webpage and extracts structured recipe data from it",
  inputSchema: z.object({
    url: z.string().describe("The URL of the recipe page to fetch and parse"),
  }),
  outputSchema: recipeSchema,
  execute: async ({ context, mastra }) => {
    const { url } = context;

    // Step A: fetch the raw page
    const pageResponse = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }, // some recipe sites block requests with no user-agent
    });
    const html = pageResponse.data;

    // Step B: hand the HTML to an LLM and ask for structured JSON back
    const extractionAgent = mastra!.getAgent("pantryAgent"); // reuse your existing agent — swap in your actual agent's name/id if different

    const result = await extractionAgent.generate(
      `Extract the recipe from this HTML page. Ignore navigation, ads, and comments — only extract the actual recipe content.\n\nHTML:\n${html.slice(0, 15000)}`,
      { structuredOutput: { schema: recipeSchema } },
    );

    return result.object;
  },
});
```

A few things worth understanding, not just copying:

- **`html.slice(0, 15000)`** — recipe pages can be huge (ads, scripts, related-post widgets). Truncating keeps you under context limits and cost reasonable for now. If extraction quality suffers on longer pages, a future improvement is stripping HTML tags down to visible text before sending it, rather than just cutting it off — flag that as a stretch task, not now.
- **`mastra!.getAgent("pantryAgent")`** — this reuses your existing agent to do the extraction, which is fine for a first pass. The `mastra` param is available inside `execute` because you access it as the second argument — that's how a tool can call back into an agent.
- **Every field is `.nullable()`** rather than required — recipe sites are inconsistent, and a missing cuisine tag shouldn't cause the whole extraction to fail. This is what "fail loudly, not silently" is really about: fields legitimately missing return `null`, but a field with the wrong _type_ (e.g. a string where a number was expected) will throw, which is what you want.

### Step 2 — Add the tool and test it

- [x] Add `extractRecipeTool` to your agent's `tools: {}`
- [ ] In Studio, ask: "Extract the recipe from [paste a sourceLink from Session 4]"
- [x] Look at the actual JSON that comes back. Does the ingredient list look right? Are the steps in order and complete? Is anything obviously wrong (e.g. ad copy mistaken for an ingredient)?

### Step 3 — Iterate across a few different sites

This is the real work of this session, so budget real time for it:

- [x] Try 3-4 different recipe URLs from different sites (a food blog, AllRecipes-style site, a NYT Cooking-style site if you have one saved, etc.) — they're all formatted differently, which is exactly why this step matters
- [x] For any that extract poorly, tweak the prompt text (not the schema) — e.g. adding "Recipe sites often have irrelevant 'related recipes' sections near the bottom — ignore those" if you notice that pattern
- [x] Don't chase perfection on every site tonight. A couple of clean examples plus honest notes on where it still struggles is a legitimate, presentable result — "here's where my extraction pipeline breaks down and why" is a good engineering story for interviews, not a weakness to hide.

### Step 4 — Commit

```
git add .
git commit -m "add pin listing and recipe extraction tools"
git push
```

**Session 5 is done when:** you can hand your agent a Pinterest pin's source link and get back clean, structured recipe JSON — and you have a rough sense of which kinds of recipe pages it handles well vs. poorly.

---

## A few sequencing notes

- **Don't touch NestJS or React yet.** Get the agent's brain working headless in Mastra Studio first. Wrapping it in a real backend/frontend is trivial once the logic works, and painful to debug if you build the UI before the agent is reliable.
- **Don't stand up Postgres yet either.** Mastra ships with LibSQL storage out of the box — zero infra setup. Start there; migrate to Postgres later only if you actually hit a limitation (e.g. wanting pgvector for embeddings at scale). Don't pre-optimize infra before you have data to store.
- **The pasted-in access token from Session 3 will expire.** When your tools start failing with 401 errors after a break, that's almost certainly the cause — rerun the Session 2 script and paste in a fresh token. Building real token refresh logic is worth doing once you're scaling to "process my whole board," but not before.
- If a session runs long or you get stuck, it's fine to end mid-checkbox — just leave yourself a one-line note on where you stopped so the next session doesn't start with "wait, where was I."

## Where things stand after Session 5

At this point you have three working tools (`get-my-boards`, `get-pins-from-board`, `extract-recipe`) and a real, if small, end-to-end pipeline: Pinterest → source link → structured recipe JSON. That's genuinely the hardest 80% of Phase 1 done. From here, Phase 1's remaining work is mostly repetition and storage (looping the extraction over every pin on a board, saving results to the database Mastra already gives you via LibSQL) rather than new hard problems — a good point to pause and reassess scope against your end-of-August target.
