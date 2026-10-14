import { Injectable, Logger } from '@nestjs/common';
import { postToMastra } from '../mastra/mastra-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentGenerateResponse {
  text: string;
  steps?: { text?: string }[];
  toolResults?: {
    payload?: { toolName?: string; result?: unknown; isError?: boolean };
  }[];
}

// Mastra's top-level `text` concatenates the text from every step with no
// separator, so "…its pins!" + "Found it!" ran together. Join per-step text
// with a paragraph break instead.
function replyText(result: AgentGenerateResponse): string {
  const parts = (result.steps ?? [])
    .map((step) => step.text?.trim())
    .filter((text): text is string => !!text);
  return parts.length > 0 ? parts.join('\n\n') : result.text;
}

/**
 * Relays a conversation to the Mastra agent server and returns the reply.
 * Holds no agent logic itself; the web app sends the whole conversation on
 * each request, so no history is stored here.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    const result = await postToMastra<AgentGenerateResponse>(
      '/api/agents/pantryAgent/generate',
      { messages },
    );

    const toolNames = (result.toolResults ?? []).map(
      (toolResult) => toolResult.payload?.toolName ?? 'unknown',
    );
    this.logger.log(`Tools used: ${toolNames.join(', ') || 'none'}`);

    // A failed tool call doesn't fail the request (the agent carries on
    // without it), so log it here or it's invisible.
    for (const toolResult of result.toolResults ?? []) {
      if (toolResult.payload?.isError) {
        this.logger.warn(
          `Tool ${toolResult.payload.toolName} failed: ${JSON.stringify(toolResult.payload.result).slice(0, 500)}`,
        );
      }
    }

    return replyText(result);
  }
}
