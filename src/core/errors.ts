/** Error types used to classify failures and decide whether a retry makes sense. */

export class AnalyticsError extends Error {
  readonly source: string;
  readonly cause?: unknown;

  constructor(message: string, source = 'core', cause?: unknown) {
    super(message);
    this.name = 'AnalyticsError';
    this.source = source;
    this.cause = cause;
    // Required for `instanceof` to work when targeting ES5-era output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Base class for failures that must never be retried. */
export class NonRetryableError extends AnalyticsError {
  constructor(message: string, source = 'core', cause?: unknown) {
    super(message, source, cause);
    this.name = 'NonRetryableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Invalid or missing provider configuration, e.g. a malformed measurement id. */
export class ConfigurationError extends NonRetryableError {
  constructor(message: string, source = 'core', cause?: unknown) {
    super(message, source, cause);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Invalid call arguments, e.g. an empty event name. */
export class ValidationError extends NonRetryableError {
  constructor(message: string, source = 'core', cause?: unknown) {
    super(message, source, cause);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A provider threw while handling a call. */
export class ProviderError extends AnalyticsError {
  readonly operation: string;

  constructor(message: string, provider: string, operation: string, cause?: unknown) {
    super(message, provider, cause);
    this.name = 'ProviderError';
    this.operation = operation;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Normalises anything thrown into an `Error`. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}
