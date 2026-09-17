import { SITE } from '../../data/site';

export function VersionSupport() {
  return (
    <div className="card data-card">
      <table className="data-table">
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
            <td>
              <span className="status-pill status-active">Active</span>
            </td>
          </tr>
          <tr>
            <td>React</td>
            <td>
              <code>{SITE.reactPeer}</code>
            </td>
            <td>
              <span className="status-pill status-ok">Supported</span>
            </td>
          </tr>
          <tr>
            <td>Next.js</td>
            <td>
              <code>{SITE.nextPeer}</code>
            </td>
            <td>
              <span className="status-pill status-ok">{SITE.nextOptional ? 'Optional peer' : 'Supported'}</span>
            </td>
          </tr>
          <tr>
            <td>TypeScript</td>
            <td>Types exported</td>
            <td>
              <span className="status-pill status-ok">Supported</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="data-card-note">
        Version compatibility follows the package configuration and release policy. React is required
        for <code>/react</code> and <code>/next</code>. Next.js is not required for React-only apps.
      </p>
    </div>
  );
}
