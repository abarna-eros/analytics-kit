import { LOG_PREFIX } from '../core/constants';
import { redactForLogging } from '../utils/sanitize';
import type { Plugin } from './types';

export interface LoggingPluginOptions {
  /** Plugin name, in case several logging plugins are registered. @default 'logging' */
  name?: string;
  /** Where to write. @default console.log */
  write?: (message: string, payload?: unknown) => void;
  /** Redact known-sensitive keys before writing. @default true */
  redact?: boolean;
}

/**
 * Example plugin that logs every analytics call.
 *
 * Useful during development and as a reference implementation for custom
 * plugins.
 *
 * @example
 * ```ts
 * analytics.use(createLoggingPlugin());
 * ```
 */
export function createLoggingPlugin(options: LoggingPluginOptions = {}): Plugin {
  const write =
    options.write ??
    ((message: string, payload?: unknown) => {
      if (payload === undefined) console.log(message);
      else console.log(message, payload);
    });

  const format = (payload: unknown): unknown =>
    options.redact === false ? payload : redactForLogging(payload);

  return {
    name: options.name ?? 'logging',

    track(eventName, properties) {
      write(`${LOG_PREFIX} track: ${eventName}`, format(properties));
    },
    page(pageName, properties) {
      write(`${LOG_PREFIX} page: ${pageName ?? '(current)'}`, format(properties));
    },
    identify(userId, traits) {
      write(`${LOG_PREFIX} identify: ${userId}`, format(traits));
    },
    group(groupId, traits) {
      write(`${LOG_PREFIX} group: ${groupId}`, format(traits));
    },
    reset() {
      write(`${LOG_PREFIX} reset`);
    },
  };
}
