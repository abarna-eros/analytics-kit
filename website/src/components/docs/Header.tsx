import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SITE } from '../../data/site';
import { CloseIcon, GitHubIcon, MenuIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { to: '/docs/overview', label: 'Docs' },
  { to: '/docs/google-analytics', label: 'Providers' },
  { to: '/docs/api', label: 'API' },
  { to: '/examples', label: 'Examples' },
  { to: '/changelog', label: 'Changelog' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const titleId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="header">
      <div className="wide header-inner">
        <NavLink to="/" className="brand">
          {SITE.productName}
          <span className="badge">v{SITE.version}</span>
        </NavLink>

        <nav className="nav" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {link.label}
            </NavLink>
          ))}
          <a href={SITE.githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>

        <div className="header-actions">
          <a className="btn-icon btn-text desktop-only" href={SITE.npmUrl} target="_blank" rel="noreferrer" aria-label="npm package">
            npm
          </a>
          <a className="btn-icon desktop-only" href={SITE.githubUrl} target="_blank" rel="noreferrer" aria-label="GitHub repository">
            <GitHubIcon />
          </a>
          <ThemeToggle />
          <button className="btn-icon menu-btn" type="button" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
            <MenuIcon />
            <span className="sr-only">Open menu</span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} id="mobile-nav" onClick={() => setOpen(false)}>
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong id={titleId}>Menu</strong>
              <button className="btn-icon" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            <nav aria-label="Mobile" style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {LINKS.map((link) => (
                <NavLink key={link.to} to={link.to}>
                  {link.label}
                </NavLink>
              ))}
              <a href={SITE.githubUrl}>GitHub</a>
              <a href={SITE.npmUrl}>npm</a>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
