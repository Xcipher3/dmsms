const MAX_FETCH_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 200;
const FETCH_TIMEOUT_MS = 12_000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    const signal = init?.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal });
    }
    catch (error) {
      lastError = error;
      if (init?.signal?.aborted || attempt === MAX_FETCH_RETRIES)
        break;
      await sleep(RETRY_DELAY_BASE_MS * 2 ** attempt);
    }
  }

  throw lastError;
}
