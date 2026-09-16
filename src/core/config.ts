import {
  DEFAULT_BATCH_FLUSH_INTERVAL,
  DEFAULT_BATCH_MAX_EVENTS,
  DEFAULT_BATCH_MAX_QUEUE_SIZE,
  DEFAULT_MAX_CONSENT_QUEUE,
  DEFAULT_MAX_ERRORS_PER_SESSION,
  DEFAULT_MAX_PROPERTIES,
  DEFAULT_MAX_PROPERTY_DEPTH,
  DEFAULT_OFFLINE_MAX_QUEUE_SIZE,
  DEFAULT_RETRY_INITIAL_DELAY,
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_MAX_DELAY,
  AUTO_EVENTS,
  CONSENT_STORAGE_KEY,
  OFFLINE_QUEUE_KEY,
  STORAGE_KEY_PREFIX,
} from './constants';
import type {
  AnalyticsConfig,
  Environment,
  PerformanceMetric,
  ProviderConfig,
  ResolvedAnalyticsConfig,
} from './types';
import { resolveLogLevel } from '../utils/logger';

const ALL_PERFORMANCE_METRICS: readonly PerformanceMetric[] = [
  'ttfb',
  'fcp',
  'lcp',
  'cls',
  'inp',
  'navigation',
];

/**
 * Applies defaults to a user supplied configuration.
 *
 * Defaults are deliberately conservative: nothing is collected automatically,
 * batching/retry/offline are off, and consent is required.
 */
export function resolveConfig(config: AnalyticsConfig = {}): ResolvedAnalyticsConfig {
  const debug = config.debug ?? false;
  const environment: Environment = config.environment ?? 'production';

  const providers: Record<string, ProviderConfig> = {};
  for (const [key, value] of Object.entries(config.providers ?? {})) {
    if (value) providers[key] = value as ProviderConfig;
  }

  return {
    providers,
    enabled: config.enabled ?? true,
    debug,
    logLevel: resolveLogLevel(debug, config.logLevel),
    environment,
    disableInDevelopment: config.disableInDevelopment ?? false,
    disableInTest: config.disableInTest ?? true,

    consent: {
      // Gating is enabled as soon as a `consent` block is present, so supplying
      // defaults or a storage key never silently leaves the gate open. Without
      // any consent configuration the package does not assume a CMP exists.
      required: config.consent?.required ?? config.consent !== undefined,
      defaults: config.consent?.defaults ?? {},
      queueUntilDecision: config.consent?.queueUntilDecision ?? true,
      maxQueuedCalls: config.consent?.maxQueuedCalls ?? DEFAULT_MAX_CONSENT_QUEUE,
      storage: config.consent?.storage ?? 'localStorage',
      storageKey: config.consent?.storageKey ?? CONSENT_STORAGE_KEY,
      cookie: config.consent?.cookie,
    },

    privacy: {
      optOut: config.privacy?.optOut ?? false,
      respectDoNotTrack: config.privacy?.respectDoNotTrack ?? false,
      anonymousId: config.privacy?.anonymousId ?? true,
      sanitizeProperties: config.privacy?.sanitizeProperties ?? true,
      redactKeys: config.privacy?.redactKeys ?? [],
      maxPropertyDepth: config.privacy?.maxPropertyDepth ?? DEFAULT_MAX_PROPERTY_DEPTH,
      maxProperties: config.privacy?.maxProperties ?? DEFAULT_MAX_PROPERTIES,
    },

    storage: {
      type: config.storage?.type ?? 'localStorage',
      keyPrefix: config.storage?.keyPrefix ?? STORAGE_KEY_PREFIX,
      cookie: config.storage?.cookie,
    },

    batching: {
      enabled: config.batching?.enabled ?? false,
      maxEvents: config.batching?.maxEvents ?? DEFAULT_BATCH_MAX_EVENTS,
      flushInterval: config.batching?.flushInterval ?? DEFAULT_BATCH_FLUSH_INTERVAL,
      maxQueueSize: config.batching?.maxQueueSize ?? DEFAULT_BATCH_MAX_QUEUE_SIZE,
      flushOnUnload: config.batching?.flushOnUnload ?? true,
    },

    retry: {
      enabled: config.retry?.enabled ?? false,
      maxAttempts: config.retry?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
      backoff: config.retry?.backoff ?? 'exponential',
      initialDelay: config.retry?.initialDelay ?? DEFAULT_RETRY_INITIAL_DELAY,
      maxDelay: config.retry?.maxDelay ?? DEFAULT_RETRY_MAX_DELAY,
    },

    offline: {
      enabled: config.offline?.enabled ?? false,
      persist: config.offline?.persist ?? false,
      storageKey: config.offline?.storageKey ?? OFFLINE_QUEUE_KEY,
      maxQueueSize: config.offline?.maxQueueSize ?? DEFAULT_OFFLINE_MAX_QUEUE_SIZE,
    },

    autoTrack: {
      pageViews: config.autoTrack?.pageViews ?? false,
      outboundLinks: config.autoTrack?.outboundLinks ?? false,
      clicks: config.autoTrack?.clicks ?? false,
      visibilityChange: config.autoTrack?.visibilityChange ?? false,
    },

    performanceTracking: {
      enabled: config.performanceTracking?.enabled ?? false,
      metrics: config.performanceTracking?.metrics ?? ALL_PERFORMANCE_METRICS,
      emitPerMetric: config.performanceTracking?.emitPerMetric ?? true,
      eventName: config.performanceTracking?.eventName ?? AUTO_EVENTS.PERFORMANCE,
      sampleRate: config.performanceTracking?.sampleRate ?? 1,
    },

    errorTracking: {
      captureErrors: config.errorTracking?.captureErrors ?? false,
      includeStackTrace: config.errorTracking?.includeStackTrace ?? false,
      eventName: config.errorTracking?.eventName ?? AUTO_EVENTS.ERROR,
      maxErrorsPerSession:
        config.errorTracking?.maxErrorsPerSession ?? DEFAULT_MAX_ERRORS_PER_SESSION,
    },

    defaultProperties: config.defaultProperties,
    onError: config.onError,
  };
}

/**
 * Decides whether providers should run at all in the current environment.
 * Applies `enabled`, `disableInDevelopment` and `disableInTest`.
 */
export function isEnabledForEnvironment(config: ResolvedAnalyticsConfig): boolean {
  if (!config.enabled) return false;
  if (config.disableInDevelopment && config.environment === 'development') return false;
  if (config.disableInTest && config.environment === 'test') return false;
  return true;
}

/** Merges a partial config into an already resolved one. */
export function mergeConfig(
  base: ResolvedAnalyticsConfig,
  update: AnalyticsConfig
): ResolvedAnalyticsConfig {
  const resolvedUpdate = resolveConfig(update);
  return {
    ...base,
    ...resolvedUpdate,
    providers: { ...base.providers, ...resolvedUpdate.providers },
  };
}

/** Resolves `defaultProperties` whether it is a value or a factory. */
export function resolveDefaultProperties(
  defaults: ResolvedAnalyticsConfig['defaultProperties']
): Record<string, unknown> {
  if (!defaults) return {};
  if (typeof defaults === 'function') {
    try {
      return defaults() ?? {};
    } catch {
      return {};
    }
  }
  return defaults;
}
