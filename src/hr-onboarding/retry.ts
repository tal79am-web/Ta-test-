import { ToolError } from "./tools";

export interface RetryPolicy {
  /** Retries after the first attempt. The spec caps this at 3. */
  retries: number;
  baseDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

export type RetryOutcome<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number };

/** Retries transient failures with exponential backoff. Non-retryable ToolErrors stop at once. */
export async function withRetry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<RetryOutcome<T>> {
  const sleep = policy.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      return { ok: true, value: await fn(), attempts };
    } catch (error) {
      const retryable = !(error instanceof ToolError) || error.retryable;
      if (!retryable || attempts > policy.retries) return { ok: false, error, attempts };
      await sleep(policy.baseDelayMs * 2 ** (attempts - 1));
    }
  }
}
