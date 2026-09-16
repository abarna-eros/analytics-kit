import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useOptionalAnalytics } from '../react/useAnalytics';
import type { Analytics, AnalyticsEventMap, PageProperties } from '../core/types';

export interface UsePagesRouterPageTrackingOptions {
  enabled?: boolean;
  /** Instance to use instead of the one from context. */
  analytics?: Analytics<AnalyticsEventMap>;
  /** Track the page the user landed on. @default true */
  trackInitialPageView?: boolean;
  /** Extra properties, or a factory evaluated per page view. */
  properties?: PageProperties | (() => PageProperties);
  /** Include the query string in the tracked path. @default true */
  includeSearchParams?: boolean;
}

/**
 * Page tracking for the Next.js **Pages Router**, driven by
 * `router.events.routeChangeComplete`.
 *
 * @example
 * ```tsx
 * // pages/_app.tsx
 * function MyApp({ Component, pageProps }) {
 *   usePagesRouterPageTracking();
 *   return <Component {...pageProps} />;
 * }
 * ```
 */
export function usePagesRouterPageTracking(options: UsePagesRouterPageTrackingOptions = {}): void {
  const {
    enabled = true,
    trackInitialPageView = true,
    properties,
    includeSearchParams = true,
  } = options;

  const router = useRouter();
  const contextAnalytics = useOptionalAnalytics();
  const analytics = options.analytics ?? contextAnalytics;

  const latest = useRef({ properties });
  latest.current = { properties };

  const initialTrackedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !analytics || !router?.events) return;

    const send = (url: string): void => {
      const path = includeSearchParams ? url : (url.split('?')[0] ?? url);
      const resolved =
        typeof latest.current.properties === 'function'
          ? latest.current.properties()
          : latest.current.properties;
      analytics.page(path, resolved);
    };

    if (trackInitialPageView && !initialTrackedRef.current) {
      initialTrackedRef.current = true;
      send(router.asPath);
    }

    router.events.on('routeChangeComplete', send);
    return () => {
      router.events.off('routeChangeComplete', send);
    };
  }, [analytics, enabled, includeSearchParams, router, trackInitialPageView]);
}
