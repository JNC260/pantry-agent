import { GatewayTimeoutException, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

function mockMastraResponse(body: unknown) {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('ChatService', () => {
  const service = new ChatService();
  const messages = [{ role: 'user' as const, content: 'hi' }];

  afterEach(() => jest.restoreAllMocks());

  it('joins text from each step with a paragraph break', async () => {
    mockMastraResponse({
      text: 'Let me find your board!Found it!',
      steps: [
        { text: 'Let me find your board!' },
        { text: '' },
        { text: 'Found it!' },
      ],
    });

    await expect(service.sendMessage(messages)).resolves.toBe(
      'Let me find your board!\n\nFound it!',
    );
  });

  it('falls back to text when steps are missing', async () => {
    mockMastraResponse({ text: 'Hello' });

    await expect(service.sendMessage(messages)).resolves.toBe('Hello');
  });

  it('logs failed tool calls', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    mockMastraResponse({
      text: 'ok',
      toolResults: [
        { payload: { toolName: 'get-boards', result: [], isError: false } },
        {
          payload: {
            toolName: 'generate-grocery-list',
            result: { message: 'Tavily could not extract' },
            isError: true,
          },
        },
      ],
    });

    await service.sendMessage(messages);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Tool generate-grocery-list failed',
    );
  });

  it('reports a hung agent as a gateway timeout', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    await expect(service.sendMessage(messages)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });
});
