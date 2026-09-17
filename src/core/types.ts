/**
 * Public type surface of the analytics package.
 *
 * Everything here is runtime-free: this module compiles away entirely, which is
 * why the core is allowed to reference built-in provider configuration shapes
 * without creating a runtime dependency on those providers.
 */

import type { ClarityConfig } from '../providers/clarity/types';
import type { GoogleAnalyticsConfig } from '../providers/google-analytics/types';
import type { SegmentConfig } from '../providers/segment/types';
import type { Plugin } from '../plugins/types';

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** A value that is safe to send to an analytics backend. */
export type AnalyticsPrimitive = string | number | boolean | null | undefined;

/** Arbitrary event payload. Values are `unknown` so consumers must narrow. */
export type AnalyticsEventProperties = Record<string, unknown>;

/** Traits attached to a user via {@link Analytics.identify}. */
export type UserTraits = Record<string, unknown>;

/** Traits attached to a group/account via {@link Analytics.group}. */
export type GroupTraits = Record<string, unknown>;

/** Runtime environment the host application is running in. */
export type Environment = 'development' | 'test' | 'production' | (string & {});

/* -------------------------------------------------------------------------- */
/* Typed event maps                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Shape of an application specific event map.
 *
 * @example
 * ```ts
 * type AppEvents = {
 *   button_clicked: { buttonName: string; location: string };
 *   checkout_started: { cartValue: number };
 *   app_opened: void; // no properties
 * };
 * ```
 */
export type AnalyticsEventMap = Record<string, AnalyticsEventProperties | void>;

/** Default (unconstrained) event map used when no generic argument is supplied. */
export interface DefaultEventMap {
  [eventName: string]: AnalyticsEventProperties;
}

/** Valid event names for a given event map. */
export type EventName<TEvents extends AnalyticsEventMap> = keyof TEvents & string;

/**
 * Argument tuple for {@link Analytics.track}. Events declared as `void` (or with
 * no required properties) make the payload optional; everything else requires it.
 */
export type TrackArgs<
  TEvents extends AnalyticsEventMap,
  TName extends EventName<TEvents>,
> = TEvents[TName] extends void | undefined
  ? [properties?: undefined, options?: DispatchOptions]
  : Record<string, never> extends TEvents[TName]
    ? [properties?: TEvents[TName], options?: DispatchOptions]
    : [properties: TEvents[TName], options?: DispatchOptions];

/** A single tracked event, as seen by plugins and queue consumers. */
export interface AnalyticsEvent<TProperties = AnalyticsEventProperties> {
  name: string;
  properties?: TProperties;
  /** Milliseconds since epoch, captured when the call was made. */
  timestamp: number;
}

/* -------------------------------------------------------------------------- */
/* Consent                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Consent categories. The three built-in categories cover the common CMP
 * taxonomy; custom string categories are accepted for bespoke setups.
 */
export type ConsentCategory = 'analytics' | 'marketing' | 'personalization' | (string & {});

/** Per-category consent decisions. Missing keys mean "no decision yet". */
export type ConsentState = Partial<Record<ConsentCategory, boolean>>;

/** Immutable view of the current consent decisions. */
export interface ConsentSnapshot {
  /** Category decisions recorded so far. */
  categories: ConsentState;
  /** `true` once {@link Analytics.setConsent} has been called at least once. */
  decided: boolean;
  /** When the decision was recorded (ms since epoch), if any. */
  updatedAt?: number;
}

/** Where consent decisions are persisted between page loads. */
export type ConsentStorageType = 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';

export interface CookieOptions {
  domain?: string;
  path?: string;
  /** Lifetime in days. */
  expires?: number;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
}

export interface ConsentConfig {
  /**
   * Turn the consent gate on/off. When `false` every category is treated as
   * granted and providers initialise immediately.
   *
   * @default true when a `consent` block is present in the config, otherwise false
   */
  required?: boolean;
  /**
   * Decisions applied before the user answers. Anything omitted counts as
   * denied while {@link ConsentConfig.required} is `true`.
   */
  defaults?: ConsentState;
  /**
   * Buffer calls made before a consent decision and replay them if consent is
   * later granted. Nothing reaches a provider before it is allowed to run.
   * @default true
   */
  queueUntilDecision?: boolean;
  /** Maximum number of buffered calls held while awaiting a decision. */
  maxQueuedCalls?: number;
  /** Persistence backend for the decision. @default 'localStorage' */
  storage?: ConsentStorageType;
  /** Storage key / cookie name. */
  storageKey?: string;
  /** Cookie attributes, used when `storage: 'cookie'`. */
  cookie?: CookieOptions;
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                     */
/* -------------------------------------------------------------------------- */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/** Minimal logger contract. Supply your own to route logs anywhere. */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Developer-logging configuration.
 *
 * Passed as {@link AnalyticsConfig.logger}. A bare {@link Logger} is still
 * accepted there for backwards compatibility.
 */
export interface LoggerOptions {
  /** Master switch for developer logging. @default true */
  enabled?: boolean;
  /** Minimum level that is written. @default derived from `debug` / `logLevel` */
  level?: LogLevel;
  /** Prefix printed before every message. @default '[Analytics]' */
  prefix?: string;
  /** Prepend an ISO-8601 timestamp. @default false */
  timestamps?: boolean;
  /** Include (redacted) payloads in log output. @default true */
  showPayloads?: boolean;
  /** Custom sink. Must implement {@link Logger}. Defaults to `console`. */
  logger?: Logger;
  /**
   * Extra key fragments to redact in log output, on top of the built-in
   * password/token/card/email/phone list.
   */
  redactKeys?: readonly string[];
  /** Redact known-sensitive keys in payloads. @default true */
  redact?: boolean;
}

/** Public developer-log namespace on {@link Analytics.log}. */
export interface AnalyticsLog {
  debug(message: string, metadata?: unknown): void;
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
  /** Log an application event for debugging. Does not send it to providers. */
  event(eventName: string, payload?: unknown): void;
  /** Log a view/screen for debugging. Does not send it to providers. */
  view(viewName: string, payload?: unknown): void;
  /** Log an identify call for debugging. Does not send it to providers. */
  identify(userId?: string, traits?: unknown): void;
}

export type DebugLogCategory =
  | 'log'
  | 'init'
  | 'track'
  | 'page'
  | 'identify'
  | 'group'
  | 'reset'
  | 'consent'
  | 'delivery'
  | 'event'
  | 'view';

export interface DebugLogEntry {
  timestamp: number;
  level: Exclude<LogLevel, 'silent'>;
  category: DebugLogCategory;
  message: string;
  metadata?: unknown;
}

export type IntegrationDeliveryStatus = 'success' | 'skipped' | 'unavailable' | 'failed';

export type IntegrationSkipReason =
  | 'disabled'
  | 'consent'
  | 'environment'
  | 'opted_out'
  | 'unavailable'
  | 'not_initialized'
  | 'filtered'
  | 'unsupported'
  | 'ssr'
  | 'destroyed'
  | 'buffered';

/** Outcome of delivering one call to one integration. */
export interface IntegrationDeliveryResult {
  status: IntegrationDeliveryStatus;
  operation?: string;
  reason?: IntegrationSkipReason | string;
  at: number;
  error?: string;
}

/**
 * Richer snapshot than {@link ProviderStatus}: includes SDK availability,
 * skip reasons and the last delivery attempt.
 */
export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  initialized: boolean;
  /** `true` when the provider initialized and can receive data. */
  available: boolean;
  consentGranted: boolean;
  requiredConsent: readonly ConsentCategory[];
  skippedReason?: IntegrationSkipReason | string;
  lastError?: string;
  lastDelivery?: IntegrationDeliveryResult;
}

/** Point-in-time dump of logger state, identity and every integration. */
export interface DebugReport {
  generatedAt: number;
  packageName: string;
  instanceName: string;
  environment: Environment;
  debug: boolean;
  logLevel: LogLevel;
  logger: ResolvedLoggerOptions;
  initialized: boolean;
  enabled: boolean;
  optedOut: boolean;
  ssr: boolean;
  identity: {
    userId: string | null;
    anonymousId: string | null;
    groupId: string | null;
  };
  consent: ConsentSnapshot;
  integrations: readonly IntegrationStatus[];
  unresolvedProviders: readonly { key: string; reason: string }[];
  queueSize: number;
  recentLogs: readonly DebugLogEntry[];
}

export interface ResolvedLoggerOptions {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  timestamps: boolean;
  showPayloads: boolean;
  redact: boolean;
  redactKeys: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Providers                                                                   */
/* -------------------------------------------------------------------------- */

/** Extra context handed to providers alongside every call. */
export interface DispatchContext {
  /** Stable pseudonymous id, unless anonymous ids are disabled. */
  anonymousId?: string;
  /** Currently identified user, if any. */
  userId?: string | null;
  /** Milliseconds since epoch, captured when the original call was made. */
  timestamp: number;
  /** Current consent decisions. */
  consent: ConsentSnapshot;
}

/** Everything a provider needs at initialisation time. */
export interface ProviderInitContext<TConfig = unknown> {
  config: TConfig;
  logger: Logger;
  environment: Environment;
  debug: boolean;
  consent: ConsentSnapshot;
  anonymousId?: string;
}

/**
 * The single interface every analytics destination implements.
 *
 * Only `name`, `initialize`, `track`, `page` and `identify` are required; the
 * rest are optional capabilities the core detects at runtime.
 */
export interface AnalyticsProvider<TConfig = unknown> {
  /** Unique key used by {@link Analytics.provider} and logging. */
  readonly name: string;

  /**
   * Consent categories that must be granted before this provider is initialised
   * or receives any data. Defaults to `['analytics']` when omitted.
   */
  readonly requiredConsent?: readonly ConsentCategory[];

  initialize(context: ProviderInitContext<TConfig>): void | Promise<void>;

  track(
    eventName: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  page(
    pageName?: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  identify(userId: string, traits?: UserTraits, context?: DispatchContext): void | Promise<void>;

  group?(groupId: string, traits?: GroupTraits, context?: DispatchContext): void | Promise<void>;

  reset?(): void | Promise<void>;

  /** Called whenever consent changes, so providers can update their own gates. */
  setConsent?(consent: ConsentSnapshot): void | Promise<void>;

  flush?(): Promise<void>;

  destroy?(): void | Promise<void>;
}

/** Options every built-in provider config accepts. */
export interface BaseProviderConfig {
  /** Set to `false` to register the provider but never call it. @default true */
  enabled?: boolean;
  /** Override the consent categories required by this provider. */
  requiredConsent?: readonly ConsentCategory[];
  /** Provider-scoped debug logging. Falls back to the global `debug` flag. */
  debug?: boolean;
}

/** Configuration accepted for a single provider. */
export type ProviderConfig = BaseProviderConfig & Record<string, unknown>;

/** Configuration block for the providers that ship with the package. */
export interface BuiltInProvidersConfig {
  googleAnalytics?: GoogleAnalyticsConfig;
  segment?: SegmentConfig;
  clarity?: ClarityConfig;
}

/**
 * Resolves a configured provider key into a provider instance. The root entry
 * point supplies a resolver that lazily imports the built-in providers.
 */
export type ProviderResolver = (
  key: string,
  config: ProviderConfig
) => AnalyticsProvider | null | Promise<AnalyticsProvider | null>;

/* -------------------------------------------------------------------------- */
/* Feature configuration                                                       */
/* -------------------------------------------------------------------------- */

export interface BatchingConfig {
  /** @default false */
  enabled?: boolean;
  /** Flush once this many calls are queued. @default 10 */
  maxEvents?: number;
  /** Flush at most this many ms after the first queued call. @default 5000 */
  flushInterval?: number;
  /** Hard cap on the queue; oldest entries are dropped past this. @default 100 */
  maxQueueSize?: number;
  /** Flush on `pagehide` / `visibilitychange` so queued calls are not lost. @default true */
  flushOnUnload?: boolean;
}

export type BackoffStrategy = 'exponential' | 'linear' | 'fixed';

export interface RetryConfig {
  /** @default false */
  enabled?: boolean;
  /** Total attempts including the first one. @default 3 */
  maxAttempts?: number;
  /** @default 'exponential' */
  backoff?: BackoffStrategy;
  /** Base delay in ms. @default 500 */
  initialDelay?: number;
  /** Upper bound for a single delay in ms. @default 10000 */
  maxDelay?: number;
}

export interface OfflineConfig {
  /** Queue calls while `navigator.onLine` is false. @default false */
  enabled?: boolean;
  /** Persist the offline queue so it survives a reload. @default false */
  persist?: boolean;
  /** Storage key used when `persist` is enabled. */
  storageKey?: string;
  /** Maximum number of offline calls retained. @default 50 */
  maxQueueSize?: number;
}

export interface AutoTrackClickConfig {
  /**
   * Only elements matching this selector are tracked, which keeps the listener
   * cheap and avoids capturing unrelated UI noise.
   * @default '[data-analytics-event]'
   */
  selector?: string;
  /** Attribute holding the event name. @default 'data-analytics-event' */
  eventAttribute?: string;
  /** Prefix for attributes turned into properties. @default 'data-analytics-' */
  propertyPrefix?: string;
}

export interface AutoTrackConfig {
  /** Track a page view on load and on history navigation. @default false */
  pageViews?: boolean;
  /** Track clicks on links pointing at another origin. @default false */
  outboundLinks?: boolean;
  /** Track clicks on opted-in elements. @default false */
  clicks?: boolean | AutoTrackClickConfig;
  /** Track `visibilitychange` transitions. @default false */
  visibilityChange?: boolean;
}

export type PerformanceMetric = 'ttfb' | 'fcp' | 'lcp' | 'cls' | 'inp' | 'navigation';

export interface PerformanceTrackingConfig {
  /** @default false */
  enabled?: boolean;
  /** Metrics to collect. @default ['ttfb','fcp','lcp','cls','inp','navigation'] */
  metrics?: readonly PerformanceMetric[];
  /** Emit one event per metric instead of a single summary event. @default true */
  emitPerMetric?: boolean;
  /** Event name used for metric events. @default 'performance_metric' */
  eventName?: string;
  /** Sample rate between 0 and 1. @default 1 */
  sampleRate?: number;
}

export interface ErrorTrackingConfig {
  /**
   * Attach global `error` / `unhandledrejection` listeners.
   * @default false
   */
  captureErrors?: boolean;
  /**
   * Include `error.stack` on error events. Stacks can contain user data and
   * source paths, so this is opt-in.
   * @default false
   */
  includeStackTrace?: boolean;
  /** Event name used for error events. @default 'error_occurred' */
  eventName?: string;
  /** Maximum error events emitted per page load. @default 10 */
  maxErrorsPerSession?: number;
}

export interface PrivacyConfig {
  /** Start opted out; no provider receives data until {@link Analytics.optIn}. @default false */
  optOut?: boolean;
  /** Honour the browser `navigator.doNotTrack` signal. @default false */
  respectDoNotTrack?: boolean;
  /** Generate and persist a pseudonymous id. @default true */
  anonymousId?: boolean;
  /** Redact known-sensitive property keys before dispatch. @default true */
  sanitizeProperties?: boolean;
  /** Extra property keys (case-insensitive) to redact. */
  redactKeys?: readonly string[];
  /** Maximum object depth retained in properties. @default 5 */
  maxPropertyDepth?: number;
  /** Maximum number of keys retained per object. @default 100 */
  maxProperties?: number;
}

export type StorageType = 'localStorage' | 'sessionStorage' | 'cookie' | 'memory' | 'none';

export interface StorageConfig {
  /** Backend for the anonymous id and offline queue. @default 'localStorage' */
  type?: StorageType;
  /** Prefix for all keys written by the package. @default 'ak_analytics' */
  keyPrefix?: string;
  /** Cookie attributes, used when `type: 'cookie'`. */
  cookie?: CookieOptions;
}

/* -------------------------------------------------------------------------- */
/* Analytics configuration                                                     */
/* -------------------------------------------------------------------------- */

export interface AnalyticsConfig {
  /**
   * Built-in providers, keyed by provider name. Unknown keys are forwarded to
   * the configured {@link ProviderResolver}, which is how third-party providers
   * can also be configured declaratively.
   */
  providers?: BuiltInProvidersConfig & Record<string, ProviderConfig | undefined>;

  /** Provider instances to register directly (no resolver involved). */
  customProviders?: readonly AnalyticsProvider[];

  /** Plugins registered before initialisation. */
  plugins?: readonly Plugin[];

  /** Master switch. When `false` every call becomes a no-op. @default true */
  enabled?: boolean;

  /** Enables verbose `[Analytics]` logging. @default false */
  debug?: boolean;

  /** Explicit log level; overrides the level implied by `debug`. */
  logLevel?: LogLevel;

  /**
   * Developer logger.
   *
   * Accepts a {@link Logger} instance (backwards compatible) or a
   * {@link LoggerOptions} object for prefix, timestamps, payload visibility
   * and redaction.
   */
  logger?: Logger | LoggerOptions;

  /** Usually `process.env.NODE_ENV`. @default 'production' */
  environment?: Environment;

  /** Disable all providers when `environment === 'development'`. @default false */
  disableInDevelopment?: boolean;

  /** Disable all providers when `environment === 'test'`. @default true */
  disableInTest?: boolean;

  consent?: ConsentConfig;
  privacy?: PrivacyConfig;
  storage?: StorageConfig;
  batching?: BatchingConfig;
  retry?: RetryConfig;
  offline?: OfflineConfig;
  autoTrack?: AutoTrackConfig;
  performanceTracking?: PerformanceTrackingConfig;
  errorTracking?: ErrorTrackingConfig;

  /** Properties merged into every event. Use a function for dynamic values. */
  defaultProperties?: AnalyticsEventProperties | (() => AnalyticsEventProperties);

  /** Called when a provider throws, instead of the default logger warning. */
  onError?: (error: AnalyticsErrorInfo) => void;
}

/** Details passed to {@link AnalyticsConfig.onError}. */
export interface AnalyticsErrorInfo {
  error: unknown;
  /** Provider name, plugin name, or `'core'`. */
  source: string;
  /** The operation that failed, e.g. `'track'`. */
  operation: string;
}

/** Options for a single dispatch call. */
export interface DispatchOptions {
  /** Restrict this call to the named providers. */
  only?: readonly string[];
  /** Skip the named providers for this call. */
  except?: readonly string[];
  /** Bypass batching and dispatch immediately. */
  immediate?: boolean;
}

/** Options accepted by {@link createAnalytics}. */
export interface AnalyticsOptions {
  /** Instance name used in logs. @default 'default' */
  name?: string;
  /** Resolver turning configured provider keys into instances. */
  resolveProvider?: ProviderResolver;
}

/** Payload for {@link Analytics.page}. */
export interface PageProperties extends AnalyticsEventProperties {
  path?: string;
  url?: string;
  title?: string;
  referrer?: string;
  search?: string;
}

/** Context object supplied to {@link Analytics.trackError}. */
export interface ErrorContext extends AnalyticsEventProperties {
  component?: string;
  action?: string;
}

/** Current identity held by the client. */
export interface AnalyticsIdentity {
  userId: string | null;
  anonymousId: string | null;
  traits: UserTraits;
  groupId: string | null;
}

/** Snapshot of the registered providers, useful for debugging and tests. */
export interface ProviderStatus {
  name: string;
  enabled: boolean;
  initialized: boolean;
  /** `false` when the provider is waiting for consent. */
  consentGranted: boolean;
  requiredConsent: readonly ConsentCategory[];
}

/* -------------------------------------------------------------------------- */
/* Public client interface                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The provider-independent analytics API.
 *
 * All tracking methods are fire-and-forget: they never block the caller and
 * never throw because of a provider failure.
 */
export interface Analytics<TEvents extends AnalyticsEventMap = DefaultEventMap> {
  /** Instance name, used in log output. */
  readonly name: string;

  /** Initialise the client and every configured provider. Safe to await. */
  init(config?: AnalyticsConfig): Promise<void>;

  /** Resolves once initialisation has finished. */
  ready(): Promise<void>;

  /** `true` once {@link Analytics.init} has completed. */
  isInitialized(): boolean;

  /** Track a typed application event. */
  track<TName extends EventName<TEvents>>(
    eventName: TName,
    ...args: TrackArgs<TEvents, TName>
  ): void;

  /**
   * Escape hatch for event names that are not known at compile time.
   * Prefer {@link Analytics.track} whenever the event is part of your map.
   */
  trackEvent(
    eventName: string,
    properties?: AnalyticsEventProperties,
    options?: DispatchOptions
  ): void;

  /** Track a page view. Falls back to `window.location` when arguments are omitted. */
  page(pageName?: string, properties?: PageProperties, options?: DispatchOptions): void;

  /** Associate the current session with a user. */
  identify(userId: string, traits?: UserTraits, options?: DispatchOptions): void;

  /** Associate the current user with an account/organisation. */
  group(groupId: string, traits?: GroupTraits, options?: DispatchOptions): void;

  /** Clear the identity (user id, traits, anonymous id) across all providers. */
  reset(): void;

  /** Track a caught error as an analytics event. */
  trackError(error: unknown, context?: ErrorContext): void;

  /** Flush queued calls to every provider. */
  flush(): Promise<void>;

  /* Consent ---------------------------------------------------------------- */

  setConsent(consent: ConsentState): void;
  getConsent(): ConsentSnapshot;
  clearConsent(): void;
  /** Subscribe to consent changes. Returns an unsubscribe function. */
  onConsentChange(listener: (consent: ConsentSnapshot) => void): () => void;

  /* Privacy ---------------------------------------------------------------- */

  optOut(): void;
  optIn(): void;
  isOptedOut(): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;

  /* Providers -------------------------------------------------------------- */

  addProvider(provider: AnalyticsProvider, config?: ProviderConfig): Promise<void>;
  removeProvider(name: string): Promise<void>;
  /** Retrieve a provider for provider-specific APIs, e.g. Clarity tags. */
  provider<TProvider extends AnalyticsProvider = AnalyticsProvider>(
    name: string
  ): TProvider | undefined;
  getProviders(): readonly AnalyticsProvider[];
  getProviderStatus(): readonly ProviderStatus[];
  /** Per-integration availability, skip reasons and last delivery result. */
  getIntegrationStatus(): readonly IntegrationStatus[];
  setProviderEnabled(name: string, enabled: boolean): void;

  /* Plugins ---------------------------------------------------------------- */

  use(plugin: Plugin): this;
  removePlugin(name: string): void;

  /* Identity & misc -------------------------------------------------------- */

  getIdentity(): AnalyticsIdentity;
  getAnonymousId(): string | null;
  getConfig(): Readonly<ResolvedAnalyticsConfig>;
  setDebug(debug: boolean): void;

  /**
   * Developer log namespace. Writes through the configured logger; never sends
   * data to analytics providers.
   */
  readonly log: AnalyticsLog;

  /** Point-in-time dump of logger, consent, identity and every integration. */
  getDebugReport(): DebugReport;

  /** Tear down listeners, timers and providers. */
  destroy(): Promise<void>;
}

/** Fully defaulted configuration, as returned by {@link Analytics.getConfig}. */
export interface ResolvedAnalyticsConfig {
  providers: Record<string, ProviderConfig>;
  enabled: boolean;
  debug: boolean;
  logLevel: LogLevel;
  logger: ResolvedLoggerOptions;
  environment: Environment;
  disableInDevelopment: boolean;
  disableInTest: boolean;
  consent: Required<Omit<ConsentConfig, 'cookie' | 'defaults'>> & {
    defaults: ConsentState;
    cookie?: CookieOptions;
  };
  privacy: Required<Omit<PrivacyConfig, 'redactKeys'>> & { redactKeys: readonly string[] };
  storage: Required<Omit<StorageConfig, 'cookie'>> & { cookie?: CookieOptions };
  batching: Required<BatchingConfig>;
  retry: Required<RetryConfig>;
  offline: Required<OfflineConfig>;
  autoTrack: Required<Omit<AutoTrackConfig, 'clicks'>> & {
    clicks: boolean | AutoTrackClickConfig;
  };
  performanceTracking: Required<PerformanceTrackingConfig>;
  errorTracking: Required<ErrorTrackingConfig>;
  defaultProperties?: AnalyticsEventProperties | (() => AnalyticsEventProperties);
  onError?: (error: AnalyticsErrorInfo) => void;
}

export type { Plugin };
