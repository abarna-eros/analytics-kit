import { Link } from 'react-router-dom';
import { SITE } from '../../data/site';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { CodeBlock } from './CodeBlock';

export function Hero() {
  return (
    <section className="hero">
      <div className="wide hero-grid">
        <div>
          <div className="eyebrow">Open source • React • Next.js</div>
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
          <CodeBlock language="bash" label="install" code={`npm install ${SITE.packageName}`} />
        </div>
        <ArchitectureDiagram compact />
      </div>
    </section>
  );
}
