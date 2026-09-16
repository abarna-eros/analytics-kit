import { useAnalytics, useConsent } from 'analytics-bridge/react';
import type { AppEvents } from '../analytics';

export function AccountPage() {
  const analytics = useAnalytics<AppEvents>();
  const { consent, clearConsent } = useConsent();

  return (
    <section>
      <h1>Account</h1>

      <button onClick={() => analytics.identify('user-123', { name: 'John', plan: 'premium' })}>
        Identify user
      </button>

      <button onClick={() => analytics.group('company-123', { name: 'Example Company' })}>
        Associate company
      </button>

      {/* Call reset on logout: clears identity and rotates the anonymous id */}
      <button onClick={() => analytics.reset()}>Log out (reset)</button>

      <hr />

      <h2>Privacy</h2>
      <button onClick={() => analytics.optOut()}>Opt out</button>
      <button onClick={() => analytics.optIn()}>Opt in</button>
      <button onClick={clearConsent}>Reopen the consent banner</button>

      <pre>{JSON.stringify({ consent, identity: analytics.getIdentity() }, null, 2)}</pre>
      <pre>{JSON.stringify(analytics.getProviderStatus(), null, 2)}</pre>
    </section>
  );
}
