import { NavLink } from 'react-router-dom';

export const DOC_NAV = [
  {
    title: 'Introduction',
    items: [
      { slug: 'overview', label: 'Overview' },
      { slug: 'installation', label: 'Installation' },
      { slug: 'quick-start', label: 'Quick Start' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { slug: 'react', label: 'React' },
      { slug: 'nextjs', label: 'Next.js' },
      { slug: 'google-analytics', label: 'Google Analytics 4' },
      { slug: 'segment', label: 'Segment' },
      { slug: 'clarity', label: 'Microsoft Clarity' },
    ],
  },
  {
    title: 'Tracking',
    items: [
      { slug: 'events', label: 'Events' },
      { slug: 'pages', label: 'Pages' },
      { slug: 'users', label: 'Users' },
      { slug: 'groups', label: 'Groups' },
      { slug: 'consent', label: 'Consent' },
      { slug: 'automatic-tracking', label: 'Automatic Tracking' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { slug: 'performance', label: 'Performance' },
      { slug: 'error-tracking', label: 'Error Tracking' },
      { slug: 'batching', label: 'Batching' },
      { slug: 'offline', label: 'Offline Support' },
      { slug: 'plugins', label: 'Plugins' },
      { slug: 'custom-providers', label: 'Custom Providers' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { slug: 'api', label: 'API' },
      { slug: 'typescript', label: 'TypeScript' },
      { slug: 'privacy', label: 'Privacy' },
      { slug: 'security', label: 'Security' },
      { slug: 'troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'Project',
    items: [
      { slug: 'changelog', label: 'Changelog', href: '/changelog' },
      { slug: 'contributing', label: 'Contributing' },
      { slug: 'license', label: 'License' },
    ],
  },
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="sidebar" aria-label="Documentation">
      {DOC_NAV.map((group) => (
        <div key={group.title}>
          <h4>{group.title}</h4>
          {group.items.map((item) => {
            const to = 'href' in item && item.href ? item.href : `/docs/${item.slug}`;
            return (
              <NavLink key={item.slug} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)} onClick={onNavigate}>
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
