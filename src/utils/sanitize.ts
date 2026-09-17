import {
  DEFAULT_MAX_PROPERTIES,
  DEFAULT_MAX_PROPERTY_DEPTH,
  LOG_PII_KEY_PATTERNS,
  REDACTED_VALUE,
  SENSITIVE_KEY_PATTERNS,
} from '../core/constants';
import type { AnalyticsEventProperties } from '../core/types';

export interface SanitizeOptions {
  /** Extra key fragments to redact, in addition to the built-in list. */
  redactKeys?: readonly string[];
  maxDepth?: number;
  maxProperties?: number;
  /** Set to `false` to only apply depth/size limits without redaction. */
  redact?: boolean;
}

function buildPatterns(extra: readonly string[] = []): string[] {
  return [...SENSITIVE_KEY_PATTERNS, ...extra].map((pattern) => pattern.toLowerCase());
}

/** `true` when a property key looks like it carries sensitive data. */
export function isSensitiveKey(key: string, extra: readonly string[] = []): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]/g, '');
  return buildPatterns(extra).some((pattern) => normalized.includes(pattern.replace(/[-\s]/g, '')));
}

function sanitizeValue(
  value: unknown,
  depth: number,
  options: Required<Omit<SanitizeOptions, 'redactKeys'>> & { redactKeys: readonly string[] },
  seen: WeakSet<object>
): unknown {
  if (value === null || value === undefined) return value;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
  if (valueType === 'bigint') return String(value);
  if (valueType === 'function' || valueType === 'symbol') return undefined;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (depth >= options.maxDepth) return '[Object]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result = value
      .slice(0, options.maxProperties)
      .map((item) => sanitizeValue(item, depth + 1, options, seen));
    seen.delete(value);
    return result;
  }

  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) return '[Circular]';
    seen.add(objectValue);

    const result: Record<string, unknown> = {};
    let count = 0;
    for (const key of Object.keys(objectValue)) {
      if (count >= options.maxProperties) break;
      count += 1;
      if (options.redact && isSensitiveKey(key, options.redactKeys)) {
        result[key] = REDACTED_VALUE;
        continue;
      }
      const sanitized = sanitizeValue(objectValue[key], depth + 1, options, seen);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    seen.delete(objectValue);
    return result;
  }

  return undefined;
}

/**
 * Removes sensitive keys and enforces depth/size limits on an event payload.
 *
 * This is the last line of defence against accidentally shipping passwords,
 * tokens or card data to a third party; it runs on every dispatch by default.
 */
export function sanitizeProperties(
  properties: AnalyticsEventProperties | undefined,
  options: SanitizeOptions = {}
): AnalyticsEventProperties | undefined {
  if (!properties) return properties;

  const resolved = {
    redactKeys: options.redactKeys ?? [],
    maxDepth: options.maxDepth ?? DEFAULT_MAX_PROPERTY_DEPTH,
    maxProperties: options.maxProperties ?? DEFAULT_MAX_PROPERTIES,
    redact: options.redact ?? true,
  };

  const sanitized = sanitizeValue(properties, 0, resolved, new WeakSet<object>());
  return (sanitized ?? {}) as AnalyticsEventProperties;
}

/** Redacts sensitive values for log output without touching the original object. */
export function redactForLogging(value: unknown, extraKeys: readonly string[] = []): unknown {
  return sanitizeValue(
    value,
    0,
    {
      redactKeys: [...LOG_PII_KEY_PATTERNS, ...extraKeys],
      maxDepth: 4,
      maxProperties: 40,
      redact: true,
    },
    new WeakSet<object>()
  );
}

/**
 * Circular-safe, redacted snapshot of a value for developer logs.
 * Returns `undefined` when payloads are disabled or the value is `undefined`.
 */
export function serializeForLog(
  value: unknown,
  options: { showPayloads?: boolean; redact?: boolean; redactKeys?: readonly string[] } = {}
): unknown {
  if (value === undefined || options.showPayloads === false) return undefined;
  if (options.redact === false) {
    return sanitizeValue(
      value,
      0,
      { redactKeys: [], maxDepth: 4, maxProperties: 40, redact: false },
      new WeakSet<object>()
    );
  }
  return redactForLogging(value, options.redactKeys);
}
