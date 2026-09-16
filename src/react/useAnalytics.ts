import { useContext } from 'react';
import { AnalyticsContext } from './context';
import type { Analytics, AnalyticsEventMap, DefaultEventMap } from '../core/types';

/**
 * Returns the analytics instance provided by the nearest
 * {@link AnalyticsProvider}.
 *
 * @example
 * ```tsx
 * const analytics = useAnalytics<AppEvents>();
 * analytics.track('button_clicked', { buttonName: 'Login', location: 'header' });
 * ```
 *
 * @throws When no provider is present. This is a setup mistake rather than a
 * runtime analytics failure, so it fails loudly instead of silently no-oping.
 * Use {@link useOptionalAnalytics} if a missing provider is expected.
 */
export function useAnalytics<
  TEvents extends AnalyticsEventMap = DefaultEventMap,
>(): Analytics<TEvents> {
  const analytics = useContext(AnalyticsContext);

  if (!analytics) {
    throw new Error(
      '[Analytics] useAnalytics() was called outside of <AnalyticsProvider>. ' +
        'Wrap your application (or the component under test) in <AnalyticsProvider analytics={analytics}>.'
    );
  }

  return analytics as unknown as Analytics<TEvents>;
}

/** Like {@link useAnalytics}, but returns `null` instead of throwing. */
export function useOptionalAnalytics<
  TEvents extends AnalyticsEventMap = DefaultEventMap,
>(): Analytics<TEvents> | null {
  return useContext(AnalyticsContext) as unknown as Analytics<TEvents> | null;
}
