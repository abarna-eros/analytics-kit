import { useState } from 'react';
import { SITE } from '../../data/site';
import { CodeBlock } from './CodeBlock';

const MANAGERS = ['npm', 'pnpm', 'yarn'] as const;

function commandFor(manager: (typeof MANAGERS)[number]): string {
  if (manager === 'pnpm') return `pnpm add ${SITE.packageName}`;
  if (manager === 'yarn') return `yarn add ${SITE.packageName}`;
  return `npm install ${SITE.packageName}`;
}

export function InstallTabs() {
  const [manager, setManager] = useState<(typeof MANAGERS)[number]>('npm');

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Install with">
        {MANAGERS.map((id) => (
          <button
            key={id}
            className="btn btn-ghost"
            type="button"
            role="tab"
            aria-selected={manager === id}
            onClick={() => setManager(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <CodeBlock language="bash" label={manager} code={commandFor(manager)} />
    </>
  );
}
