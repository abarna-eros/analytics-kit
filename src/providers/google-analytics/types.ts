import type { BaseProviderConfig, ConsentCategory } from '../../core/types';

/** Google consent-mode signals. */
export type GoogleConsentType =
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'analytics_storage'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage';

export type GoogleConsentValue = 'granted' | 'denied';

/**
 * Configuration for the GA4 provider.
 *
 * @remarks
 * A measurement id is a **public** client-side identifier. The GA4 Measurement
 * Protocol API secret is *not* and must never be shipped to the browser.
 */
export interface GoogleAnalyticsConfig extends BaseProviderConfig {
  /** GA4 measurement id, e.g. `G-XXXXXXXXXX`. Never hardcode it in the package. */
  measurementId: string;

  /** Additional measurement ids that should receive the same data. */
  additionalMeasurementIds?: readonly string[];

  /**
   * Let gtag.js send its own automatic `page_view` on load.
   * Keep this `false` in single-page apps and use page tracking instead.
   * @default false
   */
  sendPageView?: boolean;

  /**
   * Inject the gtag.js script tag. Disable it when the script is already on the
   * page (Google Tag Manager, `next/script`, a CSP-managed loader, ...).
   * @default true
   */
  loadScript?: boolean;

  /** Override the gtag.js URL, e.g. for a server-side tagging domain. */
  scriptUrl?: string;

  /** Global data layer variable name. @default 'dataLayer' */
  dataLayerName?: string;

  /** CSP nonce applied to the injected script tag. */
  nonce?: string;

  /** Enables GA4 DebugView (`debug_mode`). @default inherits the global debug flag */
  debug?: boolean;

  /** Google Consent Mode v2 integration. @default true */
  consentMode?: boolean;

  /** Consent signal values applied before the tag loads. @default all denied */
  defaultConsent?: Partial<Record<GoogleConsentType, GoogleConsentValue>>;

  /**
   * Maps package consent categories onto Google consent signals.
   * @default analytics -> analytics_storage, marketing -> ad_* , personalization -> personalization_storage
   */
  consentMapping?: Partial<Record<GoogleConsentType, ConsentCategory>>;

  /** `transport_url` for server-side tagging. */
  transportUrl?: string;

  /** Cookie configuration forwarded to gtag. */
  cookieDomain?: string;
  cookiePrefix?: string;
  /** Cookie lifetime in seconds. */
  cookieExpires?: number;
  cookieFlags?: string;
  cookieUpdate?: boolean;

  /** `allow_google_signals`; set to `false` to disable cross-device features. */
  allowGoogleSignals?: boolean;
  /** `allow_ad_personalization_signals`. */
  allowAdPersonalizationSignals?: boolean;

  /** Maps friendly property names onto GA4 custom dimensions (`custom_map`). */
  customMap?: Record<string, string>;

  /** User properties applied at initialisation. */
  userProperties?: Record<string, unknown>;

  /**
   * Rewrites event names and property keys to GA4-safe snake_case.
   * @default false
   */
  normalizeNames?: boolean;

  /** Extra parameters merged into the initial `gtag('config', ...)` call. */
  configParams?: Record<string, unknown>;
}

/** Minimal gtag signature; avoids depending on `@types/gtag.js`. */
export type GtagFunction = (...args: unknown[]) => void;
