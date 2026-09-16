import type { BaseProviderConfig } from '../../core/types';

/**
 * The subset of the Segment analytics.js API this provider uses.
 *
 * Declaring it locally keeps `@segment/analytics-next` an optional dependency:
 * apps that already install the SDK can pass their instance via
 * {@link SegmentConfig.instance} and skip the CDN snippet entirely.
 */
export interface SegmentAnalytics {
  track(
    event: string,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): unknown;
  page(
    category?: string | Record<string, unknown>,
    name?: string | Record<string, unknown>,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): unknown;
  identify(
    userId?: string,
    traits?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): unknown;
  group(
    groupId?: string,
    traits?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): unknown;
  reset?(): unknown;
  ready?(callback: () => void): unknown;
  setAnonymousId?(id: string): unknown;
  user?(): { anonymousId(): string } | undefined;
  load?(writeKey: string, options?: Record<string, unknown>): unknown;
  [key: string]: unknown;
}

/**
 * Configuration for the Twilio Segment provider.
 *
 * @remarks
 * A **write key** is a public, client-side credential. Segment access tokens and
 * the Public API key are server-side secrets and must never be bundled.
 */
export interface SegmentConfig extends BaseProviderConfig {
  /** Segment source write key. Required unless {@link SegmentConfig.instance} is supplied. */
  writeKey?: string;

  /** Use an existing `@segment/analytics-next` instance instead of the CDN snippet. */
  instance?: SegmentAnalytics;

  /**
   * Inject the analytics.js snippet.
   * @default true (ignored when `instance` is provided)
   */
  loadScript?: boolean;

  /** CDN host, for custom proxies or a self-hosted bundle. @default 'https://cdn.segment.com' */
  cdnURL?: string;

  /** Global variable the snippet writes to. @default 'analytics' */
  globalName?: string;

  /** Options forwarded to `analytics.load()` (integration toggles, obfuscation, ...). */
  loadOptions?: Record<string, unknown>;

  /** Per-call `integrations` object applied to every event. */
  integrations?: Record<string, boolean | Record<string, unknown>>;

  /**
   * Send the package anonymous id to Segment so both systems share one id.
   * Off by default because Segment manages `ajs_anonymous_id` itself.
   * @default false
   */
  syncAnonymousId?: boolean;

  /**
   * Call `analytics.page()` as soon as the snippet loads, like Segment's own
   * copy/paste snippet does. Leave it off for SPAs and use page tracking.
   * @default false
   */
  sendPageViewOnLoad?: boolean;

  /** CSP nonce applied to the injected script tag. */
  nonce?: string;
}
