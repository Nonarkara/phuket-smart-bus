export type UpstreamRequestOptions = {
  retries?: number;
  timeoutMs?: number;
};

export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit = {},
  options: UpstreamRequestOptions = {}
) {
  const retries = options.retries ?? 1;
  const timeoutMs = options.timeoutMs ?? 5_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`http ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        throw error;
      }
    }
  }

  throw lastError;
}
