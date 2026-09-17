import { Link } from 'react-router-dom';
import { SITE } from '../../data/site';
import { ThemeToggle } from './ThemeToggle';

export function Footer() {
  return (
    <footer className="footer">
      <div className="wide">
        <div className="footer-grid">
          <div>
            <h4>{SITE.productName}</h4>
            <p>One analytics API for React and Next.js.</p>
          </div>
          <div>
            <h4>Documentation</h4>
            <Link to="/docs/quick-start">Getting Started</Link>
            <Link to="/docs/api">API</Link>
            <Link to="/docs/google-analytics">Providers</Link>
            <Link to="/examples">Examples</Link>
          </div>
          <div>
            <h4>Project</h4>
            <a href={SITE.githubUrl}>GitHub</a>
            <a href={SITE.npmUrl}>npm</a>
            <Link to="/changelog">Changelog</Link>
            <a href={SITE.licenseUrl}>License</a>
          </div>
          <div>
            <h4>Theme</h4>
            <ThemeToggle />
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 {SITE.author}</span>
          <span>Released under the {SITE.license} License</span>
        </div>
      </div>
    </footer>
  );
}
