import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';

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

// A recommendation can extract several recipe pages, so replies take a
// while; this only stops a hung agent from holding the request forever.
const AGENT_TIMEOUT_MS = 120_000;

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
  private readonly mastraUrl =
    process.env.MASTRA_SERVER_URL ?? 'http://localhost:4111';

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    let response: Response;

    try {
      response = await fetch(
        `${this.mastraUrl}/api/agents/pantryAgent/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
          signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
        },
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          `Mastra server did not reply within ${AGENT_TIMEOUT_MS / 1000}s`,
        );
      }
      throw new BadGatewayException(
        `Could not reach Mastra server: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadGatewayException(
        `Mastra server returned ${response.status}: ${errorText}`,
      );
    }

    const result = (await response.json()) as AgentGenerateResponse;

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
