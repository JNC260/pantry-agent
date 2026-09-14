import { Injectable, BadGatewayException } from '@nestjs/common';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentGenerateResponse {
  text: string;
}

@Injectable()
export class ChatService {
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
        },
      );
    } catch (err) {
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
    return result.text;
  }
}
