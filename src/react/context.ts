import { createContext } from 'react';
import type { Analytics, AnalyticsEventMap } from '../core/types';

/**
 * Context holding the analytics instance.
 *
 * Typed loosely on purpose: {@link useAnalytics} re-applies the caller's event
 * map, so applications keep full type safety without the context having to know
 * about their event definitions.
 */
export const AnalyticsContext = createContext<Analytics<AnalyticsEventMap> | null>(null);

AnalyticsContext.displayName = 'AnalyticsContext';
