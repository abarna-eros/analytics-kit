/**
 * Provider-agnostic entry point.
 *
 * `createAnalytics` exported here has no knowledge of the built-in providers,
 * so nothing but the core engine ends up in your bundle. Register providers
 * explicitly:
 *
 * ```ts
 * import { createAnalytics } from 'analytics-bridge/core';
 * import { GoogleAnalyticsProvider } from 'analytics-bridge/providers/google-analytics';
 *
 * const analytics = createAnalytics();
 * await analytics.init({
 *   customProviders: [new GoogleAnalyticsProvider({ measurementId: 'G-XXXXXXXXXX' })],
 * });
 * ```
 */

export { AnalyticsClient } from './AnalyticsClient';
export { createAnalytics, getAnalytics, setAnalytics, resetAnalytics } from './Analytics';
export { ConsentManager } from './consent';
export { DispatchQueue } from './queue';
export type { OperationType, QueuedCall } from './queue';
export {
  resolveConfig,
  mergeConfig,
  isEnabledForEnvironment,
  resolveDefaultProperties,
} from './config';
export {
  AnalyticsError,
  ConfigurationError,
  NonRetryableError,
  ProviderError,
  ValidationError,
  toError,
} from './errors';

export { BaseProvider } from '../providers/BaseProvider';

export { PluginManager } from '../plugins/PluginManager';
export { createLoggingPlugin } from '../plugins/logging';
export type {
  Plugin,
  PluginContext,
  PluginOperation,
  PluginPayload,
  LoggingPluginOptions,
} from '../plugins';

export { AutoTracker } from '../tracking/AutoTracker';
export { ErrorTracker } from '../tracking/ErrorTracker';
export { PerformanceTracker } from '../tracking/PerformanceTracker';

export { createLogger, noopLogger } from '../utils/logger';
export { isBrowser, isServer, isOnline, isDoNotTrackEnabled, getPageInfo } from '../utils/browser';
export { onHistoryChange, getCurrentUrl } from '../utils/history';
export { sanitizeProperties, isSensitiveKey, redactForLogging } from '../utils/sanitize';
export { validateEventName, isValidMeasurementId } from '../utils/validation';
export { createStorage } from '../utils/storage';
export { loadScript } from '../utils/script';
export { generateId } from '../utils/id';

export * from './constants';
export type * from './types';
