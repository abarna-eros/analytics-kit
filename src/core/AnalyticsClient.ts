import {
  isEnabledForEnvironment,
  mergeConfig,
  resolveConfig,
  resolveDefaultProperties,
} from './config';
import { ANONYMOUS_ID_KEY, DEFAULT_REQUIRED_CONSENT, OPT_OUT_KEY, PACKAGE_NAME } from './constants';
import { ConsentManager } from './consent';
import { ProviderError, toError } from './errors';
import { DispatchQueue, type OperationType, type QueuedCall } from './queue';
import type {
  Analytics,
  AnalyticsConfig,
  AnalyticsEventMap,
  AnalyticsEventProperties,
  AnalyticsErrorInfo,
  AnalyticsIdentity,
  AnalyticsOptions,
  AnalyticsProvider,
  ConsentCategory,
  ConsentSnapshot,
  ConsentState,
  DefaultEventMap,
  DebugReport,
  DispatchContext,
  DispatchOptions,
  ErrorContext,
  EventName,
  GroupTraits,
  IntegrationDeliveryResult,
  IntegrationSkipReason,
  IntegrationStatus,
  Logger,
  PageProperties,
  ProviderConfig,
  ProviderStatus,
  ResolvedAnalyticsConfig,
  TrackArgs,
  UserTraits,
} from './types';
import { PluginManager } from '../plugins/PluginManager';
import type { Plugin, PluginPayload } from '../plugins/types';
import { AutoTracker } from '../tracking/AutoTracker';
import { ErrorTracker } from '../tracking/ErrorTracker';
import { PerformanceTracker } from '../tracking/PerformanceTracker';
import { DebugLogger } from '../debug/DebugLogger';
import { getPageInfo, isBrowser, isDoNotTrackEnabled, isServer } from '../utils/browser';
import { generateId } from '../utils/id';
import { resolveLoggerOptions } from '../utils/logger';
import { sanitizeProperties } from '../utils/sanitize';
import { withRetry } from '../utils/retry';
import { createStorage, type KeyValueStorage } from '../utils/storage';
import { validateEventName, validateGroupId, validateUserId } from '../utils/validation';

interface RegisteredProvider {
  provider: AnalyticsProvider;
  config: ProviderConfig;
  enabled: boolean;
  initialized: boolean;
  /** Set when initialisation threw, so we stop retrying on every consent change. */
  failed: boolean;
  initializing?: Promise<void>;
  lastError?: string;
  lastDelivery?: IntegrationDeliveryResult;
}

interface PendingCall {
  type: OperationType;
  name?: string;
  properties?: AnalyticsEventProperties;
  options?: DispatchOptions;
  timestamp: number;
}

const MAX_PRE_INIT_CALLS = 100;

/**
 * Framework-agnostic analytics engine.
 *
 * The client talks to providers exclusively through {@link AnalyticsProvider};
 * it contains no provider-specific logic. Every provider interaction is
 * isolated so one failing destination cannot affect the others or the host app.
 */
export class AnalyticsClient<
  TEvents extends AnalyticsEventMap = DefaultEventMap,
> implements Analytics<TEvents> {
  readonly name: string;
  readonly log: ReturnType<DebugLogger['asPublicApi']>;

  private config: ResolvedAnalyticsConfig;
  private logger: Logger;
  private readonly debugLogger: DebugLogger;
  private readonly resolveProvider?: AnalyticsOptions['resolveProvider'];

  private readonly providers = new Map<string, RegisteredProvider>();
  private readonly unresolvedProviders: Array<{ key: string; reason: string }> = [];
  private readonly pluginManager: PluginManager;
  private consentManager: ConsentManager;
  private queue?: DispatchQueue;
  private storage: KeyValueStorage;

  private autoTracker?: AutoTracker;
  private performanceTracker?: PerformanceTracker;
  private errorTracker?: ErrorTracker;
  private unsubscribeConsent?: () => void;

  private initPromise?: Promise<void>;
  private initialized = false;
  private destroyed = false;
  private optedOut = false;

  private userId: string | null = null;
  private anonymousId: string | null = null;
  private groupId: string | null = null;
  private traits: UserTraits = {};

  /** Calls made before `init()` resolved. */
  private preInitCalls: PendingCall[] = [];
  /** Calls made before the user answered the consent prompt. */
  private consentPendingCalls: PendingCall[] = [];

  constructor(options: AnalyticsOptions = {}) {
    this.name = options.name ?? 'default';
    this.resolveProvider = options.resolveProvider;

    // A minimal bootstrap setup so `use()`, `setConsent()` and `track()` are
    // safe to call before `init()`.
    this.config = resolveConfig({});
    this.debugLogger = new DebugLogger({
      scope: this.name,
      options: this.config.logger,
    });
    this.logger = this.debugLogger;
    this.log = this.debugLogger.asPublicApi();
    this.pluginManager = new PluginManager(this.logger, (info) => this.handleErrorInfo(info));
    this.consentManager = new ConsentManager(this.config.consent, this.logger);
    this.storage = createStorage({
      type: this.config.storage.type,
      keyPrefix: this.config.storage.keyPrefix,
      cookie: this.config.storage.cookie,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Lifecycle                                                               */
  /* ---------------------------------------------------------------------- */

  init(config: AnalyticsConfig = {}): Promise<void> {
    if (this.destroyed) {
      this.logger.warn('init() called on a destroyed instance; ignoring');
      return Promise.resolve();
    }
    // Idempotent on purpose: React StrictMode mounts effects twice, and apps
    // commonly call init() from more than one place.
    if (this.initPromise) {
      this.logger.debug('init() called more than once; reusing the first call');
      return this.initPromise;
    }

    this.initPromise = this.performInit(config).catch((error: unknown) => {
      this.logger.error('Initialization failed', error);
      this.handleErrorInfo({ error, source: 'core', operation: 'init' });
    });

    return this.initPromise;
  }

  ready(): Promise<void> {
    return this.initPromise ?? Promise.resolve();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private async performInit(userConfig: AnalyticsConfig): Promise<void> {
    this.config = mergeConfig(this.config, userConfig);

    const { options: loggerOptions, sink } = resolveLoggerOptions(
      this.config.debug,
      userConfig.logLevel ?? this.config.logLevel,
      userConfig.logger
    );
    this.config = { ...this.config, logLevel: loggerOptions.level, logger: loggerOptions };
    this.debugLogger.configure(loggerOptions, sink);

    this.debugLogger.action('info', 'init', 'Initializing analytics', {
      environment: this.config.environment,
      debug: this.config.debug,
      providers: Object.keys(this.config.providers),
    });

    this.storage = createStorage({
      type: this.config.storage.type,
      keyPrefix: this.config.storage.keyPrefix,
      cookie: this.config.storage.cookie,
    });

    // Carry over a decision recorded before init(), but only a real one: the
    // bootstrap manager runs without a consent gate and must not be mistaken
    // for the user having answered.
    const earlyConsent = this.consentManager.hasExplicitDecision()
      ? this.consentManager.snapshot()
      : undefined;
    this.consentManager.destroy();
    this.consentManager = new ConsentManager(this.config.consent, this.logger);
    if (earlyConsent) this.consentManager.set(earlyConsent.categories);

    this.unsubscribeConsent = this.consentManager.subscribe((snapshot) => {
      void this.handleConsentChange(snapshot);
    });

    this.restorePrivacyState();
    this.restoreIdentity();

    this.queue = new DispatchQueue({
      batching: this.config.batching,
      offline: this.config.offline,
      storage: this.config.storage,
      logger: this.logger,
      dispatch: (call) => this.dispatchCall(call),
    });

    for (const plugin of userConfig.plugins ?? []) this.pluginManager.register(plugin);

    await this.pluginManager.initializeAll({
      logger: this.logger,
      environment: this.config.environment,
      debug: this.config.debug,
      config: this.config,
    });

    // Providers are browser-only. On the server we stay a no-op so SSR never
    // touches window/document and never loads a vendor script.
    if (isBrowser()) {
      await this.registerConfiguredProviders(userConfig);
      for (const provider of userConfig.customProviders ?? []) {
        this.registerProvider(provider, {});
      }
      await this.initializeProviders();
      this.startAutomaticTracking();
    } else {
      this.debugLogger.action(
        'debug',
        'init',
        'Server environment detected; providers are not loaded'
      );
    }

    this.initialized = true;
    this.debugLogger.action(
      'info',
      'init',
      `Initialized with ${this.providers.size} provider(s): ${[...this.providers.keys()].join(', ') || 'none'}`
    );

    this.replay(this.preInitCalls);
    this.preInitCalls = [];
  }

  private async registerConfiguredProviders(userConfig: AnalyticsConfig): Promise<void> {
    const entries = Object.entries(this.config.providers);
    if (entries.length === 0) return;

    if (!this.resolveProvider) {
      const reason =
        'No provider resolver on this instance; import createAnalytics from the package root';
      for (const [key] of entries) this.unresolvedProviders.push({ key, reason });
      this.logger.warn(
        `providers config was supplied (${entries.map(([key]) => key).join(', ')}) but this instance has no provider resolver. ` +
          'Import createAnalytics from the package root, or register provider instances with customProviders/addProvider.'
      );
      return;
    }

    await Promise.all(
      entries.map(async ([key, providerConfig]) => {
        if (providerConfig.enabled === false) {
          this.debugLogger.action(
            'debug',
            'init',
            `Provider "${key}" is disabled by configuration`
          );
          return;
        }
        try {
          const provider = await this.resolveProvider?.(key, providerConfig);
          if (!provider) {
            this.unresolvedProviders.push({
              key,
              reason: 'Unknown provider; no resolver entry matched',
            });
            this.logger.warn(`Unknown provider "${key}"; no resolver entry matched`);
            return;
          }
          this.registerProvider(provider, providerConfig);
        } catch (error) {
          this.unresolvedProviders.push({
            key,
            reason: error instanceof Error ? error.message : 'Failed to load provider',
          });
          this.logger.error(`Failed to load provider "${key}"`, error);
          this.handleErrorInfo({ error, source: key, operation: 'resolve' });
        }
      })
    );

    void userConfig;
  }

  private registerProvider(provider: AnalyticsProvider, config: ProviderConfig): void {
    if (this.providers.has(provider.name)) {
      this.logger.warn(`Provider "${provider.name}" is already registered; replacing it`);
    }
    this.providers.set(provider.name, {
      provider,
      config,
      enabled: config.enabled !== false,
      initialized: false,
      failed: false,
    });
    this.logger.debug(`Registered provider "${provider.name}"`);
  }

  private async initializeProviders(): Promise<void> {
    await Promise.all([...this.providers.values()].map((entry) => this.initializeProvider(entry)));
  }

  private async initializeProvider(entry: RegisteredProvider): Promise<void> {
    if (entry.initialized || entry.failed || !entry.enabled) return;
    if (!this.providersAllowedInEnvironment()) {
      this.logger.debug(
        `Skipping "${entry.provider.name}" initialization (disabled for environment "${this.config.environment}")`
      );
      return;
    }
    if (!this.consentManager.isAllowed(this.requiredConsentFor(entry))) {
      this.logger.debug(`Provider "${entry.provider.name}" is waiting for consent`);
      return;
    }
    if (entry.initializing) return entry.initializing;

    const run = (async () => {
      try {
        await entry.provider.initialize({
          config: entry.config,
          logger: this.logger,
          environment: this.config.environment,
          debug: entry.config.debug ?? this.config.debug,
          consent: this.consentManager.snapshot(),
          anonymousId: this.anonymousId ?? undefined,
        });
        entry.initialized = true;
        entry.lastError = undefined;
        this.debugLogger.action('debug', 'init', `Provider "${entry.provider.name}" initialized`);
      } catch (error) {
        entry.failed = true;
        entry.lastError = error instanceof Error ? error.message : String(error);
        this.debugLogger.action(
          'error',
          'init',
          `Provider "${entry.provider.name}" failed to initialize`,
          error
        );
        this.handleErrorInfo({
          error,
          source: entry.provider.name,
          operation: 'initialize',
        });
      } finally {
        entry.initializing = undefined;
      }
    })();

    entry.initializing = run;
    return run;
  }

  private startAutomaticTracking(): void {
    if (!isBrowser() || !this.providersAllowedInEnvironment()) return;

    const { autoTrack, performanceTracking, errorTracking } = this.config;

    if (
      autoTrack.pageViews ||
      autoTrack.outboundLinks ||
      autoTrack.clicks ||
      autoTrack.visibilityChange
    ) {
      this.autoTracker = new AutoTracker({
        config: autoTrack,
        logger: this.logger,
        track: (eventName, properties) => this.trackEvent(eventName, properties),
        page: (pageName, properties) => this.page(pageName, properties),
      });
      this.autoTracker.start();
    }

    if (performanceTracking.enabled) {
      this.performanceTracker = new PerformanceTracker({
        config: performanceTracking,
        logger: this.logger,
        track: (eventName, properties) => this.trackEvent(eventName, properties),
      });
      this.performanceTracker.start();
    }

    if (errorTracking.captureErrors) {
      this.errorTracker = new ErrorTracker({
        config: errorTracking,
        logger: this.logger,
        report: (error, context) => this.trackError(error, context),
      });
      this.errorTracker.start();
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;

    this.autoTracker?.stop();
    this.performanceTracker?.stop();
    this.errorTracker?.stop();
    this.unsubscribeConsent?.();

    await this.queue?.flush().catch(() => undefined);
    await this.queue?.destroy();

    await Promise.all(
      [...this.providers.values()].map((entry) =>
        this.invokeProvider(entry, 'destroy', () => entry.provider.destroy?.())
      )
    );
    this.providers.clear();

    await this.pluginManager.destroyAll();
    this.consentManager.destroy();

    this.initialized = false;
    this.logger.debug('Destroyed');
  }

  /* ---------------------------------------------------------------------- */
  /* Tracking API                                                            */
  /* ---------------------------------------------------------------------- */

  track<TName extends EventName<TEvents>>(
    eventName: TName,
    ...args: TrackArgs<TEvents, TName>
  ): void {
    const [properties, options] = args as [
      AnalyticsEventProperties | undefined,
      DispatchOptions | undefined,
    ];
    this.trackEvent(eventName, properties, options);
  }

  trackEvent(
    eventName: string,
    properties?: AnalyticsEventProperties,
    options?: DispatchOptions
  ): void {
    const validation = validateEventName(eventName);
    if (!validation.valid) {
      this.logger.error(`Invalid event name: ${validation.error}`);
      return;
    }
    for (const warning of validation.warnings) this.logger.warn(warning);

    this.debugLogger.action('debug', 'track', `track: ${eventName}`, properties);
    this.submit('track', eventName, properties, options);
  }

  page(pageName?: string, properties?: PageProperties, options?: DispatchOptions): void {
    const pageInfo = getPageInfo();
    const resolved: PageProperties = {
      ...(pageInfo
        ? {
            path: pageInfo.path,
            url: pageInfo.url,
            title: pageInfo.title,
            referrer: pageInfo.referrer,
            search: pageInfo.search,
          }
        : {}),
      ...properties,
    };
    const name = pageName ?? (typeof resolved.path === 'string' ? resolved.path : undefined);
    this.debugLogger.action('debug', 'page', `page: ${name ?? '(current)'}`, resolved);
    this.submit('page', name, resolved, options);
  }

  identify(userId: string, traits?: UserTraits, options?: DispatchOptions): void {
    const validation = validateUserId(userId);
    if (!validation.valid) {
      this.logger.error(`Invalid user id: ${validation.error}`);
      return;
    }

    this.userId = userId;
    this.traits = { ...this.traits, ...(traits ?? {}) };
    this.debugLogger.action('debug', 'identify', `identify: ${userId}`, traits);
    this.submit('identify', userId, traits, options);
  }

  group(groupId: string, traits?: GroupTraits, options?: DispatchOptions): void {
    const validation = validateGroupId(groupId);
    if (!validation.valid) {
      this.logger.error(`Invalid group id: ${validation.error}`);
      return;
    }

    this.groupId = groupId;
    this.debugLogger.action('debug', 'identify', `group: ${groupId}`, traits);
    this.submit('group', groupId, traits, options);
  }

  reset(): void {
    this.userId = null;
    this.groupId = null;
    this.traits = {};

    if (this.config.privacy.anonymousId && isBrowser()) {
      this.anonymousId = generateId();
      this.storage.set(ANONYMOUS_ID_KEY, this.anonymousId);
    } else {
      this.anonymousId = null;
      this.storage.remove(ANONYMOUS_ID_KEY);
    }

    this.submit('reset', undefined, undefined, { immediate: true });
    this.debugLogger.action('debug', 'reset', 'reset');
  }

  trackError(error: unknown, context?: ErrorContext): void {
    const normalized = toError(error);
    const properties: AnalyticsEventProperties = {
      error_name: normalized.name,
      error_message: normalized.message,
      ...context,
    };

    // Stacks can contain file paths and user input, so they stay opt-in.
    if (this.config.errorTracking.includeStackTrace && normalized.stack) {
      properties.error_stack = normalized.stack;
    }

    this.trackEvent(this.config.errorTracking.eventName, properties);
  }

  async flush(): Promise<void> {
    await this.queue?.flush();
    await Promise.all(
      [...this.providers.values()]
        .filter((entry) => entry.initialized && entry.provider.flush)
        .map((entry) => this.invokeProvider(entry, 'flush', () => entry.provider.flush?.()))
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Dispatch pipeline                                                       */
  /* ---------------------------------------------------------------------- */

  private submit(
    type: OperationType,
    name?: string,
    rawProperties?: AnalyticsEventProperties,
    options?: DispatchOptions
  ): void {
    if (this.destroyed) {
      this.logger.warn(`${type} call ignored: instance has been destroyed`);
      return;
    }

    if (!this.isOperational()) {
      this.logger.debug(`${type} call ignored: analytics is disabled or opted out`);
      return;
    }

    const properties = this.prepareProperties(type, rawProperties);
    const pending: PendingCall = { type, name, properties, options, timestamp: Date.now() };

    if (!this.initialized) {
      this.buffer(this.preInitCalls, pending, MAX_PRE_INIT_CALLS, 'pre-init');
      return;
    }

    if (!this.consentManager.hasDecision()) {
      if (!this.config.consent.queueUntilDecision) {
        this.logger.debug(`${type} call dropped: awaiting consent decision`);
        return;
      }
      this.buffer(this.consentPendingCalls, pending, this.config.consent.maxQueuedCalls, 'consent');
      return;
    }

    this.enqueue(pending);
  }

  private enqueue(pending: PendingCall): void {
    const call: Omit<QueuedCall, 'id' | 'queuedAt'> = {
      type: pending.type,
      name: pending.name,
      properties: pending.properties,
      options: pending.options,
      context: this.buildContext(pending.timestamp),
    };

    if (!this.queue) {
      void this.dispatchCall({ ...call, id: 'direct', queuedAt: Date.now() });
      return;
    }

    this.queue.enqueue(call);
  }

  private buffer(target: PendingCall[], call: PendingCall, limit: number, label: string): void {
    target.push(call);
    if (target.length > limit) {
      target.shift();
      this.logger.warn(`${label} buffer exceeded ${limit} calls; dropping oldest`);
    }
    this.logger.debug(`Buffered ${call.type} call (${label})`);
  }

  private replay(calls: PendingCall[]): void {
    if (calls.length === 0) return;
    this.logger.debug(`Replaying ${calls.length} buffered call(s)`);
    for (const call of calls) {
      if (!this.initialized) {
        this.preInitCalls.push(call);
        continue;
      }
      if (!this.consentManager.hasDecision()) {
        this.consentPendingCalls.push(call);
        continue;
      }
      this.enqueue(call);
    }
  }

  private prepareProperties(
    type: OperationType,
    properties?: AnalyticsEventProperties
  ): AnalyticsEventProperties | undefined {
    if (type === 'reset') return undefined;

    const withDefaults =
      type === 'track' || type === 'page'
        ? { ...resolveDefaultProperties(this.config.defaultProperties), ...(properties ?? {}) }
        : properties;

    if (!withDefaults) return undefined;

    return sanitizeProperties(withDefaults, {
      redact: this.config.privacy.sanitizeProperties,
      redactKeys: this.config.privacy.redactKeys,
      maxDepth: this.config.privacy.maxPropertyDepth,
      maxProperties: this.config.privacy.maxProperties,
    });
  }

  private buildContext(timestamp: number): DispatchContext {
    return {
      anonymousId: this.anonymousId ?? undefined,
      userId: this.userId,
      timestamp,
      consent: this.consentManager.snapshot(),
    };
  }

  /** Delivers one call to the plugins and every eligible provider. */
  private async dispatchCall(call: QueuedCall): Promise<void> {
    if (this.destroyed) return;

    const payload: PluginPayload = {
      type: call.type,
      name: call.name,
      properties: call.properties,
      context: call.context,
    };

    const transformed = this.pluginManager.applyBeforeSend(payload);
    if (!transformed) return;

    await this.pluginManager.notify(transformed);

    // Providers are browser-only; on the server the call ends with the plugins.
    if (!isBrowser()) {
      this.debugLogger.action(
        'debug',
        'delivery',
        `${call.type}${call.name ? ` "${call.name}"` : ''} skipped: ssr`
      );
      return;
    }

    await Promise.all(
      [...this.providers.values()].map((entry) =>
        this.deliverWithStatus(entry, transformed, call.context, call.options, call.type)
      )
    );
  }

  private async deliverWithStatus(
    entry: RegisteredProvider,
    payload: PluginPayload,
    context: DispatchContext,
    options: DispatchOptions | undefined,
    type: OperationType
  ): Promise<void> {
    const skip = this.skipReason(entry, options, type);
    if (skip) {
      const result: IntegrationDeliveryResult = {
        status: skip === 'unavailable' ? 'unavailable' : 'skipped',
        operation: type,
        reason: skip,
        at: Date.now(),
        ...(entry.lastError ? { error: entry.lastError } : {}),
      };
      entry.lastDelivery = result;
      this.debugLogger.action(
        skip === 'unavailable' ? 'warn' : 'debug',
        'delivery',
        `${type}${payload.name ? ` "${payload.name}"` : ''} ${result.status} for ${entry.provider.name}: ${skip}`
      );
      return;
    }

    const outcome = await this.deliverToProvider(entry, payload, context);
    entry.lastDelivery = outcome;
    const level = outcome.status === 'failed' ? 'error' : 'debug';
    this.debugLogger.action(
      level,
      'delivery',
      `${type}${payload.name ? ` "${payload.name}"` : ''} ${outcome.status} for ${entry.provider.name}` +
        (outcome.error ? `: ${outcome.error}` : '')
    );
  }

  private skipReason(
    entry: RegisteredProvider,
    options: DispatchOptions | undefined,
    type: OperationType
  ): IntegrationSkipReason | undefined {
    if (!entry.enabled) return 'disabled';
    if (entry.failed) return 'unavailable';
    if (!this.providersAllowedInEnvironment()) return 'environment';
    if (!this.consentManager.isAllowed(this.requiredConsentFor(entry))) return 'consent';
    if (!entry.initialized) return 'not_initialized';
    if (options?.only && !options.only.includes(entry.provider.name)) return 'filtered';
    if (options?.except?.includes(entry.provider.name)) return 'filtered';
    if (type === 'group' && !entry.provider.group) return 'unsupported';
    if (type === 'reset' && !entry.provider.reset) return 'unsupported';
    return undefined;
  }
  private deliverToProvider(
    entry: RegisteredProvider,
    payload: PluginPayload,
    context: DispatchContext
  ): Promise<IntegrationDeliveryResult> {
    const { provider } = entry;
    const { name, properties } = payload;
    const at = Date.now();

    switch (payload.type) {
      case 'track':
        return this.invokeProvider(entry, 'track', () =>
          provider.track(name ?? '', properties, context)
        );
      case 'page':
        return this.invokeProvider(entry, 'page', () => provider.page(name, properties, context));
      case 'identify':
        return this.invokeProvider(entry, 'identify', () =>
          provider.identify(name ?? '', properties, context)
        );
      case 'group':
        if (!provider.group) {
          return Promise.resolve({
            status: 'skipped',
            operation: 'group',
            reason: 'unsupported',
            at,
          });
        }
        return this.invokeProvider(entry, 'group', () =>
          provider.group?.(name ?? '', properties, context)
        );
      case 'reset':
        if (!provider.reset) {
          return Promise.resolve({
            status: 'skipped',
            operation: 'reset',
            reason: 'unsupported',
            at,
          });
        }
        return this.invokeProvider(entry, 'reset', () => provider.reset?.());
      default:
        return Promise.resolve({
          status: 'skipped',
          operation: payload.type,
          reason: 'unsupported',
          at,
        });
    }
  }

  /**
   * Runs a provider call in isolation.
   *
   * Errors are logged and reported, never rethrown: a broken destination must
   * not break the other destinations or the application.
   */
  private async invokeProvider(
    entry: RegisteredProvider,
    operation: string,
    call: () => void | Promise<void>
  ): Promise<IntegrationDeliveryResult> {
    const at = Date.now();
    try {
      if (this.config.retry.enabled && operation !== 'destroy') {
        await withRetry(call, {
          maxAttempts: this.config.retry.maxAttempts,
          backoff: this.config.retry.backoff,
          initialDelay: this.config.retry.initialDelay,
          maxDelay: this.config.retry.maxDelay,
          onRetry: (error, attempt, delay) => {
            this.logger.warn(
              `Provider "${entry.provider.name}" ${operation} failed (attempt ${attempt}); retrying in ${delay}ms`,
              error
            );
          },
        });
      } else {
        await call();
      }
      return { status: 'success', operation, at };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Provider "${entry.provider.name}" failed during ${operation}`;
      const providerError = new ProviderError(
        `Provider "${entry.provider.name}" failed during ${operation}`,
        entry.provider.name,
        operation,
        error
      );
      entry.lastError = message;
      this.logger.error(providerError.message, error);
      this.handleErrorInfo({ error, source: entry.provider.name, operation });
      return { status: 'failed', operation, at, error: message };
    }
  }

  private requiredConsentFor(entry: RegisteredProvider): readonly ConsentCategory[] {
    const override = entry.config.requiredConsent;
    if (Array.isArray(override)) return override as readonly ConsentCategory[];
    return entry.provider.requiredConsent ?? DEFAULT_REQUIRED_CONSENT;
  }

  /* ---------------------------------------------------------------------- */
  /* Consent                                                                 */
  /* ---------------------------------------------------------------------- */

  setConsent(consent: ConsentState): void {
    this.debugLogger.action('debug', 'consent', 'setConsent', consent);
    this.consentManager.set(consent);
  }

  getConsent(): ConsentSnapshot {
    return this.consentManager.snapshot();
  }

  clearConsent(): void {
    this.debugLogger.action('debug', 'consent', 'clearConsent');
    this.consentManager.clear();
  }

  onConsentChange(listener: (consent: ConsentSnapshot) => void): () => void {
    return this.consentManager.subscribe(listener);
  }

  private async handleConsentChange(snapshot: ConsentSnapshot): Promise<void> {
    this.debugLogger.action('debug', 'consent', 'Applying consent change', snapshot.categories);

    await Promise.all(
      [...this.providers.values()].map(async (entry) => {
        const allowed = this.consentManager.isAllowed(this.requiredConsentFor(entry));

        if (allowed && !entry.initialized) {
          await this.initializeProvider(entry);
        }
        if (entry.initialized && entry.provider.setConsent) {
          await this.invokeProvider(entry, 'setConsent', () =>
            entry.provider.setConsent?.(snapshot)
          );
        }
      })
    );

    if (this.consentManager.hasDecision() && this.consentPendingCalls.length > 0) {
      const pending = this.consentPendingCalls;
      this.consentPendingCalls = [];
      this.replay(pending);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Privacy                                                                 */
  /* ---------------------------------------------------------------------- */

  optOut(): void {
    this.optedOut = true;
    this.storage.set(OPT_OUT_KEY, 'true');
    this.queue?.clear();
    this.logger.info('Opted out; no further data will be sent');
  }

  optIn(): void {
    this.optedOut = false;
    this.storage.remove(OPT_OUT_KEY);
    this.logger.info('Opted in');
  }

  isOptedOut(): boolean {
    if (this.optedOut) return true;
    if (this.config.privacy.respectDoNotTrack && isDoNotTrackEnabled()) return true;
    return false;
  }

  setEnabled(enabled: boolean): void {
    this.config = { ...this.config, enabled };
    this.logger.debug(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled(): boolean {
    return this.isOperational();
  }

  private isOperational(): boolean {
    if (!this.config.enabled) return false;
    if (this.isOptedOut()) return false;
    return true;
  }

  /** Environment gating only applies to providers, not to plugins. */
  private providersAllowedInEnvironment(): boolean {
    return isEnabledForEnvironment(this.config);
  }

  private restorePrivacyState(): void {
    if (this.config.privacy.optOut) {
      this.optedOut = true;
      return;
    }
    this.optedOut = this.storage.get(OPT_OUT_KEY) === 'true';
  }

  private restoreIdentity(): void {
    if (!this.config.privacy.anonymousId || !isBrowser()) {
      this.anonymousId = null;
      return;
    }
    const stored = this.storage.get(ANONYMOUS_ID_KEY);
    if (stored) {
      this.anonymousId = stored;
      return;
    }
    this.anonymousId = generateId();
    this.storage.set(ANONYMOUS_ID_KEY, this.anonymousId);
  }

  /* ---------------------------------------------------------------------- */
  /* Providers                                                               */
  /* ---------------------------------------------------------------------- */

  async addProvider(provider: AnalyticsProvider, config: ProviderConfig = {}): Promise<void> {
    if (!isBrowser()) {
      this.logger.debug(`Provider "${provider.name}" not registered on the server`);
      return;
    }
    this.registerProvider(provider, config);
    const entry = this.providers.get(provider.name);
    if (entry) await this.initializeProvider(entry);
  }

  async removeProvider(name: string): Promise<void> {
    const entry = this.providers.get(name);
    if (!entry) return;
    this.providers.delete(name);
    await this.invokeProvider(entry, 'destroy', () => entry.provider.destroy?.());
    this.logger.debug(`Removed provider "${name}"`);
  }

  provider<TProvider extends AnalyticsProvider = AnalyticsProvider>(
    name: string
  ): TProvider | undefined {
    return this.providers.get(name)?.provider as TProvider | undefined;
  }

  getProviders(): readonly AnalyticsProvider[] {
    return [...this.providers.values()].map((entry) => entry.provider);
  }

  getProviderStatus(): readonly ProviderStatus[] {
    return [...this.providers.values()].map((entry) => ({
      name: entry.provider.name,
      enabled: entry.enabled,
      initialized: entry.initialized,
      consentGranted: this.consentManager.isAllowed(this.requiredConsentFor(entry)),
      requiredConsent: this.requiredConsentFor(entry),
    }));
  }

  getIntegrationStatus(): readonly IntegrationStatus[] {
    return [...this.providers.values()].map((entry) => this.toIntegrationStatus(entry));
  }

  getDebugReport(): DebugReport {
    return {
      generatedAt: Date.now(),
      packageName: PACKAGE_NAME,
      instanceName: this.name,
      environment: this.config.environment,
      debug: this.config.debug,
      logLevel: this.config.logLevel,
      logger: this.config.logger,
      initialized: this.initialized,
      enabled: this.config.enabled,
      optedOut: this.isOptedOut(),
      ssr: isServer(),
      identity: {
        userId: this.userId,
        anonymousId: this.anonymousId,
        groupId: this.groupId,
      },
      consent: this.consentManager.snapshot(),
      integrations: this.getIntegrationStatus(),
      unresolvedProviders: this.unresolvedProviders.slice(),
      queueSize: this.queue?.size() ?? this.preInitCalls.length + this.consentPendingCalls.length,
      recentLogs: this.debugLogger.getEntries(),
    };
  }

  private toIntegrationStatus(entry: RegisteredProvider): IntegrationStatus {
    const consentGranted = this.consentManager.isAllowed(this.requiredConsentFor(entry));
    const skippedReason = this.skipReason(entry, undefined, 'track');
    return {
      name: entry.provider.name,
      enabled: entry.enabled,
      initialized: entry.initialized,
      available: entry.enabled && entry.initialized && !entry.failed && consentGranted,
      consentGranted,
      requiredConsent: this.requiredConsentFor(entry),
      ...(skippedReason ? { skippedReason } : {}),
      ...(entry.lastError ? { lastError: entry.lastError } : {}),
      ...(entry.lastDelivery ? { lastDelivery: entry.lastDelivery } : {}),
    };
  }

  setProviderEnabled(name: string, enabled: boolean): void {
    const entry = this.providers.get(name);
    if (!entry) {
      this.logger.warn(`Cannot toggle unknown provider "${name}"`);
      return;
    }
    entry.enabled = enabled;
    this.logger.debug(`Provider "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    if (enabled) void this.initializeProvider(entry);
  }

  /* ---------------------------------------------------------------------- */
  /* Plugins & misc                                                          */
  /* ---------------------------------------------------------------------- */

  use(plugin: Plugin): this {
    this.pluginManager.register(plugin);
    if (this.initialized) {
      void this.pluginManager.initializeAll({
        logger: this.logger,
        environment: this.config.environment,
        debug: this.config.debug,
        config: this.config,
      });
    }
    return this;
  }

  removePlugin(name: string): void {
    void this.pluginManager.remove(name);
  }

  getIdentity(): AnalyticsIdentity {
    return {
      userId: this.userId,
      anonymousId: this.anonymousId,
      traits: { ...this.traits },
      groupId: this.groupId,
    };
  }

  getAnonymousId(): string | null {
    return this.anonymousId;
  }

  getConfig(): Readonly<ResolvedAnalyticsConfig> {
    return this.config;
  }

  setDebug(debug: boolean): void {
    const logger = {
      ...this.config.logger,
      level: debug
        ? ('debug' as const)
        : this.config.logger.level === 'debug'
          ? 'warn'
          : this.config.logger.level,
    };
    this.config = { ...this.config, debug, logLevel: logger.level, logger };
    this.debugLogger.configure(logger);
  }

  private handleErrorInfo(info: AnalyticsErrorInfo): void {
    if (!this.config.onError) return;
    try {
      this.config.onError(info);
    } catch (error) {
      this.logger.error('onError handler threw', error);
    }
  }
}
