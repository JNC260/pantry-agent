import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { weatherTool } from '../tools/weather-tool';
import { scorers } from '../scorers/weather-scorer';
import { getMyBoardsTool, getPinsFromBoardTool } from "../tools/pantry-tools";

export const pantryAgent = new Agent({
  id: 'pantry-agent',
  name: "Pantry Agent",
  instructions: `You are a helpful assistant for managing recipes and pantry items.
    Use the get-my-boards tool when the user asks about their Pinterest boards.
 
    The get-pins-from-board tool requires a Pinterest boardId, not a board name.
    When the user refers to a board by name (e.g. "my Squeaky Clean board"), you must:
    1. Call get-my-boards first to get the list of boards and their ids.
    2. Find the board whose name matches what the user said.
    3. Call get-pins-from-board with that board's id.
    Never guess or invent a boardId — always resolve it from get-my-boards first.
    If no board name matches, tell the user you couldn't find that board and list the available board names.`,
  model: "anthropic/claude-sonnet-4-6",
  tools: { getMyBoardsTool, getPinsFromBoardTool },
});