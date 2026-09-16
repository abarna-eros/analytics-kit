import type {
  AnalyticsEventProperties,
  DispatchContext,
  Environment,
  GroupTraits,
  Logger,
  ResolvedAnalyticsConfig,
  UserTraits,
} from '../core/types';

/** Operation a plugin is observing. */
export type PluginOperation = 'track' | 'page' | 'identify' | 'group' | 'reset';

/** The payload a plugin may inspect, modify, or veto before dispatch. */
export interface PluginPayload {
  type: PluginOperation;
  /** Event name, page name, user id or group id, depending on `type`. */
  name?: string;
  properties?: AnalyticsEventProperties;
  context: DispatchContext;
}

/** Everything a plugin receives at initialisation. */
export interface PluginContext {
  logger: Logger;
  environment: Environment;
  debug: boolean;
  config: Readonly<ResolvedAnalyticsConfig>;
}

/**
 * Optional extension point that observes or transforms analytics calls.
 *
 * Plugins run before providers and are isolated: a throwing plugin is logged
 * and skipped, never surfaced to the caller.
 *
 * @example
 * ```ts
 * const loggingPlugin: Plugin = {
 *   name: 'logger',
 *   track(eventName, properties) {
 *     console.log(eventName, properties);
 *   },
 * };
 * analytics.use(loggingPlugin);
 * ```
 */
export interface Plugin {
  /** Unique plugin name. Registering the same name twice replaces the first. */
  readonly name: string;

  initialize?(context: PluginContext): void | Promise<void>;

  /**
   * Transforms or vetoes a call before it reaches any provider.
   * Return `false` to drop the call, a payload to replace it, or nothing to
   * leave it unchanged. Runs synchronously so dispatch is not delayed.
   */
  beforeSend?(payload: PluginPayload): PluginPayload | false | void;

  track?(
    eventName: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  page?(
    pageName?: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  identify?(userId: string, traits?: UserTraits, context?: DispatchContext): void | Promise<void>;

  group?(groupId: string, traits?: GroupTraits, context?: DispatchContext): void | Promise<void>;

  reset?(): void | Promise<void>;

  destroy?(): void | Promise<void>;
}
