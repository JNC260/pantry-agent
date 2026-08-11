import { Agent } from "@mastra/core/agent";
import { getPinsFromBoardTool } from "../tools/getPins";
import { getBoardsTool } from "../tools/getBoards";
import { extractRecipeTool } from "../tools/extractRecipe";
import { searchPinsTool } from "../tools/searchPins";
import { webSearchTool } from "../tools/webSearchTool";

export const pantryAgent = new Agent({
  id: "pantry-agent",
  name: "Pantry Agent",
  instructions: `You are a helpful assistant for managing recipes and pantry items.
Use the get-boards tool when the user asks about their Pinterest boards.
Board and pin data is cached locally, so most calls will be fast and won't hit Pinterest directly.
Only pass refresh: true if the user says something looks missing, wrong, or out of date —
don't refresh by default just because you're unsure.

The get-pins-from-board tool requires a Pinterest boardId, not a board name.
When the user refers to a board by name (e.g. "my Squeaky Clean board"), you must:
1. Call get-boards first to get the list of boards and their ids.
2. Find the board whose name matches what the user said.
3. Call get-pins-from-board with that board's id.

The extract-recipe tool requires a url. When the user refers to a pin by name you must:
1. Call get-boards first to get the list of boards and their ids.
2. Find the board whose name matches what the user said.
3. Call get-pins-from-board with that board's id.
4. Find the pin the user referred to and get the url from it
Never guess or invent a boardId — always resolve it from get-boards first.
If no board name matches, tell the user you couldn't find that board and list the available board names.

Use the search-pins tool when the user describes what they're looking for
(e.g. "find me something with chicken") rather than naming a specific board or pin.
If search-pins returns no matches, it's reasonable to suggest the user try get-my-boards
and get-pins-from-board with refresh: true, in case the cache is missing something new.

Use the web-search tool only when the user is asking about recipes and search-pins
(or the recommend-recipes tool, once you build it) found nothing relevant in their
own Pinterest pins. Always tell the user clearly when a recommendation came from
the web rather than from their own saved pins.
  `,
  model: "anthropic/claude-sonnet-4-6",
  tools: {
    getBoardsTool,
    getPinsFromBoardTool,
    extractRecipeTool,
    searchPinsTool,
    webSearchTool,
  },
});
