import { useCallback, useEffect, useState } from 'react';
import { useAnalytics } from './useAnalytics';
import type { ConsentSnapshot, ConsentState } from '../core/types';

export interface UseConsentResult {
  /** Current decisions. `decided` is `false` until the user answers. */
  consent: ConsentSnapshot;
  setConsent: (consent: ConsentState) => void;
  clearConsent: () => void;
  /** Convenience check for a single category. */
  isGranted: (category: string) => boolean;
}

/**
 * Subscribes a component to consent changes, for rendering cookie banners and
 * privacy settings screens.
 *
 * @example
 * ```tsx
 * const { consent, setConsent } = useConsent();
 *
 * if (consent.decided) return null;
 * return <button onClick={() => setConsent({ analytics: true })}>Accept</button>;
 * ```
 */
export function useConsent(): UseConsentResult {
  const analytics = useAnalytics();
  const [consent, setConsentState] = useState<ConsentSnapshot>(() => analytics.getConsent());

  useEffect(() => {
    // Re-read on mount: the decision may have been restored from storage after
    // the initial render, and the server render never sees stored consent.
    setConsentState(analytics.getConsent());
    return analytics.onConsentChange(setConsentState);
  }, [analytics]);

  const setConsent = useCallback(
    (next: ConsentState) => {
      analytics.setConsent(next);
    },
    [analytics]
  );

  const clearConsent = useCallback(() => {
    analytics.clearConsent();
  }, [analytics]);

  const isGranted = useCallback(
    (category: string) => consent.categories[category] === true,
    [consent]
  );

  return { consent, setConsent, clearConsent, isGranted };
}
