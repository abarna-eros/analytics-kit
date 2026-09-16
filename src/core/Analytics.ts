import { AnalyticsClient } from './AnalyticsClient';
import type { Analytics, AnalyticsEventMap, AnalyticsOptions, DefaultEventMap } from './types';

/**
 * Creates an analytics instance.
 *
 * Pass an event map to get compile-time checking of event names and payloads:
 *
 * @example
 * ```ts
 * type AppEvents = {
 *   button_clicked: { buttonName: string; location: string };
 *   checkout_started: { cartValue: number };
 * };
 *
 * const analytics = createAnalytics<AppEvents>();
 * analytics.track('button_clicked', { buttonName: 'Signup', location: 'header' });
 * ```
 *
 * @remarks
 * The `createAnalytics` exported from the package root can resolve the built-in
 * providers from `init({ providers: ... })`. The one exported from
 * `/core` is provider-agnostic: register providers with `addProvider()` or
 * `customProviders` instead.
 */
export function createAnalytics<TEvents extends AnalyticsEventMap = DefaultEventMap>(
  options: AnalyticsOptions = {}
): Analytics<TEvents> {
  return new AnalyticsClient<TEvents>(options);
}

let defaultInstance: Analytics<AnalyticsEventMap> | undefined;

/**
 * Lazily created shared instance, for apps that prefer a singleton over passing
 * an instance around. Creating your own instance with {@link createAnalytics}
 * is still recommended for testability.
 */
export function getAnalytics<TEvents extends AnalyticsEventMap = DefaultEventMap>(
  options: AnalyticsOptions = {}
): Analytics<TEvents> {
  defaultInstance ??= createAnalytics<AnalyticsEventMap>({ name: 'singleton', ...options });
  return defaultInstance as unknown as Analytics<TEvents>;
}

/** Replaces the shared instance, typically with a mock in tests. */
export function setAnalytics<TEvents extends AnalyticsEventMap = DefaultEventMap>(
  instance: Analytics<TEvents>
): void {
  defaultInstance = instance as unknown as Analytics<AnalyticsEventMap>;
}

/** Clears the shared instance so the next {@link getAnalytics} call recreates it. */
export function resetAnalytics(): void {
  defaultInstance = undefined;
}
