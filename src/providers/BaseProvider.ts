import { DEFAULT_REQUIRED_CONSENT } from '../core/constants';
import type {
  AnalyticsEventProperties,
  AnalyticsProvider,
  ConsentCategory,
  DispatchContext,
  Logger,
  ProviderInitContext,
  UserTraits,
} from '../core/types';
import { noopLogger } from '../utils/logger';

/**
 * Convenience base class for providers.
 *
 * Implementing {@link AnalyticsProvider} directly is perfectly fine; this class
 * only removes the boilerplate of storing config, logger and ready state.
 *
 * @example
 * ```ts
 * class MyProvider extends BaseProvider<{ apiKey: string }> {
 *   readonly name = 'my-provider';
 *
 *   protected async onInitialize(): Promise<void> {
 *     await fetch(`/collect/init?key=${this.config.apiKey}`);
 *   }
 *
 *   track(eventName: string, properties?: Record<string, unknown>): void {
 *     if (!this.isReady()) return;
 *     navigator.sendBeacon('/collect', JSON.stringify({ eventName, properties }));
 *   }
 *
 *   page(): void {}
 *   identify(): void {}
 * }
 * ```
 */
export abstract class BaseProvider<
  TConfig extends object = Record<string, unknown>,
> implements AnalyticsProvider<TConfig> {
  abstract readonly name: string;

  readonly requiredConsent: readonly ConsentCategory[] = DEFAULT_REQUIRED_CONSENT;

  protected config: TConfig;
  protected logger: Logger = noopLogger;
  protected debug = false;
  private ready = false;
  private destroyed = false;

  constructor(config?: TConfig) {
    this.config = (config ?? {}) as TConfig;
  }

  async initialize(context: ProviderInitContext<TConfig>): Promise<void> {
    // Config passed through `init({ providers: ... })` wins over constructor config.
    this.config = { ...this.config, ...(context.config ?? ({} as TConfig)) };
    this.logger = context.logger;
    this.debug = context.debug;

    await this.onInitialize(context);
    this.ready = true;
  }

  /** Implemented by subclasses to perform the actual setup. */
  protected abstract onInitialize(context: ProviderInitContext<TConfig>): void | Promise<void>;

  abstract track(
    eventName: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  abstract page(
    pageName?: string,
    properties?: AnalyticsEventProperties,
    context?: DispatchContext
  ): void | Promise<void>;

  abstract identify(
    userId: string,
    traits?: UserTraits,
    context?: DispatchContext
  ): void | Promise<void>;

  /** `true` once initialisation finished and `destroy()` has not been called. */
  protected isReady(): boolean {
    return this.ready && !this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
    this.ready = false;
  }
}
