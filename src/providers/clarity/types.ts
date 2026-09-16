import type { BaseProviderConfig } from '../../core/types';

/** Consent payload accepted by Clarity's `consentv2` command. */
export interface ClarityConsentV2 {
  ad_Storage?: 'granted' | 'denied';
  analytics_Storage?: 'granted' | 'denied';
}

/** The `window.clarity` command signature. */
export type ClarityFunction = (command: string, ...args: unknown[]) => unknown;

/**
 * Configuration for the Microsoft Clarity provider.
 *
 * @remarks
 * A Clarity project id is a public client-side identifier. The Clarity Data
 * Export API token is a server-side secret and must never be bundled.
 */
export interface ClarityConfig extends BaseProviderConfig {
  /** Clarity project id from the Clarity dashboard. */
  projectId: string;

  /** Inject the Clarity tag. Disable when loading it through `next/script` or GTM. @default true */
  loadScript?: boolean;

  /** Override the tag URL. @default 'https://www.clarity.ms/tag' */
  scriptUrl?: string;

  /** CSP nonce applied to the injected script tag. */
  nonce?: string;

  /** Forward consent decisions using Clarity's `consentv2` API. @default true */
  consentMode?: boolean;

  /** Map {@link Analytics.track} onto `clarity('event', name)`. @default true */
  trackEvents?: boolean;

  /**
   * Also write event properties as Clarity custom tags.
   * Off by default: tags are high-cardinality dimensions, not event payloads.
   * @default false
   */
  eventPropertiesAsTags?: boolean;

  /** Map {@link Analytics.identify} onto `clarity('identify', userId)`. @default true */
  identifyUsers?: boolean;

  /** Write user traits as custom tags on identify. @default false */
  traitsAsTags?: boolean;

  /** Write the current path as a `page` custom tag on page calls. @default false */
  pageTags?: boolean;

  /** Event names that should prioritise the session for recording (`upgrade`). */
  upgradeOnEvents?: readonly string[];

  /** Custom tags applied right after initialisation. */
  tags?: Record<string, string | string[]>;
}
