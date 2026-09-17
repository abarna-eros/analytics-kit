import { LOG_PREFIX } from '../core/constants';
import type { LogLevel, Logger, LoggerOptions, ResolvedLoggerOptions } from '../core/types';
import { serializeForLog } from './sanitize';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface CreateLoggerOptions {
  level?: LogLevel;
  /** Appended to the `[Analytics]` prefix, e.g. the instance name. */
  scope?: string;
  /** Delegate that receives the formatted output. Defaults to `console`. */
  sink?: Logger;
  enabled?: boolean;
  prefix?: string;
  timestamps?: boolean;
  showPayloads?: boolean;
  redact?: boolean;
  redactKeys?: readonly string[];
  /** Invoked after a line is written; failures here are swallowed. */
  onWrite?: (level: Exclude<LogLevel, 'silent'>, message: string, metadata?: unknown) => void;
}

export type CreatedLogger = Logger & {
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  configure(options: Partial<CreateLoggerOptions>): void;
  child(scope: string): CreatedLogger;
};

function getConsoleSink(): Logger {
  return {
    debug: (message, ...args) => (console.debug ?? console.log).call(console, message, ...args),
    info: (message, ...args) => (console.info ?? console.log).call(console, message, ...args),
    warn: (message, ...args) => (console.warn ?? console.log).call(console, message, ...args),
    error: (message, ...args) => (console.error ?? console.log).call(console, message, ...args),
  };
}

/**
 * Console-backed logger with level filtering.
 *
 * Output is intentionally structured so provider/event information is readable:
 * `[Analytics] Provider: google-analytics | Event: product_viewed { ... }`.
 *
 * Every write is wrapped: a throwing sink, a circular payload or a missing
 * `console` never propagates into analytics operations.
 */
export function createLogger(options: CreateLoggerOptions = {}): CreatedLogger {
  let level: LogLevel = options.level ?? 'warn';
  let enabled = options.enabled ?? true;
  let prefix = options.prefix ?? LOG_PREFIX;
  let timestamps = options.timestamps ?? false;
  let showPayloads = options.showPayloads ?? true;
  let redact = options.redact ?? true;
  let redactKeys = options.redactKeys ?? [];
  let sink = options.sink;
  let onWrite = options.onWrite;
  const scope = options.scope;

  const enabledFor = (target: LogLevel): boolean =>
    enabled && LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[target];

  const formatPrefix = (): string => {
    const scoped = scope ? `${prefix}[${scope}]` : prefix;
    return timestamps ? `${scoped} ${new Date().toISOString()}` : scoped;
  };

  const write = (target: Exclude<LogLevel, 'silent'>, message: string, args: unknown[]): void => {
    try {
      if (!enabledFor(target)) return;

      const metadata =
        showPayloads && args.length > 0
          ? args.length === 1
            ? serializeForLog(args[0], { showPayloads, redact, redactKeys })
            : args.map((arg) => serializeForLog(arg, { showPayloads, redact, redactKeys }))
          : undefined;

      const line = `${formatPrefix()} ${message}`;
      const targetSink = sink ?? getConsoleSink();
      if (metadata === undefined) {
        targetSink[target](line);
      } else if (Array.isArray(metadata)) {
        targetSink[target](line, ...metadata);
      } else {
        targetSink[target](line, metadata);
      }

      onWrite?.(target, message, Array.isArray(metadata) ? metadata[0] : metadata);
    } catch {
      // Developer logging must never break tracking.
    }
  };

  return {
    debug: (message, ...args) => write('debug', message, args),
    info: (message, ...args) => write('info', message, args),
    warn: (message, ...args) => write('warn', message, args),
    error: (message, ...args) => write('error', message, args),
    setLevel: (next) => {
      level = next;
    },
    getLevel: () => level,
    configure: (next) => {
      if (next.level !== undefined) level = next.level;
      if (next.enabled !== undefined) enabled = next.enabled;
      if (next.prefix !== undefined) prefix = next.prefix;
      if (next.timestamps !== undefined) timestamps = next.timestamps;
      if (next.showPayloads !== undefined) showPayloads = next.showPayloads;
      if (next.redact !== undefined) redact = next.redact;
      if (next.redactKeys !== undefined) redactKeys = next.redactKeys;
      if (next.sink !== undefined) sink = next.sink;
      if (next.onWrite !== undefined) onWrite = next.onWrite;
    },
    child: (childScope: string) =>
      createLogger({
        level,
        enabled,
        prefix,
        timestamps,
        showPayloads,
        redact,
        redactKeys,
        sink,
        onWrite,
        scope: scope ? `${scope}:${childScope}` : childScope,
      }),
  };
}

/** A logger that discards everything. Useful in tests. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Maps the `debug` flag to a log level when no explicit level is configured. */
export function resolveLogLevel(debug: boolean, explicit?: LogLevel): LogLevel {
  if (explicit) return explicit;
  return debug ? 'debug' : 'warn';
}

export function isLevelEnabled(current: LogLevel, target: LogLevel): boolean {
  return LEVEL_WEIGHT[current] >= LEVEL_WEIGHT[target];
}

/** `true` when `value` implements the four {@link Logger} methods. */
export function isLogger(value: unknown): value is Logger {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Logger;
  return (
    typeof candidate.debug === 'function' &&
    typeof candidate.info === 'function' &&
    typeof candidate.warn === 'function' &&
    typeof candidate.error === 'function'
  );
}

export function resolveLoggerOptions(
  debug: boolean,
  logLevel: LogLevel | undefined,
  logger: Logger | LoggerOptions | undefined
): { options: ResolvedLoggerOptions; sink?: Logger } {
  const fromOptions = isLogger(logger) ? undefined : logger;
  const sink = isLogger(logger) ? logger : fromOptions?.logger;

  return {
    options: {
      enabled: fromOptions?.enabled ?? true,
      level: fromOptions?.level ?? resolveLogLevel(debug, logLevel),
      prefix: fromOptions?.prefix ?? LOG_PREFIX,
      timestamps: fromOptions?.timestamps ?? false,
      showPayloads: fromOptions?.showPayloads ?? true,
      redact: fromOptions?.redact ?? true,
      redactKeys: fromOptions?.redactKeys ?? [],
    },
    sink,
  };
}
