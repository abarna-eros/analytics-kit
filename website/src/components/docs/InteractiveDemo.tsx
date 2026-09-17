import { useState } from 'react';

interface DemoLine {
  id: number;
  time: string;
  action: string;
  payload: Record<string, string>;
  provider: string;
}

const PROVIDERS = ['googleAnalytics', 'segment', 'clarity'] as const;

let nextId = 1;

function stamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function seed(action: string, payload: Record<string, string>): DemoLine[] {
  const time = stamp();
  return PROVIDERS.map((provider) => ({
    id: nextId++,
    time,
    action,
    payload,
    provider,
  }));
}

export function InteractiveDemo() {
  const [lines, setLines] = useState<DemoLine[]>(() => seed('track', { event: 'product_viewed' }));
  const [active, setActive] = useState('track');

  const append = (action: string, payload: Record<string, string>) => {
    setActive(action);
    setLines((current) => [...seed(action, payload), ...current].slice(0, 24));
  };

  return (
    <div className="demo-shell">
      <p className="demo-note">
        A local demonstration only. These buttons do not load vendor scripts and do not send data to
        GA4, Segment or Clarity.
      </p>
      <div className="demo-window">
        <div className="demo-toolbar">
          <div className="window-bar demo-chrome">
            <span className="window-dot window-dot-red" />
            <span className="window-dot window-dot-amber" />
            <span className="window-dot window-dot-green" />
            <span className="window-title">analytics-bridge — event console</span>
          </div>
          <div className="demo-controls" role="toolbar" aria-label="Demo events">
            <button
              className="btn btn-secondary"
              type="button"
              aria-pressed={active === 'track'}
              onClick={() => append('track', { event: 'product_viewed' })}
            >
              Track Event
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              aria-pressed={active === 'page'}
              onClick={() => append('page', { path: '/dashboard' })}
            >
              Page View
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              aria-pressed={active === 'identify'}
              onClick={() => append('identify', { userId: 'user-123' })}
            >
              Identify User
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              aria-pressed={active === 'reset'}
              onClick={() => append('reset', { status: 'identity cleared' })}
            >
              Reset User
            </button>
          </div>
        </div>
        <div className="log-list" aria-live="polite">
          {lines.map((line) => (
            <div key={line.id} className="log-row">
              <span className="tok-comment">{line.time}</span>
              <span className="status-dot" aria-hidden="true" />
              <span className="ok">✓ {line.action}</span>
              <code className="log-json">{JSON.stringify(line.payload)}</code>
              <span className="kicker">{line.provider}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
