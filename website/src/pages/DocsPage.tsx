import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from '../components/docs/Sidebar';
import { DocsArticle } from '../docs/catalog';

export function DocsPage() {
  const { slug = 'overview' } = useParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="wide docs-shell">
      <div className="sidebar desktop-only">
        <Sidebar />
      </div>
      <button className="btn btn-secondary docs-menu" type="button" onClick={() => setOpen(true)}>
        Documentation menu
      </button>
      {open ? (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Documentation" onClick={() => setOpen(false)}>
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <article className="prose">
        <DocsArticle slug={slug} />
      </article>
    </div>
  );
}
