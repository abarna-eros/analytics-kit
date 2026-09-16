/**
 * Optional Next.js integration.
 *
 * Importing this entry is the only thing that pulls `next` into your bundle;
 * the core package and the React entry never reference it. `next` is declared
 * as an optional peer dependency.
 */

export { NextAnalyticsProvider, type NextAnalyticsProviderProps } from './NextAnalyticsProvider';
export { useNextPageTracking, type UseNextPageTrackingOptions } from './useNextPageTracking';
export {
  usePagesRouterPageTracking,
  type UsePagesRouterPageTrackingOptions,
} from './usePagesRouterPageTracking';
export { AnalyticsScript, type AnalyticsScriptProps } from './AnalyticsScript';

// Re-exported so App Router apps only need one import for the common case.
export { AnalyticsProvider, useAnalytics, useConsent, AnalyticsBoundary } from '../react';
