/**
 * React integration.
 *
 * This entry only depends on `react` (a peer dependency) and on the package's
 * public types. It never imports Next.js, and every browser access happens
 * inside effects so server rendering stays safe.
 */

export { AnalyticsProvider, type AnalyticsProviderProps } from './AnalyticsProvider';
export { AnalyticsContext } from './context';
export { useAnalytics, useOptionalAnalytics } from './useAnalytics';
export { usePageTracking, type UsePageTrackingOptions } from './usePageTracking';
export { useConsent, type UseConsentResult } from './useConsent';
export { AnalyticsBoundary, type AnalyticsBoundaryProps } from './AnalyticsBoundary';
