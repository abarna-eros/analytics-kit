import { ConfigurationError } from '../../core/errors';
import type {
  AnalyticsEventProperties,
  AnalyticsProvider,
  ConsentCategory,
  GroupTraits,
  Logger,
  ProviderInitContext,
  UserTraits,
} from '../../core/types';
import { getWindow } from '../../utils/browser';
import { noopLogger } from '../../utils/logger';
import { loadScript } from '../../utils/script';
import { isValidWriteKey } from '../../utils/validation';
import type { SegmentAnalytics, SegmentConfig } from './types';

const SCRIPT_ID = 'analytics-kit-segment';
const DEFAULT_CDN = 'https://cdn.segment.com';
const SNIPPET_VERSION = '5.2.0';

/** Method names stubbed by the official analytics.js snippet. */
const SNIPPET_METHODS = [
  'trackSubmit',
  'trackClick',
  'trackLink',
  'trackForm',
  'pageview',
  'identify',
  'reset',
  'group',
  'track',
  'ready',
  'alias',
  'debug',
  'page',
  'screen',
  'once',
  'off',
  'on',
  'addSourceMiddleware',
  'addIntegrationMiddleware',
  'setAnonymousId',
  'addDestinationMiddleware',
  'register',
] as const;

interface SegmentStub extends SegmentAnalytics {
  invoked?: boolean;
  initialize?: boolean;
  methods?: readonly string[];
  factory?: (method: string) => (...args: unknown[]) => unknown;
  _writeKey?: string;
  _loadOptions?: Record<string, unknown>;
  _cdn?: string;
  SNIPPET_VERSION?: string;
}

/**
 * Twilio Segment provider using the official analytics.js browser snippet.
 *
 * The snippet installs a queueing stub, so calls made before the bundle
 * finishes downloading are replayed rather than dropped.
 *
 * @example
 * ```ts
 * analytics.init({ providers: { segment: { writeKey: 'YOUR_WRITE_KEY' } } });
 * analytics.identify('user-123', { email: 'user@example.com', plan: 'premium' });
 * analytics.track('subscription_started', { plan: 'premium', price: 499 });
 * ```
 */
export class SegmentProvider implements AnalyticsProvider<SegmentConfig> {
  readonly name = 'segment';

  readonly requiredConsent: readonly ConsentCategory[] = ['analytics'];

  private config: SegmentConfig;
  private logger: Logger = noopLogger;
  private segment?: SegmentAnalytics;
  private initialized = false;

  constructor(config?: SegmentConfig) {
    this.config = config ?? {};
  }

  async initialize(context: ProviderInitContext<SegmentConfig>): Promise<void> {
    this.config = { ...this.config, ...(context.config ?? {}) };
    this.logger = context.logger;

    if (this.config.instance) {
      this.segment = this.config.instance;
      this.initialized = true;
      this.logger.debug('Segment initialized with a provided analytics instance');
      this.syncAnonymousId(context.anonymousId);
      return;
    }

    const { writeKey } = this.config;
    if (!isValidWriteKey(writeKey)) {
      throw new ConfigurationError(
        'segment.writeKey is required (or pass an existing analytics instance)',
        this.name
      );
    }

    const win = getWindow();
    if (!win) {
      this.logger.debug('Skipping Segment initialization outside the browser');
      return;
    }

    const globalName = this.config.globalName ?? 'analytics';
    const globalScope = win as unknown as Record<string, unknown>;
    const stub = this.createStub(globalScope, globalName);

    stub._writeKey = writeKey;
    stub._cdn = this.config.cdnURL ?? DEFAULT_CDN;
    stub._loadOptions = this.config.loadOptions ?? {};
    stub.SNIPPET_VERSION = SNIPPET_VERSION;

    this.segment = stub;
    this.initialized = true;
    this.syncAnonymousId(context.anonymousId);

    if (this.config.loadScript !== false) {
      const src = `${stub._cdn}/analytics.js/v1/${encodeURIComponent(writeKey)}/analytics.min.js`;
      // Not awaited: the stub queues everything until the bundle arrives.
      loadScript({ src, id: SCRIPT_ID, async: true, nonce: this.config.nonce }).catch(
        (error: unknown) => {
          this.logger.error('Failed to load Segment analytics.js', error);
        }
      );
    }

    if (this.config.sendPageViewOnLoad) this.segment.page();

    this.logger.debug('Segment initialized');
  }

  track(eventName: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;
    this.segment?.track(eventName, properties ?? {}, this.callOptions());
  }

  page(pageName?: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;

    if (pageName) {
      this.segment?.page(pageName, properties ?? {}, undefined, this.callOptions());
      return;
    }
    this.segment?.page(properties ?? {}, undefined, undefined, this.callOptions());
  }

  identify(userId: string, traits?: UserTraits): void {
    if (!this.ready()) return;
    this.segment?.identify(userId, traits ?? {}, this.callOptions());
  }

  group(groupId: string, traits?: GroupTraits): void {
    if (!this.ready()) return;
    this.segment?.group(groupId, traits ?? {}, this.callOptions());
  }

  reset(): void {
    if (!this.ready()) return;
    this.segment?.reset?.();
  }

  /** Resolves once analytics.js reports ready, so queued calls have been sent. */
  flush(): Promise<void> {
    const segment = this.segment;
    if (!segment?.ready) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      try {
        segment.ready?.(() => {
          clearTimeout(timer);
          resolve();
        });
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  destroy(): void {
    this.initialized = false;
    this.segment = undefined;
  }

  /** Escape hatch for Segment-specific APIs such as `alias` or middleware. */
  getSegment(): SegmentAnalytics | undefined {
    return this.segment;
  }

  private ready(): boolean {
    if (!this.initialized || !this.segment) {
      this.logger.debug('Segment call ignored: provider is not initialized');
      return false;
    }
    return true;
  }

  private callOptions(): Record<string, unknown> | undefined {
    if (!this.config.integrations) return undefined;
    return { integrations: this.config.integrations };
  }

  private syncAnonymousId(anonymousId?: string): void {
    if (!this.config.syncAnonymousId || !anonymousId) return;
    try {
      this.segment?.setAnonymousId?.(anonymousId);
    } catch (error) {
      this.logger.warn('Failed to sync anonymous id with Segment', error);
    }
  }

  /**
   * Recreates the official analytics.js stub: an array that records calls until
   * the real bundle loads and drains it.
   */
  private createStub(globalScope: Record<string, unknown>, globalName: string): SegmentStub {
    const existing = globalScope[globalName] as SegmentStub | undefined;
    if (existing?.initialize) return existing;
    if (existing?.invoked) {
      this.logger.warn(
        'Segment snippet was already installed on this page; reusing the existing instance'
      );
      return existing;
    }

    const stub = (existing ?? []) as unknown as SegmentStub & unknown[];
    globalScope[globalName] = stub;

    stub.invoked = true;
    stub.methods = SNIPPET_METHODS;
    stub.factory = (method: string) =>
      function queued(...args: unknown[]) {
        const call = [method, ...args];
        (stub as unknown as unknown[]).push(call);
        return stub;
      };

    for (const method of SNIPPET_METHODS) {
      (stub as unknown as Record<string, unknown>)[method] = stub.factory(method);
    }

    return stub;
  }
}
