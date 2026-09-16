'use client';

import type { ReactNode } from 'react';
import { NextAnalyticsProvider } from '@analytics-kit/react-analytics/next';
import { analytics, analyticsConfig, type AppEvents } from './analytics';
import { ConsentBanner } from './ConsentBanner';

/**
 * Client boundary for analytics.
 *
 * `NextAnalyticsProvider` initialises the instance in an effect and tracks App
 * Router navigations. It wraps its route tracker in `<Suspense>` internally, so
 * `useSearchParams()` does not force the whole route to render client-side.
 *
 * Server Components rendered as `children` stay server-rendered: they are
 * passed through this boundary as an already-rendered tree.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextAnalyticsProvider<AppEvents> analytics={analytics} config={analyticsConfig}>
      {children}
      <ConsentBanner />
    </NextAnalyticsProvider>
  );
}
