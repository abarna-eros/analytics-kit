import { LOG_PREFIX } from '../core/constants';
import type { LogLevel, Logger } from '../core/types';

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
}

/**
 * Console-backed logger with level filtering.
 *
 * Output is intentionally structured so provider/event information is readable:
 * `[Analytics] Provider: google-analytics | Event: product_viewed { ... }`.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger & {
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  child(scope: string): Logger;
} {
  let level: LogLevel = options.level ?? 'warn';
  const scope = options.scope;
  const prefix = scope ? `${LOG_PREFIX}[${scope}]` : LOG_PREFIX;
  const sink = options.sink;

  const enabled = (target: LogLevel): boolean => LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[target];

  const write = (target: Exclude<LogLevel, 'silent'>, message: string, args: unknown[]): void => {
    if (!enabled(target)) return;
    if (sink) {
      sink[target](`${prefix} ${message}`, ...args);
      return;
    }
    const method = console[target] ?? console.log;
    method.call(console, `${prefix} ${message}`, ...args);
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
    child: (childScope: string) =>
      createLogger({ level, scope: scope ? `${scope}:${childScope}` : childScope, sink }),
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
