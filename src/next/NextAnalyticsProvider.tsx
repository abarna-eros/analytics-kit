import { Suspense, type ReactNode } from 'react';
import { AnalyticsProvider, type AnalyticsProviderProps } from '../react/AnalyticsProvider';
import { useNextPageTracking, type UseNextPageTrackingOptions } from './useNextPageTracking';
import type { AnalyticsEventMap } from '../core/types';

export interface NextAnalyticsProviderProps<
  TEvents extends AnalyticsEventMap = AnalyticsEventMap,
> extends Omit<AnalyticsProviderProps<TEvents>, 'pageTracking'> {
  /** App Router page tracking. @default true */
  pageTracking?: boolean | UseNextPageTrackingOptions;
}

function AppRouterPageTracker(options: UseNextPageTrackingOptions): null {
  useNextPageTracking(options);
  return null;
}

/**
 * App Router wrapper around {@link AnalyticsProvider} with route tracking
 * wired up.
 *
 * The tracker lives inside a `<Suspense>` boundary because `useSearchParams()`
 * would otherwise opt the whole route into client-side rendering.
 *
 * @example
 * ```tsx
 * // app/providers.tsx
 * 'use client';
 * import { createAnalytics } from '@analytics-kit/react-analytics';
 * import { NextAnalyticsProvider } from '@analytics-kit/react-analytics/next';
 *
 * const analytics = createAnalytics();
 *
 * export function Providers({ children }: { children: React.ReactNode }) {
 *   return (
 *     <NextAnalyticsProvider
 *       analytics={analytics}
 *       config={{
 *         providers: {
 *           googleAnalytics: { measurementId: process.env.NEXT_PUBLIC_GA_ID! },
 *         },
 *       }}
 *     >
 *       {children}
 *     </NextAnalyticsProvider>
 *   );
 * }
 * ```
 */
export function NextAnalyticsProvider<TEvents extends AnalyticsEventMap = AnalyticsEventMap>({
  pageTracking = true,
  children,
  ...providerProps
}: NextAnalyticsProviderProps<TEvents>): ReactNode {
  const trackingOptions: UseNextPageTrackingOptions =
    typeof pageTracking === 'object' ? pageTracking : {};
  const trackingEnabled = pageTracking !== false && trackingOptions.enabled !== false;

  return (
    <AnalyticsProvider {...providerProps} pageTracking={false}>
      {trackingEnabled ? (
        <Suspense fallback={null}>
          <AppRouterPageTracker {...trackingOptions} />
        </Suspense>
      ) : null}
      {children}
    </AnalyticsProvider>
  );
}
