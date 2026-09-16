import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import {
  AnalyticsBoundary,
  AnalyticsProvider,
  usePageTracking,
} from '@analytics-kit/react-analytics/react';
import { analytics, analyticsConfig } from './analytics';
import { ConsentBanner } from './ConsentBanner';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { AccountPage } from './pages/AccountPage';

/**
 * Page tracking driven by React Router. Passing the router's path keeps
 * tracking in sync with the router instead of guessing from the History API.
 */
function RouterPageTracking() {
  usePageTracking({ path: useLocation().pathname });
  return null;
}

export function App() {
  return (
    <AnalyticsProvider analytics={analytics} config={analyticsConfig}>
      <BrowserRouter>
        <RouterPageTracking />

        <nav style={{ display: 'flex', gap: 16, padding: 16 }}>
          <Link to="/">Home</Link>
          <Link to="/product/123">Product</Link>
          <Link to="/account">Account</Link>
          {/* Opted-in click tracking, active only when autoTrack.clicks is enabled */}
          <a
            href="https://example.com"
            data-analytics-event="outbound_clicked"
            data-analytics-location="nav"
          >
            External
          </a>
        </nav>

        <main style={{ padding: 16 }}>
          <AnalyticsBoundary component="Routes" fallback={<p>Something went wrong.</p>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Routes>
          </AnalyticsBoundary>
        </main>

        <ConsentBanner />
      </BrowserRouter>
    </AnalyticsProvider>
  );
}
