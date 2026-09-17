import { Link } from 'react-router-dom';
import { CodeBlock } from './CodeBlock';

const PROVIDERS = [
  {
    name: 'Google Analytics 4',
    key: 'googleAnalytics',
    mark: 'G4',
    to: '/docs/google-analytics',
    description:
      'Understand traffic, events, conversions, user journeys and product usage through GA4.',
    code: `analytics.track('product_viewed', {
  productId: '123'
});`,
  },
  {
    name: 'Twilio Segment',
    key: 'segment',
    mark: 'Sg',
    to: '/docs/segment',
    description: "Send analytics events and customer data through Segment's unified analytics pipeline.",
    code: `analytics.identify('user-123', {
  plan: 'premium'
});`,
  },
  {
    name: 'Microsoft Clarity',
    key: 'clarity',
    mark: 'Cl',
    to: '/docs/clarity',
    description: 'Understand user sessions, behavior and interaction patterns through Clarity.',
    code: `analytics.page('/dashboard');`,
  },
];

export function ProviderCard() {
  return (
    <div className="grid-3">
      {PROVIDERS.map((provider) => (
        <article key={provider.key} className="card" style={{ padding: 18 }}>
          <div className="provider-mark" aria-hidden="true">
            {provider.mark}
          </div>
          <div className="kicker">{provider.key}</div>
          <h3>{provider.name}</h3>
          <p>{provider.description}</p>
          <CodeBlock code={provider.code} />
          <Link to={provider.to}>Learn more</Link>
        </article>
      ))}
    </div>
  );
}
