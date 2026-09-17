import { SITE } from '../../data/site';

export function VersionSupport() {
  return (
    <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>{SITE.packageName}</code>
            </td>
            <td>
              {SITE.version} (current)
            </td>
            <td>Active</td>
          </tr>
          <tr>
            <td>React</td>
            <td>
              <code>{SITE.reactPeer}</code>
            </td>
            <td>Supported (peer)</td>
          </tr>
          <tr>
            <td>Next.js</td>
            <td>
              <code>{SITE.nextPeer}</code>
            </td>
            <td>{SITE.nextOptional ? 'Supported (optional peer)' : 'Supported'}</td>
          </tr>
          <tr>
            <td>TypeScript</td>
            <td>Types exported</td>
            <td>Supported</td>
          </tr>
        </tbody>
      </table>
      <p style={{ padding: '0 12px 8px' }}>
        Version compatibility follows the package configuration and release policy. React is required
        for <code>/react</code> and <code>/next</code>. Next.js is not required for React-only apps.
      </p>
    </div>
  );
}
