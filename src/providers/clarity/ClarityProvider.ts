import { ConfigurationError } from '../../core/errors';
import type {
  Analytics,
  AnalyticsEventMap,
  AnalyticsEventProperties,
  AnalyticsProvider,
  ConsentCategory,
  ConsentSnapshot,
  Logger,
  ProviderInitContext,
  UserTraits,
} from '../../core/types';
import { getWindow } from '../../utils/browser';
import { noopLogger } from '../../utils/logger';
import { loadScript } from '../../utils/script';
import { isValidClarityProjectId } from '../../utils/validation';
import type { ClarityConfig, ClarityConsentV2, ClarityFunction } from './types';

const SCRIPT_ID = 'analytics-kit-clarity';
const DEFAULT_TAG_URL = 'https://www.clarity.ms/tag';

interface ClarityWindow extends Window {
  clarity?: ClarityFunction & { q?: unknown[] };
}

/**
 * Microsoft Clarity provider.
 *
 * Clarity is a session-analytics tool rather than an event pipeline, so only a
 * subset of the generic API maps onto it. Clarity-specific features (custom
 * tags, session upgrade) are exposed through provider methods instead of being
 * pushed into the generic interface.
 *
 * @example
 * ```ts
 * const clarity = getClarity(analytics);
 * clarity?.setTag('plan', 'premium');
 * clarity?.event('checkout_started');
 * ```
 */
export class ClarityProvider implements AnalyticsProvider<ClarityConfig> {
  readonly name = 'clarity';

  readonly requiredConsent: readonly ConsentCategory[] = ['analytics'];

  private config: ClarityConfig;
  private logger: Logger = noopLogger;
  private clarity?: ClarityFunction;
  private initialized = false;
  private debugMode = false;

  constructor(config?: ClarityConfig) {
    this.config = config ?? ({ projectId: '' } as ClarityConfig);
  }

  async initialize(context: ProviderInitContext<ClarityConfig>): Promise<void> {
    this.config = { ...this.config, ...(context.config ?? {}) };
    this.logger = context.logger;
    this.debugMode = this.config.debug ?? context.debug;

    const { projectId } = this.config;
    if (!projectId) {
      throw new ConfigurationError('clarity.projectId is required', this.name);
    }
    if (!isValidClarityProjectId(projectId)) {
      this.logger.warn(`Clarity project id "${projectId}" contains unexpected characters`);
    }

    const win = getWindow() as ClarityWindow | undefined;
    if (!win) {
      this.logger.debug('Skipping Clarity initialization outside the browser');
      return;
    }

    // Recreates the official Clarity queueing shim.
    if (typeof win.clarity !== 'function') {
      const shim = function clarity(...args: unknown[]): void {
        (shim.q ??= []).push(args);
      } as ClarityFunction & { q?: unknown[] };
      win.clarity = shim;
    }
    this.clarity = win.clarity;
    this.initialized = true;

    if (this.config.consentMode !== false) {
      this.applyConsent(context.consent);
    }

    for (const [key, value] of Object.entries(this.config.tags ?? {})) {
      this.setTag(key, value);
    }

    if (this.config.loadScript !== false) {
      const src = `${this.config.scriptUrl ?? DEFAULT_TAG_URL}/${encodeURIComponent(projectId)}`;
      // Not awaited: the shim queues commands until the tag is ready.
      loadScript({ src, id: SCRIPT_ID, async: true, nonce: this.config.nonce }).catch(
        (error: unknown) => {
          this.logger.error('Failed to load the Clarity tag', error);
        }
      );
    }

    if (this.debugMode) this.logger.debug(`Clarity initialized for project ${projectId}`);
  }

  track(eventName: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;
    if (this.config.trackEvents === false) return;

    this.clarity?.('event', eventName);

    if (this.config.eventPropertiesAsTags && properties) {
      for (const [key, value] of Object.entries(properties)) this.setTag(key, value);
    }

    if (this.config.upgradeOnEvents?.includes(eventName)) {
      this.upgrade(eventName);
    }
  }

  page(pageName?: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;
    // Clarity records navigation itself; a page tag is opt-in.
    if (!this.config.pageTags) return;

    const path = pageName ?? (properties?.path as string | undefined);
    if (path) this.setTag('page', path);
  }

  identify(userId: string, traits?: UserTraits): void {
    if (!this.ready()) return;
    if (this.config.identifyUsers === false) return;

    this.clarity?.('identify', userId);

    if (this.config.traitsAsTags && traits) {
      for (const [key, value] of Object.entries(traits)) this.setTag(key, value);
    }
  }

  reset(): void {
    if (!this.ready()) return;
    // Clarity has no identity reset; the id is cleared on the next session.
    this.logger.debug('Clarity does not support resetting the identified user');
  }

  setConsent(consent: ConsentSnapshot): void {
    if (!this.initialized || this.config.consentMode === false) return;
    this.applyConsent(consent);
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  destroy(): void {
    this.initialized = false;
    this.clarity = undefined;
  }

  /* --------------------------- Clarity-specific --------------------------- */

  /** Sets a Clarity custom tag. Values are coerced to strings by Clarity. */
  setTag(key: string, value: unknown): void {
    if (!this.ready()) return;
    if (value === undefined || value === null) return;

    const normalized = Array.isArray(value)
      ? value.map((item) => String(item))
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    this.clarity?.('set', key, normalized);
  }

  /** Sends a Clarity custom event. */
  event(eventName: string): void {
    if (!this.ready()) return;
    this.clarity?.('event', eventName);
  }

  /** Identifies the current session, optionally with session/page ids. */
  identifyUser(
    customId: string,
    customSessionId?: string,
    customPageId?: string,
    friendlyName?: string
  ): void {
    if (!this.ready()) return;
    this.clarity?.('identify', customId, customSessionId, customPageId, friendlyName);
  }

  /** Prioritises the current session for recording. */
  upgrade(reason: string): void {
    if (!this.ready()) return;
    this.clarity?.('upgrade', reason);
  }

  /** Sends Clarity's consent signals directly. */
  consent(value: ClarityConsentV2 | boolean): void {
    if (!this.ready()) return;
    if (typeof value === 'boolean') {
      this.clarity?.('consent', value);
      return;
    }
    this.clarity?.('consentv2', value);
  }

  /** Escape hatch for commands not wrapped by this provider. */
  getClarity(): ClarityFunction | undefined {
    return this.clarity;
  }

  private applyConsent(snapshot: ConsentSnapshot): void {
    const payload: ClarityConsentV2 = {
      analytics_Storage: snapshot.categories.analytics === true ? 'granted' : 'denied',
      ad_Storage: snapshot.categories.marketing === true ? 'granted' : 'denied',
    };
    this.clarity?.('consentv2', payload);
  }

  private ready(): boolean {
    if (!this.initialized || !this.clarity) {
      this.logger.debug('Clarity call ignored: provider is not initialized');
      return false;
    }
    return true;
  }
}

/**
 * Typed shortcut for the Clarity-specific API.
 *
 * @example
 * ```ts
 * getClarity(analytics)?.setTag('plan', 'premium');
 * ```
 */
export function getClarity<TEvents extends AnalyticsEventMap>(
  analytics: Analytics<TEvents>
): ClarityProvider | undefined {
  return analytics.provider<ClarityProvider>('clarity');
}
