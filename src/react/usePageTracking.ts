import { useEffect, useRef } from 'react';
import { useOptionalAnalytics } from './useAnalytics';
import type { Analytics, AnalyticsEventMap, PageProperties } from '../core/types';
import { getCurrentUrl, onHistoryChange } from '../utils/history';

export interface UsePageTrackingOptions {
  /** Turn tracking on/off without changing the hook call order. @default true */
  enabled?: boolean;

  /**
   * Instance to use instead of the one from context. Needed when the hook runs
   * in the same component that renders the provider.
   */
  analytics?: Analytics<AnalyticsEventMap>;

  /**
   * Controlled mode: pass the current path (for example from React Router's
   * `useLocation().pathname`) and a page view is sent whenever it changes.
   * When omitted, navigation is detected from the History API instead.
   */
  path?: string;

  /** Page name forwarded to providers. Defaults to the current path. */
  name?: string;

  /** Extra properties, or a factory evaluated on every page view. */
  properties?: PageProperties | (() => PageProperties);

  /** Send a page view for the page the user landed on. @default true */
  trackInitialPageView?: boolean;

  /** Skip consecutive page views for the same URL. @default true */
  deduplicate?: boolean;
}

/**
 * Optional automatic page tracking.
 *
 * Works with any router: in controlled mode it reacts to the `path` you pass
 * (React Router, TanStack Router, ...), otherwise it listens to History API
 * navigation. Nothing runs during server rendering.
 *
 * @example
 * ```tsx
 * // React Router
 * usePageTracking({ path: useLocation().pathname });
 *
 * // Router-agnostic
 * usePageTracking();
 * ```
 */
export function usePageTracking(options: UsePageTrackingOptions = {}): void {
  const {
    enabled = true,
    path,
    name,
    properties,
    trackInitialPageView = true,
    deduplicate = true,
  } = options;

  const contextAnalytics = useOptionalAnalytics();
  const analytics = options.analytics ?? contextAnalytics;
  const lastUrlRef = useRef<string | null>(null);
  const initialTrackedRef = useRef(false);

  // Keep the latest values without making them effect dependencies, so page
  // views are not re-sent when an inline properties object changes identity.
  const latest = useRef({ name, properties, deduplicate });
  latest.current = { name, properties, deduplicate };

  useEffect(() => {
    if (!enabled || !analytics) return;

    const sendPageView = (url: string): void => {
      const current = latest.current;
      if (current.deduplicate && lastUrlRef.current === url) return;
      lastUrlRef.current = url;

      const resolvedProperties =
        typeof current.properties === 'function' ? current.properties() : current.properties;

      analytics.page(current.name, resolvedProperties);
    };

    // Controlled mode: the router tells us when the location changed.
    if (path !== undefined) {
      if (!trackInitialPageView && !initialTrackedRef.current) {
        initialTrackedRef.current = true;
        lastUrlRef.current = path;
        return;
      }
      initialTrackedRef.current = true;
      sendPageView(path);
      return;
    }

    if (trackInitialPageView && !initialTrackedRef.current) {
      initialTrackedRef.current = true;
      sendPageView(getCurrentUrl());
    }

    return onHistoryChange((url) => sendPageView(url));
  }, [analytics, enabled, path, trackInitialPageView]);
}
