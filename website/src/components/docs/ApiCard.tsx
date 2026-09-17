import { Link } from 'react-router-dom';
import { CodeBlock } from './CodeBlock';

const APIS = [
  {
    name: 'track()',
    purpose: 'Track an event',
    code: `analytics.track('product_viewed', { productId: '123' });`,
    to: '/docs/events',
  },
  {
    name: 'page()',
    purpose: 'Track page views',
    code: `analytics.page('/dashboard');`,
    to: '/docs/pages',
  },
  {
    name: 'identify()',
    purpose: 'Identify a user',
    code: `analytics.identify('user-123', { plan: 'premium' });`,
    to: '/docs/users',
  },
  {
    name: 'group()',
    purpose: 'Associate a user with a group',
    code: `analytics.group('company-123', { name: 'Example' });`,
    to: '/docs/groups',
  },
  {
    name: 'reset()',
    purpose: 'Reset identity',
    code: `analytics.reset();`,
    to: '/docs/users',
  },
];

export function ApiCard() {
  return (
    <div className="grid-2">
      {APIS.map((api) => (
        <article key={api.name} className="card" style={{ padding: 18 }}>
          <h3>
            <code>{api.name}</code>
          </h3>
          <p>{api.purpose}</p>
          <CodeBlock code={api.code} />
          <Link to={api.to}>Detailed documentation</Link>
        </article>
      ))}
    </div>
  );
}
