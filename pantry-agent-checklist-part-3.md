# Pantry Agent — Checklist, Part 3

Picks up after Part 2. Auth is fixed, boards/pins are cached, and pin search works well enough that the agent is already expanding "poultry" into chicken/turkey/duck on its own — worth noting that's the _model_ choosing to retry `search-pins` with different words, not something the tool itself does. Good sign the model's capable enough for what's next, but also means it's not guaranteed every time; keep an eye on it.

This part builds the actual end-to-end flow you described:

> "I have chicken breast and kale, what should I make?" → agent narrows candidates from your pins by title/board → verifies by extracting the _real_ ingredient list from the top candidates → returns 2–3 recommendations with links → falls back to a general web search if nothing in your pins matches.

Three sessions. I pulled your repo again before writing this, so everything below matches your actual current files (`getBoards.ts`, `getPins.ts`, `searchPins.ts`, `pinterest-cache.ts`, and the current `extractRecipe.ts` which still uses the `(data, { mastra })` signature — that detail matters for Session 12).

---

## Session 10 — Web search fallback tool (~1 hr)

Goal: before building the ingredient-matching pipeline, get the _fallback_ path working on its own — same "prove the simple piece works before building the complex piece on top of it" approach as earlier sessions.

### Background

You don't have any general internet search capability right now — `extract-recipe` only fetches a URL you already give it, it can't go find one. Mastra has an official, maintained package for this: [`@mastra/tavily`](https://mastra.ai/reference/tools/tavily), which wraps the [Tavily](https://tavily.com) search API (built specifically for feeding results to LLMs — clean content, not raw HTML). Tavily has a free tier, which is enough for this project.

### Step 1 — Get a Tavily API key

- [x] Sign up at [tavily.com](https://tavily.com), grab your API key from the dashboard
- [x] Add it to `.env`:
  ```
  TAVILY_API_KEY=your_key_here
  ```

### Step 2 — Install the package

```
npm install @mastra/tavily
```

### Step 3 — Add the tool to your agent

In `src/mastra/agents/pantry-agent.ts`:

```ts
import { createTavilySearchTool } from "@mastra/tavily";

const webSearchTool = createTavilySearchTool();
```

Add `webSearchTool` to the `tools: {}` object, and add a line to `instructions` so the agent knows when (and only when) to reach for it:

```
Use the web-search tool only when the user is asking about recipes and search-pins
(or the recommend-recipes tool, once you build it) found nothing relevant in their
own Pinterest pins. Always tell the user clearly when a recommendation came from
the web rather than from their own saved pins.
```

(The tool's `id` is set internally by `createTavilySearchTool()` — check the [Tavily tools reference](https://mastra.ai/reference/tools/tavily) or just look at what Studio shows once it's wired in, and use that exact id in your instructions text instead of guessing.)

### Step 4 — Test it standalone

- [x] `npm run dev`, restart Studio
- [x] Ask something with no connection to your pins at all — e.g. "search the web for a good kale and white bean soup recipe"
- [x] Confirm in Studio's trace view that it actually calls the Tavily tool, and that you get back real titles + links (not the agent just making something up — Tavily results should look distinctly like real search results, with real URLs)

### Step 5 — Commit

```
git add .
git commit -m "add Tavily web search tool as fallback"
git push
```

**Session 10 is done when:** you can ask a general recipe question with no pin data involved and get real, linked web results back.

---

## Session 11 — Score candidates by ingredient keywords (~2–3 hrs)

Goal: given a list of ingredients the user has on hand, narrow your cached pins down to a small, ranked shortlist _before_ doing any expensive recipe extraction. This is the "use pin and board titles to narrow the search, like I would in real life" part.

### Background: why this needs to be a new function, not just `searchCachedPins`

Your existing `searchCachedPins` (used by `search-pins`) takes one query string and returns every pin whose title contains it — it doesn't rank results, and it doesn't know about board names at all. For this flow you need two things it doesn't do:

1. **Multiple ingredients at once**, with pins that match _more_ of them ranked higher (a pin matching both "chicken" and "kale" is a better candidate than one matching only "chicken").
2. **Board name counted too** — a pin titled "Weeknight Dinner" sitting in a board called "Chicken Recipes" is a real signal a human would use, and your cache already has that information (`getCachedBoards()` returns `{id, name}`), it's just not being used in search yet.

Rather than rewriting `searchCachedPins` (which `search-pins` already depends on and works fine for its own use case), add a new function alongside it.

### Step 1 — Add a board-name lookup helper

Open `src/lib/pinterest-cache.ts` and add:

```ts
export async function getBoardNameMap(): Promise<Record<string, string>> {
  const boards = await getCachedBoards();
  const map: Record<string, string> = {};
  for (const b of boards) {
    map[b.id] = b.name;
  }
  return map;
}
```

### Step 2 — Add the scored, multi-ingredient search

Add this to the same file:

```ts
export type ScoredCandidate = {
  id: string;
  title: string | null;
  sourceLink: string | null;
  boardId: string;
  boardName: string;
  matchedIngredients: string[];
  score: number;
};

export async function scoredSearchByIngredients(
  ingredients: string[],
): Promise<ScoredCandidate[]> {
  await ensureTables();

  const boardNameMap = await getBoardNameMap();
  const boardIds = Object.keys(boardNameMap);

  const scored = new Map<string, ScoredCandidate>();

  for (const boardId of boardIds) {
    const pins = await getCachedPins(boardId);
    const boardName = boardNameMap[boardId] ?? "";

    for (const pin of pins) {
      const searchableText = `${pin.title ?? ""} ${boardName}`.toLowerCase();
      const matched = ingredients.filter((ing) =>
        searchableText.includes(ing.toLowerCase()),
      );

      if (matched.length === 0) continue;

      if (!pin.sourceLink) continue; // can't recommend a recipe with nothing to extract from

      scored.set(pin.id, {
        id: pin.id,
        title: pin.title,
        sourceLink: pin.sourceLink,
        boardId,
        boardName,
        matchedIngredients: matched,
        score: matched.length,
      });
    }
  }

  return Array.from(scored.values()).sort((a, b) => b.score - a.score);
}
```

What this is doing, step by step:

- Loops every cached board (not just one — you want candidates from anywhere in your pins, same as you'd browse across boards yourself).
- For each pin, checks the pin's title **and** its board's name together against every ingredient the user listed.
- `matched.length === 0` skips pins that don't reference any on-hand ingredient at all — no point carrying those forward.
- `!pin.sourceLink` skips pins you can't actually extract a recipe from later — no point ranking something you can't follow up on.
- Sorted descending by score, so the pin matching the most ingredients by title/board comes first.

This is still just a _title-level_ guess — it doesn't know the pin's actual ingredient list yet. That's what extraction (Session 12) is for. Think of this step as "which 5 recipes would I even bother clicking on," the way you'd skim a Pinterest board yourself before opening anything.

### Step 3 — Test it standalone

Same pattern as before — prove it works before wiring it into a tool.

- [ ] Temporary `src/scratch.ts`:

  ```ts
  import { scoredSearchByIngredients } from "./lib/pinterest-cache";

  async function main() {
    const results = await scoredSearchByIngredients(["chicken", "kale"]);
    console.log(results);
  }

  main();
  ```

- [ ] `npx tsx src/scratch.ts`
- [ ] Check: are the results sorted with the best title/board matches first? Do the `matchedIngredients` arrays look right?
- [ ] If you get zero results even though you know you have relevant pins cached, it's worth checking whether your board/pin titles actually contain the literal words you searched — this is a plain substring match, so "chicken thighs" won't match a search for "poultry" here (that synonym trick only happens at the agent level, one layer up, which is exactly why Session 12 still leaves room for the agent to retry with different words if this returns nothing useful).
- [ ] Delete `scratch.ts` once confirmed

### Step 4 — Commit

```
git add .
git commit -m "add scored multi-ingredient search across pin titles and board names"
git push
```

**Session 11 is done when:** you can pass a list of ingredients to `scoredSearchByIngredients` and get back a ranked, deduplicated list of candidate pins with real source links.

---

## Session 12 — Build the recommend-recipes tool and wire it up end to end (~2–3 hrs)

Goal: turn the ranked candidates from Session 11 into 2–3 real, verified recommendations — verified meaning you actually checked the extracted ingredient list, not just the title — with the web-search fallback kicking in when nothing matches.

### Background: this tool calls another tool directly

`extract-recipe` already exists and does exactly the extraction step you need. Rather than duplicating that logic, this new tool will call `extractRecipeTool.execute(...)` directly, the same way you'd call any other async function. One detail matters here: `extractRecipeTool`'s `execute` function has the signature `(data, { mastra })` — it needs the `mastra` instance to look up the agent it uses internally for extraction. Your new tool receives that same `mastra` reference in its own second argument, so you just pass it through.

Docs to keep open: [createTool() reference](https://mastra.ai/reference/tools/create-tool)

### Step 1 — Create the tool

New file `src/mastra/tools/recommendRecipes.ts`:

```ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { scoredSearchByIngredients } from "../../lib/pinterest-cache";
import { extractRecipeTool } from "./extractRecipe";

const MAX_CANDIDATES_TO_EXTRACT = 5;
const MAX_RECOMMENDATIONS = 3;

export const recommendRecipesTool = createTool({
  id: "recommend-recipes",
  description:
    "Given a list of ingredients the user has on hand, searches the user's cached Pinterest pins for matching recipes, verifies the top candidates by extracting their real ingredient lists, and returns the best 2-3 matches. Returns an empty recommendations array if nothing in the user's pins is a good match — in that case, fall back to the web-search tool instead.",
  inputSchema: z.object({
    ingredients: z
      .array(z.string())
      .describe(
        "Ingredients the user currently has on hand, e.g. ['chicken breast', 'kale']",
      ),
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        title: z.string(),
        sourceLink: z.string(),
        boardName: z.string(),
        matchedOnHandIngredients: z.array(z.string()),
      }),
    ),
  }),
  execute: async (inputData, context) => {
    const { ingredients } = inputData;

    const candidates = await scoredSearchByIngredients(ingredients);

    if (candidates.length === 0) {
      return { recommendations: [] };
    }

    const toExtract = candidates.slice(0, MAX_CANDIDATES_TO_EXTRACT);

    const verified: {
      title: string;
      sourceLink: string;
      boardName: string;
      matchedOnHandIngredients: string[];
      overlapScore: number;
    }[] = [];

    for (const candidate of toExtract) {
      if (!candidate.sourceLink) continue;

      try {
        const recipe = await extractRecipeTool.execute(
          { url: candidate.sourceLink },
          context,
        );

        const extractedItems = recipe.ingredients.map((i) =>
          i.item.toLowerCase(),
        );

        const matchedOnHand = ingredients.filter((onHand) =>
          extractedItems.some((item) => item.includes(onHand.toLowerCase())),
        );

        verified.push({
          title: recipe.title,
          sourceLink: candidate.sourceLink,
          boardName: candidate.boardName,
          matchedOnHandIngredients: matchedOnHand,
          overlapScore: matchedOnHand.length,
        });
      } catch (err) {
        console.error(`Extraction failed for ${candidate.sourceLink}:`, err);
        // one bad/unreachable pin shouldn't sink the whole recommendation — skip and continue
      }
    }

    verified.sort((a, b) => b.overlapScore - a.overlapScore);

    const recommendations = verified
      .slice(0, MAX_RECOMMENDATIONS)
      .map(({ overlapScore, ...rest }) => rest);

    return { recommendations };
  },
});
```

A few things worth understanding, not just copying:

- **`context` is passed straight through** from this tool's own `execute(inputData, context)` into `extractRecipeTool.execute(data, context)`. That's what gives the inner extraction call access to `mastra` — you're not constructing anything new, just forwarding what you were already given.
- **The `try/catch` around extraction matters.** Some of your top 5 title-matched candidates might have dead links, or sites that block scraping, or pages `extract-recipe` just can't parse well. Without the `catch`, one bad pin would throw and kill the entire recommendation — for a "recommend me dinner" feature, silently skipping a broken link and moving on is the right behavior, not a bug to "fix" by making it stricter.
- **`overlapScore` is stripped out before returning** (the `{ overlapScore, ...rest }` destructure) — it was only needed internally for sorting, no reason to expose it in the tool's output.
- **Why extraction happens on the top 5 candidates, not all of them:** each extraction is itself a full LLM call (recall `extractRecipeTool` internally calls `agent.generate()`). Verifying every title-match candidate would mean one user question could trigger 15-20+ model calls. Capping at 5 keeps this fast and cheap while still giving the ranking step something real to work with. If 5 feels too few once you're using this for real, it's a one-line constant to change — but bump it deliberately, not by default.
- **An empty `recommendations` array is the fallback signal.** This can happen two ways: `scoredSearchByIngredients` found literally nothing (no pin/board title matched any ingredient), or every extraction attempt failed. Either way, an empty array is what tells the agent "nothing usable here, go to the web."

### Step 2 — Wire it into the agent

In `src/mastra/agents/pantry-agent.ts`:

```ts
import { recommendRecipesTool } from "../tools/recommendRecipes";
```

Add `recommendRecipesTool` to `tools: {}`, and add this to `instructions`:

```
When the user tells you what ingredients they have on hand and asks what to make,
call recommend-recipes with those ingredients. Present the results as a short,
friendly summary of 2-3 recipes, each with its title, which board it came from,
which of the user's ingredients it uses, and a link.

If recommend-recipes returns an empty recommendations array, that means nothing
in the user's own pins was a good match. In that case, use the web-search tool to
find 2-3 recipes for those ingredients instead, and say clearly that these came
from the web rather than the user's saved pins.
```

### Step 3 — Test the full flow

- [ ] `npm run dev`, restart Studio
- [ ] Ask exactly the motivating example: "I have chicken breast and kale on hand, what should I make for dinner?"
- [ ] Watch the trace in Studio — confirm the order is: `recommend-recipes` → (internally, extraction calls, which you'll see logged from `extractRecipeTool`'s existing `console.log` lines) → a final answer with 2-3 real links
- [ ] Ask about an ingredient combination you're confident isn't reflected in any of your board/pin titles (something oddly specific) — confirm `recommend-recipes` comes back empty and the agent correctly falls through to `web-search`, and that it tells you it did
- [ ] Check the recommendations actually make sense — do the linked recipes really use the ingredients claimed? Spot check 2-3 by hand

### Step 4 — Commit

```
git add .
git commit -m "add ingredient-based recipe recommendation flow with web search fallback"
git push
```

**Session 12 is done when:** you can state ingredients you have on hand and get back 2-3 real, verified recipe recommendations from your own pins with working links — and when nothing matches, the agent transparently falls back to a general web search instead of making something up.

---

## Where things stand after Session 12

This is genuinely the core feature of the whole project working end to end: Pinterest boards → cached, pins → searchable, ingredients → matched against _real_ extracted recipe content (not just guessed from a title), with a graceful fallback when your own saved pins don't have an answer. That's a complete, demoable loop.

Worth a deliberate pause here before moving to your other stretch goals (pantry inventory, grocery list generation) — those build cleanly on top of what you now have (an inventory is really just "ingredients the user has, persisted instead of typed in each time," which slots into the same `ingredients` input this session's tool already takes), but they're a new scope, not a continuation of this one. Good stopping point to update your README/portfolio notes with what this flow can do before adding more surface area.

A couple of honest limitations worth naming if this comes up in an interview:

- **Extraction cost scales with candidates.** Capping at 5 keeps a single query reasonable, but if you ever loop this over many ingredient combinations (e.g. building the future grocery-list feature), the LLM-call count adds up fast — worth thinking about caching _extracted recipes_ the same way you cache boards/pins, so you're not re-extracting the same URL every time it shows up as a candidate.
- **Title/board matching is still just substring search**, same limitation as `search-pins` — it's why the fallback path exists at all, and it's a legitimate place to point to semantic search (`LibSQLVector`, mentioned back in Part 2) as a concrete "here's what I'd do with more time" answer.
