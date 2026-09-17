import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../data/site';
import { CodeBlock } from '../components/docs/CodeBlock';
import { InstallTabs } from '../components/docs/InstallTabs';

export interface DocPage {
  title: string;
  summary: string;
  readme?: string;
  body: ReactNode;
}

const more = (hash: string) => (
  <p>
    Full detail: <a href={`${SITE.readmeUrl}${hash}`}>README</a>.
  </p>
);

export const DOCS: Record<string, DocPage> = {
  overview: {
    title: 'Overview',
    summary: 'One provider-independent analytics API for React and Next.js.',
    readme: '#1-introduction',
    body: (
      <>
        <p>
          Configure Google Analytics 4, Twilio Segment and Microsoft Clarity once, then call{' '}
          <code>track</code>, <code>page</code> and <code>identify</code> without vendor-specific
          code in your application.
        </p>
        <CodeBlock code={`analytics.track('product_viewed', { productId: '123', productName: 'Example' });`} />
        <p>
          That single call is mapped to <code>gtag('event', ...)</code>, Segment{' '}
          <code>analytics.track(...)</code> and <code>clarity('event', ...)</code>.
        </p>
        {more('#1-introduction')}
      </>
    ),
  },
  installation: {
    title: 'Installation',
    summary: 'Install the npm package and peer dependencies.',
    readme: '#4-installation',
    body: (
      <>
        <InstallTabs />
        <p>
          React <code>{SITE.reactPeer}</code> is a peer dependency for the <code>/react</code> and{' '}
          <code>/next</code> entries. Next.js <code>{SITE.nextPeer}</code> is optional and only
          required if you import <code>analytics-bridge/next</code>.
        </p>
        {more('#4-installation')}
      </>
    ),
  },
  'quick-start': {
    title: 'Quick Start',
    summary: 'Create an instance, initialize providers, then track.',
    readme: '#5-quick-start',
    body: (
      <>
        <h3>1. Install</h3>
        <CodeBlock language="bash" code="npm install analytics-bridge" />
        <h3>2. Create an instance</h3>
        <CodeBlock
          code={`import { createAnalytics } from 'analytics-bridge';

export const analytics = createAnalytics();`}
        />
        <h3>3. Initialize</h3>
        <CodeBlock
          code={`await analytics.init({
  providers: {
    googleAnalytics: {
      measurementId: 'G-XXXXXXXXXX'
    },
    segment: {
      writeKey: 'YOUR_WRITE_KEY'
    },
    clarity: {
      projectId: 'YOUR_PROJECT_ID'
    }
  }
});`}
        />
        <h3>4. Track</h3>
        <CodeBlock
          code={`analytics.track('product_viewed', {
  productId: '123'
});`}
        />
        <p>
          <code>init()</code> is idempotent. Calls made before it resolves are buffered and replayed.
        </p>
        {more('#5-quick-start')}
      </>
    ),
  },
  react: {
    title: 'React',
    summary: 'Context provider, hooks, page tracking and error boundary.',
    readme: '#6-react-setup',
    body: (
      <>
        <CodeBlock code={`import { AnalyticsProvider } from 'analytics-bridge/react';`} />
        <p>
          Create one instance outside render. <code>AnalyticsProvider</code> initializes in an
          effect so server rendering never touches <code>window</code>. <code>init()</code> is
          StrictMode-safe.
        </p>
        <ul>
          <li>
            <code>useAnalytics()</code> — required context consumer
          </li>
          <li>
            <code>usePageTracking()</code> — optional SPA page views
          </li>
          <li>
            <code>useConsent()</code> — consent state and actions
          </li>
          <li>
            <code>AnalyticsBoundary</code> — reports render errors via <code>trackError</code>
          </li>
        </ul>
        {more('#6-react-setup')}
      </>
    ),
  },
  nextjs: {
    title: 'Next.js',
    summary: 'Optional App Router and Pages Router integration.',
    readme: '#7-nextjs-setup',
    body: (
      <>
        <CodeBlock code={`import { NextAnalyticsProvider } from 'analytics-bridge/next';`} />
        <p>
          The core package does not import Next.js. Use <code>analytics-bridge/next</code> only in
          client components. <code>NextAnalyticsProvider</code> wraps route tracking in{' '}
          <code>Suspense</code> because <code>useSearchParams()</code> would otherwise opt the whole
          route into client rendering.
        </p>
        <ul>
          <li>App Router: <code>useNextPageTracking</code></li>
          <li>Pages Router: <code>usePagesRouterPageTracking</code></li>
          <li>
            Optional <code>AnalyticsScript</code> for <code>next/script</code> loading
          </li>
        </ul>
        {more('#7-nextjs-setup')}
      </>
    ),
  },
  'google-analytics': {
    title: 'Google Analytics 4',
    summary: 'Official gtag.js provider.',
    readme: '#8-google-analytics-4-setup',
    body: (
      <>
        <p>
          Configure with a public Measurement ID. The package maps <code>track</code>,{' '}
          <code>page</code> and <code>identify</code> onto gtag. Set <code>sendPageView: false</code>{' '}
          if this library is sending page views itself.
        </p>
        <CodeBlock
          code={`googleAnalytics: {
  measurementId: 'G-XXXXXXXXXX',
  sendPageView: false
}`}
        />
        {more('#8-google-analytics-4-setup')}
      </>
    ),
  },
  segment: {
    title: 'Twilio Segment',
    summary: 'Official analytics.js provider.',
    readme: '#9-segment-setup',
    body: (
      <>
        <p>The Segment write key is a public client identifier. Identify, track, page, group and reset map onto analytics.js.</p>
        <CodeBlock code={`segment: { writeKey: 'YOUR_WRITE_KEY' }`} />
        {more('#9-segment-setup')}
      </>
    ),
  },
  clarity: {
    title: 'Microsoft Clarity',
    summary: 'Official Clarity tag with a typed provider-specific API.',
    readme: '#10-clarity-setup',
    body: (
      <>
        <CodeBlock code={`clarity: { projectId: 'YOUR_PROJECT_ID' }`} />
        <p>
          Provider-specific helpers stay off the generic API. Use <code>getClarity(analytics)</code>{' '}
          for tags, custom events and session upgrade.
        </p>
        {more('#10-clarity-setup')}
      </>
    ),
  },
  events: {
    title: 'Events',
    summary: 'Typed track() and the trackEvent escape hatch.',
    readme: '#11-event-tracking',
    body: (
      <>
        <CodeBlock code={`analytics.track('button_clicked', { buttonName: 'Signup', location: 'header' });`} />
        <p>
          Pass an event map to <code>createAnalytics&lt;AppEvents&gt;()</code> for compile-time
          checks. Use <code>trackEvent</code> for names that are not known at compile time.
        </p>
        {more('#11-event-tracking')}
      </>
    ),
  },
  pages: {
    title: 'Pages',
    summary: 'page() and optional automatic page tracking.',
    readme: '#12-page-tracking',
    body: (
      <>
        <CodeBlock code={`analytics.page();
analytics.page('/dashboard');`} />
        <p>Automatic page tracking is opt-in via React Router, Next.js hooks, or autoTrack.pageViews.</p>
        {more('#12-page-tracking')}
      </>
    ),
  },
  users: {
    title: 'Users',
    summary: 'identify() and reset().',
    readme: '#13-user-identification',
    body: (
      <>
        <CodeBlock
          code={`analytics.identify('user-123', { name: 'John', plan: 'premium' });
analytics.reset();`}
        />
        {more('#13-user-identification')}
      </>
    ),
  },
  groups: {
    title: 'Groups',
    summary: 'Associate the current user with an account.',
    readme: '#14-group-tracking',
    body: (
      <>
        <CodeBlock code={`analytics.group('company-123', { name: 'Example Company' });`} />
        <p>Clarity has no group concept unless you enable traits-as-tags.</p>
        {more('#14-group-tracking')}
      </>
    ),
  },
  consent: {
    title: 'Consent',
    summary: 'Category-based gating that is CMP-agnostic.',
    readme: '#15-consent-management',
    body: (
      <>
        <CodeBlock
          code={`analytics.setConsent({ analytics: true, marketing: false, personalization: false });
analytics.getConsent();
analytics.clearConsent();`}
        />
        <p>
          Supplying a <code>consent</code> block turns the gate on. Providers initialize only when
          their required category is granted. Calls can be buffered until a decision.
        </p>
        {more('#15-consent-management')}
      </>
    ),
  },
  'automatic-tracking': {
    title: 'Automatic Tracking',
    summary: 'All automatic listeners are off unless you enable them.',
    readme: '#16-automatic-tracking',
    body: (
      <>
        <p>Optional page views, outbound links, opted-in element clicks and visibility changes.</p>
        {more('#16-automatic-tracking')}
      </>
    ),
  },
  performance: {
    title: 'Performance',
    summary: 'Optional Web Vitals via PerformanceObserver.',
    readme: '#17-performance-tracking',
    body: (
      <>
        <p>TTFB, FCP, LCP, CLS, INP and navigation timing. Disabled by default. Collection is scheduled idle so it does not block rendering.</p>
        {more('#17-performance-tracking')}
      </>
    ),
  },
  'error-tracking': {
    title: 'Error Tracking',
    summary: 'Manual trackError and optional global capture.',
    readme: '#18-error-tracking',
    body: (
      <>
        <CodeBlock code={`analytics.trackError(error, { component: 'Checkout', action: 'payment' });`} />
        <p>
          <code>captureErrors</code> defaults to false. Stack traces are opt-in.
        </p>
        {more('#18-error-tracking')}
      </>
    ),
  },
  batching: {
    title: 'Batching',
    summary: 'Optional event queue with flush().',
    readme: '#19-batching',
    body: (
      <>
        <CodeBlock
          code={`batching: { enabled: true, maxEvents: 10, flushInterval: 5000 }
await analytics.flush();`}
        />
        {more('#19-batching')}
      </>
    ),
  },
  offline: {
    title: 'Offline Support',
    summary: 'Optional queue while navigator.onLine is false.',
    readme: '#20-offline-support',
    body: (
      <>
        <p>Disabled by default. When enabled, queued calls flush on reconnect. Persistence is capped.</p>
        {more('#20-offline-support')}
      </>
    ),
  },
  plugins: {
    title: 'Plugins',
    summary: 'Observe, enrich or veto calls.',
    readme: '#22-plugins',
    body: (
      <>
        <p>
          Lifecycle: initialize, beforeSend, track, page, identify, group, reset, destroy. Plugin
          failures are isolated.
        </p>
        {more('#22-plugins')}
      </>
    ),
  },
  'custom-providers': {
    title: 'Custom Providers',
    summary: 'Implement AnalyticsProvider and register it.',
    readme: '#21-custom-providers',
    body: (
      <>
        <p>
          The core talks only to <code>AnalyticsProvider</code>. See also{' '}
          <a href="https://github.com/abarna-eros/analytics-kit/blob/master/docs/custom-providers.md">
            docs/custom-providers.md
          </a>
          .
        </p>
        {more('#21-custom-providers')}
      </>
    ),
  },
  api: {
    title: 'API',
    summary: 'Public client methods.',
    readme: '#28-api-reference',
    body: (
      <>
        <p>
          Import <code>createAnalytics</code> from <code>analytics-bridge</code>, React helpers from{' '}
          <code>analytics-bridge/react</code>, and Next.js helpers from{' '}
          <code>analytics-bridge/next</code>.
        </p>
        <table>
          <thead>
            <tr>
              <th>API</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>track()</code>
              </td>
              <td>Track a typed event</td>
            </tr>
            <tr>
              <td>
                <code>page()</code>
              </td>
              <td>Track a page view</td>
            </tr>
            <tr>
              <td>
                <code>identify()</code>
              </td>
              <td>Identify a user</td>
            </tr>
            <tr>
              <td>
                <code>group()</code>
              </td>
              <td>Associate a group</td>
            </tr>
            <tr>
              <td>
                <code>reset()</code>
              </td>
              <td>Clear identity</td>
            </tr>
          </tbody>
        </table>
        {more('#28-api-reference')}
      </>
    ),
  },
  typescript: {
    title: 'TypeScript',
    summary: 'Event maps and exported types.',
    readme: '#23-typescript',
    body: (
      <>
        <p>
          The package ships declaration files for every entry. Prefer the typed <code>track</code>{' '}
          map; use <code>trackEvent</code> as an escape hatch.
        </p>
        {more('#23-typescript')}
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    summary: 'Redaction, opt-out, DNT and storage.',
    readme: '#24-privacy',
    body: (
      <>
        <p>
          Nothing is collected automatically. Known-sensitive keys are redacted before dispatch.
          Developer logs additionally redact email and phone.
        </p>
        {more('#24-privacy')}
      </>
    ),
  },
  security: {
    title: 'Security',
    summary: 'Which credentials may appear in a browser bundle.',
    readme: '#25-security',
    body: (
      <>
        <p>
          Measurement IDs, Segment write keys and Clarity project IDs are public client identifiers.
          Measurement Protocol secrets, Segment access tokens and Clarity export tokens must stay
          server-side.
        </p>
        {more('#25-security')}
      </>
    ),
  },
  troubleshooting: {
    title: 'Troubleshooting',
    summary: 'Common setup issues.',
    readme: '#27-troubleshooting',
    body: (
      <>
        <p>
          Enable <code>debug: true</code>. Typical causes: no consent decision,{' '}
          <code>disableInTest</code>, or an ad blocker. Developer logging APIs never send events to
          providers.
        </p>
        {more('#27-troubleshooting')}
      </>
    ),
  },
  contributing: {
    title: 'Contributing',
    summary: 'Local development commands.',
    readme: '#29-contributing',
    body: (
      <>
        <CodeBlock
          language="bash"
          code={`npm install
npm run verify`}
        />
        <p>Keep provider-specific code inside its provider directory.</p>
        {more('#29-contributing')}
      </>
    ),
  },
  license: {
    title: 'License',
    summary: `${SITE.license} License.`,
    readme: '#30-license',
    body: (
      <>
        <p>
          {SITE.productName} is released under the {SITE.license} License. See{' '}
          <a href={SITE.licenseUrl}>LICENSE</a>.
        </p>
      </>
    ),
  },
};

export function DocsArticle({ slug }: { slug: string }) {
  const page = DOCS[slug];
  if (!page) {
    return (
      <>
        <h1>Not found</h1>
        <p>
          That page does not exist. <Link to="/docs/overview">Back to overview</Link>.
        </p>
      </>
    );
  }
  return (
    <>
      <h1>{page.title}</h1>
      <p className="lead">{page.summary}</p>
      {page.body}
    </>
  );
}
