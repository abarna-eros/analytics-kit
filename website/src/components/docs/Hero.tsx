import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../../data/site';
import { CodeBlock } from './CodeBlock';

const PREVIEWS = [
  {
    id: 'track',
    label: 'track()',
    code: `analytics.track('product_viewed', {
  productId: '123',
  productName: 'Analytics Bridge'
});`,
  },
  {
    id: 'identify',
    label: 'identify()',
    code: `analytics.identify('user-123', {
  plan: 'premium'
});`,
  },
  {
    id: 'init',
    label: 'init()',
    code: `await analytics.init({
  providers: {
    googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    segment: { writeKey: 'YOUR_WRITE_KEY' },
    clarity: { projectId: 'YOUR_PROJECT_ID' }
  }
});`,
  },
] as const;

export function Hero() {
  const [preview, setPreview] = useState<(typeof PREVIEWS)[number]['id']>('track');
  const active = PREVIEWS.find((item) => item.id === preview) ?? PREVIEWS[0];

  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="wide hero-grid">
        <div>
          <div className="pill-row">
            <span className="pill">Open Source</span>
            <span className="pill">React</span>
            <span className="pill">Next.js</span>
          </div>
          <h1>
            One Analytics API.
            <br />
            Multiple Providers.
          </h1>
          <p className="lead">
            {SITE.productName} gives React and Next.js applications a single, provider-independent
            analytics API for Google Analytics 4, Twilio Segment, and Microsoft Clarity.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/docs/quick-start">
              Get Started
            </Link>
            <a className="btn btn-secondary" href={SITE.githubUrl}>
              View on GitHub
            </a>
          </div>
          <CodeBlock language="bash" label="install" chrome code={`npm install ${SITE.packageName}`} />
        </div>
        <div className="hero-preview">
          <div className="tabs preview-tabs" role="tablist" aria-label="API preview">
            {PREVIEWS.map((item) => (
              <button
                key={item.id}
                className="btn btn-ghost"
                type="button"
                role="tab"
                aria-selected={preview === item.id}
                onClick={() => setPreview(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <CodeBlock chrome label={active.label} code={active.code} />
        </div>
      </div>
    </section>
  );
}
