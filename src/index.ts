/**
 * analytics-bridge
 *
 * Main entry point: the same core engine as `/core`, plus a resolver that turns
 * `init({ providers: { ... } })` into real provider instances.
 *
 * The built-in providers are loaded with dynamic `import()`, so a bundler emits
 * them as separate chunks and an app that only configures GA4 never downloads
 * the Segment or Clarity code. For fully static, zero-chunk usage, import the
 * provider classes from their own subpaths and pass them via `customProviders`.
 */

import {
  createAnalytics as createCoreAnalytics,
  getAnalytics as getCoreAnalytics,
} from './core/Analytics';
import type {
  Analytics,
  AnalyticsEventMap,
  AnalyticsOptions,
  DefaultEventMap,
  ProviderConfig,
  ProviderResolver,
} from './core/types';
import type { GoogleAnalyticsConfig } from './providers/google-analytics/types';
import type { SegmentConfig } from './providers/segment/types';
import type { ClarityConfig } from './providers/clarity/types';

/**
 * Lazily resolves the built-in provider keys used in `init({ providers })`.
 * Unknown keys return `null`, which the client reports as a configuration
 * warning rather than an exception.
 */
const builtInProviderResolver: ProviderResolver = async (key: string, config: ProviderConfig) => {
  switch (key) {
    case 'googleAnalytics':
    case 'google-analytics':
    case 'ga4': {
      const { GoogleAnalyticsProvider } =
        await import('./providers/google-analytics/GoogleAnalyticsProvider');
      return new GoogleAnalyticsProvider(config as unknown as GoogleAnalyticsConfig);
    }
    case 'segment': {
      const { SegmentProvider } = await import('./providers/segment/SegmentProvider');
      return new SegmentProvider(config as unknown as SegmentConfig);
    }
    case 'clarity':
    case 'microsoftClarity': {
      const { ClarityProvider } = await import('./providers/clarity/ClarityProvider');
      return new ClarityProvider(config as unknown as ClarityConfig);
    }
    default:
      return null;
  }
};

/**
 * Creates an analytics instance that understands the built-in provider
 * configuration keys (`googleAnalytics`, `segment`, `clarity`).
 *
 * @example
 * ```ts
 * const analytics = createAnalytics();
 *
 * await analytics.init({
 *   providers: {
 *     googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
 *     segment: { writeKey: 'YOUR_WRITE_KEY' },
 *     clarity: { projectId: 'YOUR_PROJECT_ID' },
 *   },
 * });
 *
 * analytics.track('button_clicked', { button: 'signup' });
 * ```
 */
export function createAnalytics<TEvents extends AnalyticsEventMap = DefaultEventMap>(
  options: AnalyticsOptions = {}
): Analytics<TEvents> {
  return createCoreAnalytics<TEvents>({ resolveProvider: builtInProviderResolver, ...options });
}

/** Shared singleton instance with built-in provider support. */
export function getAnalytics<TEvents extends AnalyticsEventMap = DefaultEventMap>(
  options: AnalyticsOptions = {}
): Analytics<TEvents> {
  return getCoreAnalytics<TEvents>({ resolveProvider: builtInProviderResolver, ...options });
}

export { setAnalytics, resetAnalytics } from './core/Analytics';
export { AnalyticsClient } from './core/AnalyticsClient';
export { ConsentManager } from './core/consent';
export { DispatchQueue } from './core/queue';
export { resolveConfig, mergeConfig, isEnabledForEnvironment } from './core/config';
export {
  AnalyticsError,
  ConfigurationError,
  NonRetryableError,
  ProviderError,
  ValidationError,
  toError,
} from './core/errors';

export { BaseProvider } from './providers/BaseProvider';

export { PluginManager } from './plugins/PluginManager';
export { createLoggingPlugin } from './plugins/logging';

export { createLogger, noopLogger, isLogger, resolveLogLevel } from './utils/logger';
export { isBrowser, isServer, isOnline, isDoNotTrackEnabled, getPageInfo } from './utils/browser';
export { onHistoryChange, getCurrentUrl } from './utils/history';
export {
  sanitizeProperties,
  isSensitiveKey,
  redactForLogging,
  serializeForLog,
} from './utils/sanitize';
export { validateEventName, isValidMeasurementId } from './utils/validation';
export { createStorage } from './utils/storage';
export { loadScript } from './utils/script';
export { generateId } from './utils/id';

export {
  PACKAGE_NAME,
  AUTO_EVENTS,
  DEFAULT_REQUIRED_CONSENT,
  SENSITIVE_KEY_PATTERNS,
  LOG_PII_KEY_PATTERNS,
} from './core/constants';

export type {
  Analytics,
  AnalyticsConfig,
  AnalyticsErrorInfo,
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsEventProperties,
  AnalyticsIdentity,
  AnalyticsOptions,
  AnalyticsPrimitive,
  AnalyticsProvider,
  AutoTrackClickConfig,
  AutoTrackConfig,
  BackoffStrategy,
  BaseProviderConfig,
  BatchingConfig,
  BuiltInProvidersConfig,
  ConsentCategory,
  ConsentConfig,
  ConsentSnapshot,
  ConsentState,
  ConsentStorageType,
  CookieOptions,
  DefaultEventMap,
  DispatchContext,
  DispatchOptions,
  Environment,
  ErrorContext,
  ErrorTrackingConfig,
  EventName,
  GroupTraits,
  LogLevel,
  Logger,
  LoggerOptions,
  AnalyticsLog,
  DebugLogCategory,
  DebugLogEntry,
  DebugReport,
  IntegrationDeliveryResult,
  IntegrationDeliveryStatus,
  IntegrationSkipReason,
  IntegrationStatus,
  ResolvedLoggerOptions,
  OfflineConfig,
  PageProperties,
  PerformanceMetric,
  PerformanceTrackingConfig,
  PrivacyConfig,
  ProviderConfig,
  ProviderInitContext,
  ProviderResolver,
  ProviderStatus,
  ResolvedAnalyticsConfig,
  RetryConfig,
  StorageConfig,
  StorageType,
  TrackArgs,
  UserTraits,
} from './core/types';

export type { Plugin, PluginContext, PluginOperation, PluginPayload } from './plugins/types';

// Provider configuration types are exported for convenience; the provider
// implementations themselves live behind their own subpath exports so they are
// only bundled when actually used.
export type { GoogleAnalyticsConfig, GoogleConsentType } from './providers/google-analytics/types';
export type { SegmentConfig, SegmentAnalytics } from './providers/segment/types';
export type { ClarityConfig, ClarityConsentV2 } from './providers/clarity/types';
