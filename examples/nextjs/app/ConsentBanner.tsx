'use client';

import { useConsent } from '@analytics-kit/react-analytics/next';

export function ConsentBanner() {
  const { consent, setConsent } = useConsent();

  if (consent.decided) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: '#111',
        color: '#fff',
      }}
    >
      <span>We use analytics cookies to understand how the product is used.</span>

      <button
        onClick={() => setConsent({ analytics: true, marketing: true, personalization: true })}
      >
        Accept all
      </button>

      <button
        onClick={() => setConsent({ analytics: false, marketing: false, personalization: false })}
      >
        Reject all
      </button>
    </div>
  );
}
