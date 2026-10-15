import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';

// A recommendation can extract several recipe pages, and a receipt can run
// to dozens of items, so replies take a while; this only stops a hung agent
// from holding the request forever.
const AGENT_TIMEOUT_MS = 120_000;

/**
 * Sends a request to the Mastra server and returns the parsed reply. A
 * timeout becomes a 504, and an unreachable server or non-2xx reply a 502.
 */
async function requestMastra<T>(path: string, init: RequestInit): Promise<T> {
  const mastraUrl = process.env.MASTRA_SERVER_URL ?? 'http://localhost:4111';
  let response: Response;

  try {
    response = await fetch(`${mastraUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    });
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

  return (await response.json()) as T;
}

/** POSTs JSON to the Mastra server (see requestMastra for errors). */
export function postToMastra<T>(path: string, body: unknown): Promise<T> {
  return requestMastra<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** GETs from the Mastra server (see requestMastra for errors). */
export function getFromMastra<T>(path: string): Promise<T> {
  return requestMastra<T>(path, { method: 'GET' });
}
