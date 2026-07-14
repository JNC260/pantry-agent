import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { weatherTool } from '../tools/weather-tool';
import { scorers } from '../scorers/weather-scorer';
import { getMyBoardsTool } from "../tools/getMyBoards";

export const pantryAgent = new Agent({
  id: 'pantry-agent',
  name: "Pantry Agent",
  instructions: `You are a helpful assistant for managing recipes and pantry items.
    Use the get-my-boards tool when the user asks about their Pinterest boards.`,
  model: "anthropic/claude-sonnet-4-6",
  tools: { getMyBoardsTool },
});