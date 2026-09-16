import { useAnalytics } from '@analytics-kit/react-analytics/react';
import type { AppEvents } from '../analytics';

export function HomePage() {
  const analytics = useAnalytics<AppEvents>();

  return (
    <section>
      <h1>Home</h1>

      <button
        onClick={() =>
          analytics.track('button_clicked', { buttonName: 'Signup', location: 'hero' })
        }
      >
        Sign up
      </button>

      {/* Dynamic event names use the escape hatch instead of the typed map */}
      <button onClick={() => analytics.trackEvent(`experiment_${Date.now() % 2}_viewed`)}>
        Track a dynamic event
      </button>

      {/* Errors are reported only when you ask for them */}
      <button
        onClick={() => {
          try {
            throw new Error('Simulated failure');
          } catch (error) {
            analytics.trackError(error, { component: 'HomePage', action: 'demo' });
          }
        }}
      >
        Report an error
      </button>
    </section>
  );
}
