const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

type ErrorWithStatus = {
  status?: unknown;
  response?: { status?: unknown };
};

function isRetryableHttpError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false;

  const { status, response } = error as ErrorWithStatus;
  const httpStatus =
    typeof status === 'number'
      ? status
      : typeof response?.status === 'number'
        ? response.status
        : undefined;

  return httpStatus === 429 || httpStatus === 503;
}

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export async function withGeminiRetry<T>(
  request: () => Promise<T>,
  wait: (delayMs: number) => Promise<void> = sleep
): Promise<T> {
  for (let retryIndex = 0; ; retryIndex++) {
    try {
      return await request();
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[retryIndex];

      if (delayMs === undefined || !isRetryableHttpError(error)) {
        throw error;
      }

      await wait(delayMs);
    }
  }
}
