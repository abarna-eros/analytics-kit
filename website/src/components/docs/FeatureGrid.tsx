const FEATURES = [
  { title: 'Provider abstraction', body: 'One interface for multiple analytics destinations.' },
  { title: 'Multiple providers', body: 'GA4, Segment and Clarity can run together, isolated from each other.' },
  { title: 'Failure isolation', body: 'A throwing provider never breaks other providers or your app.' },
  { title: 'Typed events', body: 'Optional TypeScript event maps give compile-time checked names and payloads.' },
  { title: 'Consent management', body: 'Category-based, CMP-agnostic gating with buffering until a decision.' },
  { title: 'Privacy defaults', body: 'Sensitive-key redaction, opt-out, Do Not Track and anonymous ID controls.' },
  { title: 'React integration', body: 'Provider, hooks, error boundary and StrictMode-safe initialization.' },
  { title: 'Next.js integration', body: 'App Router and Pages Router helpers as an optional peer dependency.' },
  { title: 'Automatic tracking', body: 'Optional page views, outbound links, opted-in clicks and visibility tracking.' },
  { title: 'Web Vitals', body: 'LCP, CLS, INP, FCP, TTFB and navigation timing via PerformanceObserver.' },
  { title: 'Error tracking', body: 'Manual trackError plus optional global capture, with stack traces opt-in.' },
  { title: 'Batching and retry', body: 'Optional queueing with flush-on-unload and bounded backoff.' },
  { title: 'Offline support', body: 'Optionally park calls while offline and replay them when connectivity returns.' },
  { title: 'Plugins', body: 'Observe, enrich or veto any call with lifecycle hooks.' },
  { title: 'Tree-shakable', body: 'Providers load as separate chunks; unused destinations stay out of the bundle.' },
  { title: 'Zero runtime dependencies', body: 'Nothing but your peer-installed React. Next.js is optional.' },
];

export function FeatureGrid() {
  return (
    <div className="grid-4">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="card feature">
          <h3>{feature.title}</h3>
          <p>{feature.body}</p>
        </article>
      ))}
    </div>
  );
}
