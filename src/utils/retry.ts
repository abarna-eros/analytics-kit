import type { BackoffStrategy } from '../core/types';
import { NonRetryableError } from '../core/errors';

export interface RetryOptions {
  maxAttempts: number;
  backoff: BackoffStrategy;
  initialDelay: number;
  maxDelay: number;
  /** Decides whether a given failure is worth another attempt. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** Injected in tests to avoid real timers. */
  sleep?: (ms: number) => Promise<void>;
}

export function computeBackoffDelay(
  attempt: number,
  { backoff, initialDelay, maxDelay }: Pick<RetryOptions, 'backoff' | 'initialDelay' | 'maxDelay'>
): number {
  let delay: number;
  switch (backoff) {
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'fixed':
      delay = initialDelay;
      break;
    case 'exponential':
    default:
      delay = initialDelay * 2 ** (attempt - 1);
      break;
  }
  // Full jitter keeps retries from synchronising across tabs.
  const jittered = delay * (0.5 + Math.random() * 0.5);
  return Math.min(Math.round(jittered), maxDelay);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
  });

/**
 * Runs `operation` with bounded retries.
 *
 * Configuration problems ({@link NonRetryableError}) fail immediately: retrying
 * a bad measurement id or a missing write key can never succeed.
 */
export async function withRetry<T>(
  operation: () => T | Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (error instanceof NonRetryableError) throw error;
      if (attempt >= maxAttempts) break;
      if (options.shouldRetry && !options.shouldRetry(error, attempt)) break;

      const delay = computeBackoffDelay(attempt, options);
      options.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}
