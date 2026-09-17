import { useMemo, useState } from 'react';

interface DemoLine {
  id: number;
  action: string;
  detail: string;
  provider: string;
}

const PROVIDERS = ['googleAnalytics', 'segment', 'clarity'] as const;

let nextId = 1;

export function InteractiveDemo() {
  const [lines, setLines] = useState<DemoLine[]>([]);

  const append = (action: string, detail: string) => {
    setLines((current) => [
      ...PROVIDERS.map((provider) => ({
        id: nextId++,
        action,
        detail,
        provider,
      })),
      ...current,
    ].slice(0, 24));
  };

  const empty = useMemo(() => lines.length === 0, [lines.length]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <p>
        A local demonstration only. These buttons do not load vendor scripts and do not send data
        to GA4, Segment or Clarity.
      </p>
      <div className="hero-actions">
        <button className="btn btn-secondary" type="button" onClick={() => append('track', 'event: product_viewed')}>
          Track Event
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => append('page', 'path: /dashboard')}>
          Page View
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => append('identify', 'userId: user-123')}>
          Identify User
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => append('reset', 'identity cleared')}>
          Reset User
        </button>
      </div>
      <div className="log-list" aria-live="polite">
        {empty ? <div>No demo events yet.</div> : null}
        {lines.map((line) => (
          <div key={line.id} style={{ marginBottom: 10 }}>
            <div className="ok">✓ {line.action}</div>
            <div> {line.detail}</div>
            <div> provider: {line.provider}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
