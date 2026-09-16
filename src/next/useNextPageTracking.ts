import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePageTracking, type UsePageTrackingOptions } from '../react/usePageTracking';

export interface UseNextPageTrackingOptions extends Omit<UsePageTrackingOptions, 'path'> {
  /** Append the query string to the tracked path. @default true */
  includeSearchParams?: boolean;
}

/**
 * Page tracking for the Next.js **App Router**.
 *
 * @remarks
 * `useSearchParams()` opts the closest boundary into client-side rendering, so
 * render this hook inside a `<Suspense>` boundary (or use
 * {@link NextAnalyticsProvider}, which does it for you).
 *
 * @example
 * ```tsx
 * 'use client';
 * export function PageTracker() {
 *   useNextPageTracking();
 *   return null;
 * }
 * ```
 */
export function useNextPageTracking(options: UseNextPageTrackingOptions = {}): void {
  const { includeSearchParams = true, ...rest } = options;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const path = useMemo(() => {
    const base = pathname ?? '';
    if (!includeSearchParams) return base;
    const query = searchParams?.toString() ?? '';
    return query ? `${base}?${query}` : base;
  }, [pathname, searchParams, includeSearchParams]);

  usePageTracking({ ...rest, path });
}
