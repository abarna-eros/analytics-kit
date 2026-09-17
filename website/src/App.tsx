import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './layouts/SiteLayout';
import { ChangelogPage, ExamplesPage, HomePage } from './pages/HomePage';
import { DocsPage } from './pages/DocsPage';

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<Navigate to="/docs/overview" replace />} />
        <Route path="/docs/:slug" element={<DocsPage />} />
        <Route path="/examples" element={<ExamplesPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
