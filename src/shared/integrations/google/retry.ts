/**
 * Retry das chamadas Google (Drive/Docs) — mesma política do `docsBatchUpdateWithRetry`
 * do Salesbud: só 429 (quota), 503 (indisponível) e 408 (timeout) são transitórios;
 * backoff exponencial `1500ms · 2^(n-1)` com teto de 60s + jitter de até 300ms, 8
 * tentativas. Puro (sem `server-only`): testável com `sleep`/`random` injetados.
 */

export const GOOGLE_RETRY_DEFAULTS = {
  maxAttempts: 8,
  baseDelayMs: 1500,
  maxDelayMs: 60_000,
  jitterMs: 300,
} as const;

export type GoogleRetryOptions = Partial<
  Record<keyof typeof GOOGLE_RETRY_DEFAULTS, number>
> & {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; status: number }) => void;
};

/** Status HTTP de um erro do googleapis (gaxios), em qualquer um dos formatos que ele usa. */
export function googleErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as {
    response?: { status?: number; data?: { error?: { code?: number } } };
    code?: number | string;
    status?: number;
  };
  if (typeof e.response?.status === "number") return e.response.status;
  if (typeof e.response?.data?.error?.code === "number")
    return e.response.data.error.code;
  if (typeof e.code === "number") return e.code;
  if (typeof e.status === "number") return e.status;
  return undefined;
}

export function isRetriableGoogleStatus(status: number | undefined): boolean {
  return status === 429 || status === 503 || status === 408;
}

/** Espera antes da tentativa `attempt + 1` (sem jitter). */
export function googleBackoffDelay(
  attempt: number,
  options: Pick<GoogleRetryOptions, "baseDelayMs" | "maxDelayMs"> = {},
): number {
  const base = options.baseDelayMs ?? GOOGLE_RETRY_DEFAULTS.baseDelayMs;
  const max = options.maxDelayMs ?? GOOGLE_RETRY_DEFAULTS.maxDelayMs;
  return Math.min(base * 2 ** (attempt - 1), max);
}

export async function withGoogleRetry<T>(
  operation: () => Promise<T>,
  options: GoogleRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? GOOGLE_RETRY_DEFAULTS.maxAttempts;
  const jitterMs = options.jitterMs ?? GOOGLE_RETRY_DEFAULTS.jitterMs;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = googleErrorStatus(error);
      if (attempt >= maxAttempts || !isRetriableGoogleStatus(status)) throw error;
      const delayMs =
        googleBackoffDelay(attempt, options) + Math.floor(random() * jitterMs);
      options.onRetry?.({ attempt, delayMs, status: status! });
      await sleep(delayMs);
    }
  }
}
