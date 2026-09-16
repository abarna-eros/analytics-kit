import { useEffect, useRef, type ReactNode } from 'react';
import { AnalyticsContext } from './context';
import { usePageTracking, type UsePageTrackingOptions } from './usePageTracking';
import type { Analytics, AnalyticsConfig, AnalyticsEventMap } from '../core/types';

export interface AnalyticsProviderProps<TEvents extends AnalyticsEventMap = AnalyticsEventMap> {
  /** The instance created with `createAnalytics()`. Create it once, outside render. */
  analytics: Analytics<TEvents>;

  /**
   * Initialise the instance on mount with this configuration.
   * Omit it if you call `analytics.init()` yourself.
   */
  config?: AnalyticsConfig;

  /**
   * Automatic page tracking. `true` uses the defaults, or pass options for
   * controlled mode (e.g. `{ path: location.pathname }`).
   * @default false
   */
  pageTracking?: boolean | UsePageTrackingOptions;

  /**
   * Destroy the instance when the provider unmounts. Off by default: analytics
   * instances normally outlive the React tree, and React StrictMode mounts
   * effects twice in development.
   * @default false
   */
  destroyOnUnmount?: boolean;

  children?: ReactNode;
}

/**
 * Makes an analytics instance available to the React tree.
 *
 * Initialisation happens in an effect, so nothing touches `window`,
 * `document` or `localStorage` during server rendering. `init()` is idempotent,
 * which keeps StrictMode's double-mount from creating duplicate providers.
 *
 * @example
 * ```tsx
 * const analytics = createAnalytics<AppEvents>();
 *
 * export function App() {
 *   return (
 *     <AnalyticsProvider
 *       analytics={analytics}
 *       config={{ providers: { googleAnalytics: { measurementId: 'G-XXXXXXXXXX' } } }}
 *       pageTracking
 *     >
 *       <Routes />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */
export function AnalyticsProvider<TEvents extends AnalyticsEventMap = AnalyticsEventMap>({
  analytics,
  config,
  pageTracking = false,
  destroyOnUnmount = false,
  children,
}: AnalyticsProviderProps<TEvents>): ReactNode {
  // The config object is usually an inline literal; capture it in a ref so a
  // new identity on every render cannot retrigger initialisation.
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!configRef.current) return;

    void analytics.init(configRef.current);

    return () => {
      if (destroyOnUnmount) void analytics.destroy();
    };
  }, [analytics, destroyOnUnmount]);

  const pageTrackingOptions: UsePageTrackingOptions =
    typeof pageTracking === 'object' ? pageTracking : { enabled: pageTracking };

  usePageTracking({
    ...pageTrackingOptions,
    // The hook runs above the context value, so the instance is passed directly.
    analytics: analytics as unknown as Analytics<AnalyticsEventMap>,
    enabled: pageTrackingOptions.enabled !== false && pageTracking !== false,
  });

  return (
    <AnalyticsContext.Provider value={analytics as unknown as Analytics<AnalyticsEventMap>}>
      {children}
    </AnalyticsContext.Provider>
  );
}
