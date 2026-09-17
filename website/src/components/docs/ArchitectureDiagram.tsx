import { SITE } from '../../data/site';
import { LayersIcon, LockIcon, PlugIcon, QueueIcon, ShieldIcon, WifiOffIcon } from './Icons';

const CALLS = ['analytics.track()', 'analytics.page()', 'analytics.identify()'] as const;

const DESTINATIONS = [
  { name: 'Google Analytics 4', key: 'googleAnalytics', short: 'GA4' },
  { name: 'Twilio Segment', key: 'segment', short: 'Segment' },
  { name: 'Microsoft Clarity', key: 'clarity', short: 'Clarity' },
] as const;

const PIPELINE = ['Consent', 'Core', 'Provider', 'Destination'] as const;

const CAPABILITIES = [
  { label: 'Batching', icon: QueueIcon },
  { label: 'Retry', icon: QueueIcon },
  { label: 'Privacy', icon: LockIcon },
  { label: 'Plugins', icon: PlugIcon },
  { label: 'Offline queue', icon: WifiOffIcon },
  { label: 'Failure isolation', icon: ShieldIcon },
] as const;

export function ArchitectureDiagram({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`arch-board${compact ? ' arch-compact' : ''}`}
      role="img"
      aria-label="Your React app sends track, page, and identify calls to Analytics Bridge, which forwards them to Google Analytics 4, Twilio Segment, and Microsoft Clarity."
    >
      <div className="arch-glow" aria-hidden="true" />

      <div className="arch-layer">
        <span className="arch-kicker">Application</span>
        <div className="card arch-node">
          <strong>Your React / Next.js app</strong>
          <div className="arch-calls">
            {CALLS.map((call) => (
              <code key={call}>{call}</code>
            ))}
          </div>
        </div>
      </div>

      <div className="arch-connector" aria-hidden="true" />

      <div className="arch-layer">
        <span className="arch-kicker">SDK</span>
        <div className="card arch-node arch-core">
          <span className="feature-icon" aria-hidden="true">
            <LayersIcon />
          </span>
          <strong>{SITE.productName}</strong>
          <p>One typed API for every configured destination</p>
        </div>
        {compact ? null : (
          <ol className="arch-pipeline">
            {PIPELINE.map((step, index) => (
              <li key={step}>
                <span className="arch-step">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="arch-connector arch-fork" aria-hidden="true" />

      <div className="arch-layer">
        <span className="arch-kicker">Destinations</span>
        <div className="diagram-row">
          {DESTINATIONS.map((destination) => (
            <article key={destination.key} className="card arch-dest">
              <strong>{destination.short}</strong>
              <span className="kicker">{destination.key}</span>
              <p>{destination.name}</p>
            </article>
          ))}
        </div>
      </div>

      {compact ? null : (
        <div className="arch-capabilities" aria-label="Reliability and privacy">
          {CAPABILITIES.map(({ label, icon: Icon }) => (
            <span key={label} className="arch-chip">
              <Icon />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
