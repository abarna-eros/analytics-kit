import { ConfigurationError } from '../../core/errors';
import type {
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
import { isValidMeasurementId } from '../../utils/validation';
import type {
  GoogleAnalyticsConfig,
  GoogleConsentType,
  GoogleConsentValue,
  GtagFunction,
} from './types';

const SCRIPT_ID = 'analytics-kit-gtag';
const DEFAULT_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js';

/** Which package consent category controls which Google consent signal. */
const DEFAULT_CONSENT_MAPPING: Record<GoogleConsentType, ConsentCategory> = {
  analytics_storage: 'analytics',
  ad_storage: 'marketing',
  ad_user_data: 'marketing',
  ad_personalization: 'marketing',
  personalization_storage: 'personalization',
  functionality_storage: 'analytics',
  security_storage: 'analytics',
};

interface GtagWindow extends Window {
  gtag?: GtagFunction;
  [key: string]: unknown;
}

/**
 * Google Analytics 4 provider built on the official gtag.js browser API.
 *
 * Browser only. On the server every method is a no-op, and the script tag is
 * never injected.
 *
 * @example
 * ```ts
 * analytics.init({
 *   providers: {
 *     googleAnalytics: { measurementId: 'G-XXXXXXXXXX', debug: false, sendPageView: false },
 *   },
 * });
 * ```
 */
export class GoogleAnalyticsProvider implements AnalyticsProvider<GoogleAnalyticsConfig> {
  readonly name = 'google-analytics';

  readonly requiredConsent: readonly ConsentCategory[] = ['analytics'];

  private config: GoogleAnalyticsConfig;
  private logger: Logger = noopLogger;
  private gtag?: GtagFunction;
  private initialized = false;
  private debugMode = false;

  constructor(config?: GoogleAnalyticsConfig) {
    this.config = config ?? ({ measurementId: '' } as GoogleAnalyticsConfig);
  }

  async initialize(context: ProviderInitContext<GoogleAnalyticsConfig>): Promise<void> {
    this.config = { ...this.config, ...(context.config ?? {}) };
    this.logger = context.logger;
    this.debugMode = this.config.debug ?? context.debug;

    const { measurementId } = this.config;
    if (!measurementId) {
      throw new ConfigurationError('googleAnalytics.measurementId is required', this.name);
    }
    if (!isValidMeasurementId(measurementId)) {
      this.logger.warn(
        `Measurement id "${measurementId}" does not look like a GA4 id (expected the G-XXXXXXXXXX format)`
      );
    }

    const win = getWindow() as GtagWindow | undefined;
    if (!win) {
      this.logger.debug('Skipping GA4 initialization outside the browser');
      return;
    }

    const dataLayerName = this.config.dataLayerName ?? 'dataLayer';
    const dataLayer = (win[dataLayerName] as unknown[] | undefined) ?? [];
    win[dataLayerName] = dataLayer;

    // Reuse an existing gtag (GTM or another tag on the page) when present.
    this.gtag =
      typeof win.gtag === 'function' ? win.gtag : createGtag(dataLayer as IArguments[] & unknown[]);
    if (typeof win.gtag !== 'function') win.gtag = this.gtag;

    this.gtag('js', new Date());

    // Consent defaults must reach the data layer before the config command.
    if (this.config.consentMode !== false) {
      this.gtag('consent', 'default', this.buildDefaultConsent(context.consent));
    }

    this.gtag('config', measurementId, this.buildConfigParams());
    for (const extraId of this.config.additionalMeasurementIds ?? []) {
      this.gtag('config', extraId, this.buildConfigParams());
    }

    if (this.config.userProperties) {
      this.gtag('set', 'user_properties', this.config.userProperties);
    }

    this.initialized = true;

    if (this.config.loadScript !== false) {
      const src = `${this.config.scriptUrl ?? DEFAULT_SCRIPT_URL}?id=${encodeURIComponent(measurementId)}${
        dataLayerName !== 'dataLayer' ? `&l=${encodeURIComponent(dataLayerName)}` : ''
      }`;
      // Not awaited: gtag queues commands in the data layer until the tag loads.
      loadScript({ src, id: SCRIPT_ID, async: true, nonce: this.config.nonce }).catch(
        (error: unknown) => {
          this.logger.error('Failed to load gtag.js', error);
        }
      );
    }

    this.logger.debug(`GA4 initialized for ${measurementId}`);
  }

  track(eventName: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;
    const name = this.config.normalizeNames ? toSnakeCase(eventName) : eventName;
    this.gtag?.('event', name, this.buildEventParams(properties));
  }

  page(pageName?: string, properties?: AnalyticsEventProperties): void {
    if (!this.ready()) return;

    const params: AnalyticsEventProperties = this.buildEventParams(properties);
    const path = (properties?.path as string | undefined) ?? pageName;

    this.gtag?.('event', 'page_view', {
      ...params,
      ...(properties?.title ? { page_title: properties.title } : {}),
      ...(properties?.url ? { page_location: properties.url } : {}),
      ...(properties?.referrer ? { page_referrer: properties.referrer } : {}),
      ...(path ? { page_path: path } : {}),
    });
  }

  identify(userId: string, traits?: UserTraits): void {
    if (!this.ready()) return;

    // `user_id` is a GA4 first-class field; traits become user properties.
    this.gtag?.('set', { user_id: userId });
    this.gtag?.('config', this.config.measurementId, { user_id: userId });

    if (traits && Object.keys(traits).length > 0) {
      this.gtag?.('set', 'user_properties', this.buildEventParams(traits));
    }
  }

  reset(): void {
    if (!this.ready()) return;
    this.gtag?.('set', { user_id: null });
    this.gtag?.('set', 'user_properties', {});
  }

  setConsent(consent: ConsentSnapshot): void {
    if (!this.gtag || this.config.consentMode === false) return;
    this.gtag('consent', 'update', this.mapConsent(consent));
    this.logger.debug('GA4 consent updated');
  }

  flush(): Promise<void> {
    // gtag.js owns its own transport and batching; there is nothing to flush.
    return Promise.resolve();
  }

  destroy(): void {
    this.initialized = false;
    this.gtag = undefined;
  }

  /** Escape hatch for GA-specific commands that the generic API does not cover. */
  getGtag(): GtagFunction | undefined {
    return this.gtag;
  }

  private ready(): boolean {
    if (!this.initialized || !this.gtag) {
      this.logger.debug('GA4 call ignored: provider is not initialized');
      return false;
    }
    return true;
  }

  private buildConfigParams(): Record<string, unknown> {
    const config = this.config;
    const params: Record<string, unknown> = {
      send_page_view: config.sendPageView ?? false,
    };

    if (this.debugMode) params.debug_mode = true;
    if (config.transportUrl) params.transport_url = config.transportUrl;
    if (config.cookieDomain) params.cookie_domain = config.cookieDomain;
    if (config.cookiePrefix) params.cookie_prefix = config.cookiePrefix;
    if (typeof config.cookieExpires === 'number') params.cookie_expires = config.cookieExpires;
    if (config.cookieFlags) params.cookie_flags = config.cookieFlags;
    if (typeof config.cookieUpdate === 'boolean') params.cookie_update = config.cookieUpdate;
    if (typeof config.allowGoogleSignals === 'boolean') {
      params.allow_google_signals = config.allowGoogleSignals;
    }
    if (typeof config.allowAdPersonalizationSignals === 'boolean') {
      params.allow_ad_personalization_signals = config.allowAdPersonalizationSignals;
    }
    if (config.customMap) params.custom_map = config.customMap;

    return { ...params, ...(config.configParams ?? {}) };
  }

  private buildEventParams(properties?: AnalyticsEventProperties): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (value === undefined) continue;
      const normalized = this.config.normalizeNames ? toSnakeCase(key) : key;
      if (this.debugMode && !/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) {
        this.logger.warn(
          `GA4 parameter "${normalized}" is not alphanumeric snake_case and may be dropped by Google`
        );
      }
      params[normalized] = value;
    }
    // Routes the event when several Google tags share the page.
    params.send_to = this.config.measurementId;
    return params;
  }

  private buildDefaultConsent(
    snapshot: ConsentSnapshot
  ): Record<GoogleConsentType, GoogleConsentValue> {
    const mapped = this.mapConsent(snapshot);
    return { ...mapped, ...(this.config.defaultConsent ?? {}) } as Record<
      GoogleConsentType,
      GoogleConsentValue
    >;
  }

  private mapConsent(snapshot: ConsentSnapshot): Record<string, GoogleConsentValue> {
    const mapping = { ...DEFAULT_CONSENT_MAPPING, ...(this.config.consentMapping ?? {}) };
    const result: Record<string, GoogleConsentValue> = {};

    for (const [signal, category] of Object.entries(mapping) as Array<
      [GoogleConsentType, ConsentCategory]
    >) {
      result[signal] = snapshot.categories[category] === true ? 'granted' : 'denied';
    }
    return result;
  }
}

/** Creates the canonical gtag shim that pushes `arguments` onto the data layer. */
function createGtag(dataLayer: unknown[]): GtagFunction {
  function gtag(): void {
    // gtag.js requires the raw `arguments` object, not an array copy.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  }
  return gtag as GtagFunction;
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase();
}
