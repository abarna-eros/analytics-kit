import type { ComponentType, SVGProps } from 'react';
import {
  AlertIcon,
  BoxIcon,
  ClickIcon,
  ConsentIcon,
  GaugeIcon,
  LayersIcon,
  LeafIcon,
  LockIcon,
  NodesIcon,
  PlugIcon,
  QueueIcon,
  ShieldIcon,
  TypeIcon,
  WifiOffIcon,
} from './Icons';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const FEATURES: { title: string; body: string; icon: Icon; featured?: boolean }[] = [
  { title: 'Provider abstraction', body: 'One interface for multiple analytics destinations.', icon: LayersIcon, featured: true },
  { title: 'Consent management', body: 'Category-based, CMP-agnostic gating with buffering until a decision.', icon: ConsentIcon, featured: true },
  { title: 'Multiple providers', body: 'GA4, Segment and Clarity can run together, isolated from each other.', icon: NodesIcon },
  { title: 'Failure isolation', body: 'A throwing provider never breaks other providers or your app.', icon: ShieldIcon },
  { title: 'Typed events', body: 'Optional TypeScript event maps give compile-time checked names and payloads.', icon: TypeIcon },
  { title: 'Privacy defaults', body: 'Sensitive-key redaction, opt-out, Do Not Track and anonymous ID controls.', icon: LockIcon },
  { title: 'React integration', body: 'Provider, hooks, error boundary and StrictMode-safe initialization.', icon: BoxIcon },
  { title: 'Next.js integration', body: 'App Router and Pages Router helpers as an optional peer dependency.', icon: BoxIcon },
  { title: 'Automatic tracking', body: 'Optional page views, outbound links, opted-in clicks and visibility tracking.', icon: ClickIcon },
  { title: 'Web Vitals', body: 'LCP, CLS, INP, FCP, TTFB and navigation timing via PerformanceObserver.', icon: GaugeIcon },
  { title: 'Error tracking', body: 'Manual trackError plus optional global capture, with stack traces opt-in.', icon: AlertIcon },
  { title: 'Batching and retry', body: 'Optional queueing with flush-on-unload and bounded backoff.', icon: QueueIcon },
  { title: 'Offline support', body: 'Optionally park calls while offline and replay them when connectivity returns.', icon: WifiOffIcon },
  { title: 'Plugins', body: 'Observe, enrich or veto any call with lifecycle hooks.', icon: PlugIcon },
  { title: 'Tree-shakable', body: 'Providers load as separate chunks; unused destinations stay out of the bundle.', icon: LeafIcon },
  { title: 'Zero runtime dependencies', body: 'Nothing but your peer-installed React. Next.js is optional.', icon: BoxIcon },
];

export function FeatureGrid() {
  return (
    <div className="feature-grid">
      {FEATURES.map((feature) => (
        <article key={feature.title} className={`card feature${feature.featured ? ' feature-featured' : ''}`}>
          <div className="feature-icon" aria-hidden="true">
            <feature.icon />
          </div>
          <h3>{feature.title}</h3>
          <p>{feature.body}</p>
        </article>
      ))}
    </div>
  );
}
