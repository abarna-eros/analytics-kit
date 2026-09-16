'use client';

import { useAnalytics } from '@analytics-kit/react-analytics/next';
import type { AppEvents } from './analytics';

export function TrackingButtons() {
  const analytics = useAnalytics<AppEvents>();

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() =>
          analytics.track('button_clicked', { buttonName: 'Signup', location: 'hero' })
        }
      >
        Sign up
      </button>

      {/* Escape hatch for names not in the typed map */}
      <button onClick={() => analytics.trackEvent('dynamic_event', { source: 'home' })}>
        Dynamic event
      </button>

      <button
        onClick={() => {
          try {
            throw new Error('Simulated failure');
          } catch (error) {
            analytics.trackError(error, { component: 'TrackingButtons' });
          }
        }}
      >
        Report an error
      </button>
    </div>
  );
}
