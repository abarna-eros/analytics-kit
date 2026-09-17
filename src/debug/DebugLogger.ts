import { DEFAULT_DEBUG_LOG_LIMIT } from '../core/constants';
import type {
  AnalyticsLog,
  DebugLogCategory,
  DebugLogEntry,
  LogLevel,
  Logger,
  ResolvedLoggerOptions,
} from '../core/types';
import { createLogger, isLevelEnabled, type CreatedLogger } from '../utils/logger';
import { serializeForLog } from '../utils/sanitize';

export interface DebugLoggerInit {
  scope?: string;
  options?: ResolvedLoggerOptions;
  sink?: Logger;
}

/**
 * Structured developer logger used by the analytics client.
 *
 * Implements {@link Logger} so it can be handed to providers and plugins, and
 * exposes the public {@link AnalyticsLog} namespace plus a ring buffer for
 * debug reports. Every method swallows its own failures.
 */
export class DebugLogger implements Logger {
  private inner: CreatedLogger;
  private options: ResolvedLoggerOptions;
  private sink?: Logger;
  private readonly scope?: string;
  private readonly entries: DebugLogEntry[] = [];

  constructor(init: DebugLoggerInit = {}) {
    this.scope = init.scope;
    this.options = init.options ?? {
      enabled: true,
      level: 'warn',
      prefix: '[Analytics]',
      timestamps: false,
      showPayloads: true,
      redact: true,
      redactKeys: [],
    };
    this.sink = init.sink;
    this.inner = this.createInner();
  }

  configure(options: ResolvedLoggerOptions, sink?: Logger): void {
    this.options = options;
    if (sink !== undefined) this.sink = sink;
    this.inner.configure({ ...options, sink: this.sink });
  }

  getOptions(): ResolvedLoggerOptions {
    return this.options;
  }

  getEntries(): readonly DebugLogEntry[] {
    return this.entries.slice();
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', 'log', message, args[0]);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', 'log', message, args[0]);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', 'log', message, args[0]);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('error', 'log', message, args[0]);
  }

  action(
    level: Exclude<LogLevel, 'silent'>,
    category: DebugLogCategory,
    message: string,
    metadata?: unknown
  ): void {
    this.write(level, category, message, metadata);
  }

  asPublicApi(): AnalyticsLog {
    return {
      debug: (message, metadata) => this.action('debug', 'log', message, metadata),
      info: (message, metadata) => this.action('info', 'log', message, metadata),
      warn: (message, metadata) => this.action('warn', 'log', message, metadata),
      error: (message, metadata) => this.action('error', 'log', message, metadata),
      event: (eventName, payload) => this.action('info', 'event', `event: ${eventName}`, payload),
      view: (viewName, payload) => this.action('info', 'view', `view: ${viewName}`, payload),
      identify: (userId, traits) =>
        this.action('info', 'identify', `identify: ${userId ?? '(anonymous)'}`, traits),
    };
  }

  private write(
    level: Exclude<LogLevel, 'silent'>,
    category: DebugLogCategory,
    message: string,
    metadata?: unknown
  ): void {
    try {
      if (!this.options.enabled || !isLevelEnabled(this.options.level, level)) return;
      this.record(level, category, message, metadata);
      if (metadata === undefined) this.inner[level](message);
      else this.inner[level](message, metadata);
    } catch {
      // Developer logging must never break tracking.
    }
  }

  private createInner(): CreatedLogger {
    return createLogger({
      ...this.options,
      scope: this.scope,
      sink: this.sink,
    });
  }

  private record(
    level: Exclude<LogLevel, 'silent'>,
    category: DebugLogCategory,
    message: string,
    metadata?: unknown
  ): void {
    try {
      const safeMetadata = serializeForLog(metadata, this.options);
      this.entries.push({
        timestamp: Date.now(),
        level,
        category,
        message,
        ...(safeMetadata !== undefined ? { metadata: safeMetadata } : {}),
      });
      if (this.entries.length > DEFAULT_DEBUG_LOG_LIMIT) {
        this.entries.splice(0, this.entries.length - DEFAULT_DEBUG_LOG_LIMIT);
      }
    } catch {
      // never throw
    }
  }
}
