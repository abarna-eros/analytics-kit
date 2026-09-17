import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../data/site';
import { ApiCard } from '../components/docs/ApiCard';
import { ArchitectureDiagram } from '../components/docs/ArchitectureDiagram';
import { AuthorSection } from '../components/docs/AuthorSection';
import { CodeBlock } from '../components/docs/CodeBlock';
import { FeatureGrid } from '../components/docs/FeatureGrid';
import { Hero } from '../components/docs/Hero';
import { InstallTabs } from '../components/docs/InstallTabs';
import { ProviderCard } from '../components/docs/ProviderCard';
import { VersionSupport } from '../components/docs/VersionSupport';

const InteractiveDemo = lazy(() =>
  import('../components/docs/InteractiveDemo').then((module) => ({ default: module.InteractiveDemo }))
);

function FrameworkTabs() {
  const [tab, setTab] = useState<'react' | 'next'>('react');
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Framework">
        <button className="btn btn-ghost" type="button" role="tab" aria-selected={tab === 'react'} onClick={() => setTab('react')}>
          React
        </button>
        <button className="btn btn-ghost" type="button" role="tab" aria-selected={tab === 'next'} onClick={() => setTab('next')}>
          Next.js
        </button>
      </div>
      {tab === 'react' ? (
        <>
          <CodeBlock code={`import { AnalyticsProvider } from 'analytics-bridge/react';`} />
          <p>
            Includes <code>AnalyticsProvider</code>, <code>useAnalytics</code>,{' '}
            <code>usePageTracking</code>, <code>AnalyticsBoundary</code>, and StrictMode-safe{' '}
            <code>init()</code>.
          </p>
        </>
      ) : (
        <>
          <CodeBlock code={`import { NextAnalyticsProvider } from 'analytics-bridge/next';`} />
          <p>
            App Router and Pages Router helpers, navigation tracking, optional{' '}
            <code>next/script</code> tags, and client-only initialization.
          </p>
        </>
      )}
    </>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />

      <section className="section section-muted" id="providers">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Providers</p>
            <h2>One API. Three destinations.</h2>
          </header>
          <ProviderCard />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Why Analytics Bridge</p>
            <h2>Stop scattering analytics code across your application.</h2>
          </header>
          <div className="grid-2">
            <article className="card" style={{ padding: 18 }}>
              <h3>Before</h3>
              <CodeBlock
                code={`gtag('event', 'purchase', { ... });
analytics.track('purchase', { ... });
clarity('event', 'purchase');`}
              />
              <p>Vendor-specific code spreads across components.</p>
            </article>
            <article className="card" style={{ padding: 18 }}>
              <h3>With Analytics Bridge</h3>
              <CodeBlock
                code={`analytics.track('checkout_started', {
  plan: 'pro'
});`}
              />
              <p>One API dispatches to every configured provider.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Capabilities</p>
            <h2>Features</h2>
          </header>
          <FeatureGrid />
        </div>
      </section>

      <section className="section" id="quick-start">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Quick start</p>
            <h2>Get started in minutes</h2>
          </header>
          <h3>1. Install</h3>
          <InstallTabs />
          <h3>2. Create</h3>
          <CodeBlock
            code={`import { createAnalytics } from 'analytics-bridge';

export const analytics = createAnalytics();`}
          />
          <h3>3. Initialize</h3>
          <CodeBlock
            code={`await analytics.init({
  providers: {
    googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    segment: { writeKey: 'YOUR_WRITE_KEY' },
    clarity: { projectId: 'YOUR_PROJECT_ID' }
  }
});`}
          />
          <h3>4. Track</h3>
          <CodeBlock
            code={`analytics.track('product_viewed', {
  productId: '123'
});`}
          />
        </div>
      </section>

      <section className="section section-muted" id="api">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Reference</p>
            <h2>API overview</h2>
          </header>
          <ApiCard />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Frameworks</p>
            <h2>Built for React and Next.js</h2>
          </header>
          <FrameworkTabs />
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Internals</p>
            <h2>Architecture</h2>
            <p className="lead">
              Calls enter one SDK, then flow through consent, core, providers and destinations with
              isolation, privacy and retry along the way.
            </p>
          </header>
          <ArchitectureDiagram />
        </div>
      </section>

      <section className="section" id="examples">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Live console</p>
            <h2>See it in action</h2>
          </header>
          <Suspense fallback={<p>Loading demo…</p>}>
            <InteractiveDemo />
          </Suspense>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <header className="section-head">
            <p className="section-kicker">Compatibility</p>
            <h2>Version Support</h2>
          </header>
          <VersionSupport />
        </div>
      </section>

      <AuthorSection />
    </>
  );
}

export function ExamplesPage() {
  return (
    <div className="container section">
      <h1>Examples</h1>
      <p className="lead">Runnable apps live in the repository. They use placeholder credentials only.</p>
      <div className="grid-2">
        <article className="card" style={{ padding: 18 }}>
          <h3>React (Vite + React Router)</h3>
          <p>Consent banner, typed events, identify/reset, provider targeting.</p>
          <a href={SITE.examplesReactUrl}>examples/react</a>
        </article>
        <article className="card" style={{ padding: 18 }}>
          <h3>Next.js App Router</h3>
          <p>Server Components, client analytics boundary, route tracking.</p>
          <a href={SITE.examplesNextUrl}>examples/nextjs</a>
        </article>
      </div>
      <p style={{ marginTop: 24 }}>
        <Link to="/docs/quick-start">Get started</Link>
      </p>
    </div>
  );
}

export function ChangelogPage() {
  return (
    <div className="container section prose">
      <h1>Changelog</h1>
      <p>
        {SITE.productName} follows semantic versioning. Pre-1.0 (<code>0.x</code>) releases may
        adjust the API in a minor bump.
      </p>
      <h2>0.2.2</h2>
      <p>npm Homepage links to the documentation site.</p>
      <h2>0.2.1</h2>
      <p>Documentation site is the package homepage on npm.</p>
      <h2>0.2.0</h2>
      <p>Developer logging API, integration status, and debug reports.</p>
      <h2>0.1.0</h2>
      <p>Initial release: core engine, GA4, Segment, Clarity, React and Next.js integrations.</p>
      <p>
        <a href={SITE.changelogUrl}>Full CHANGELOG.md</a>
      </p>
    </div>
  );
}
