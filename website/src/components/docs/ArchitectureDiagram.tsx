import { SITE } from '../../data/site';

export function ArchitectureDiagram({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="diagram"
      role="img"
      aria-label="Your React app sends track, page, and identify calls to Analytics Bridge, which forwards them to Google Analytics 4, Twilio Segment, and Microsoft Clarity."
    >
      <div className="card diagram-card">
        <strong>Your React App</strong>
        <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          analytics.track()
          <br />
          analytics.page()
          <br />
          analytics.identify()
        </p>
      </div>
      <div className="diagram-line" aria-hidden="true" />
      <div className="card diagram-card" style={{ borderColor: 'var(--accent)' }}>
        <strong>{SITE.productName}</strong>
        <p style={{ margin: '6px 0 0' }}>One typed API</p>
      </div>
      <div className="diagram-line" aria-hidden="true" />
      <div className="diagram-row">
        <div className="card diagram-card">GA4</div>
        <div className="card diagram-card">Segment</div>
        <div className="card diagram-card">Clarity</div>
      </div>
      {compact ? null : (
        <>
          <div className="pipeline" aria-label="Processing pipeline">
            <span>Consent</span>
            <span>Core</span>
            <span>Provider</span>
            <span>Destination</span>
          </div>
          <div className="pipeline" aria-label="Reliability and privacy">
            <span>Batching</span>
            <span>Retry</span>
            <span>Privacy</span>
            <span>Plugins</span>
            <span>Offline queue</span>
            <span>Failure isolation</span>
          </div>
        </>
      )}
    </div>
  );
}
