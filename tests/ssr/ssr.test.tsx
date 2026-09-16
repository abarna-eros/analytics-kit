/**
 * @vitest-environment node
 *
 * Server-rendering safety.
 *
 * These tests run without a DOM: any access to `window`, `document` or
 * `localStorage` that is not properly guarded will throw here.
 */

import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider } from '../../src/react/AnalyticsProvider';
import { AnalyticsBoundary } from '../../src/react/AnalyticsBoundary';
import { useAnalytics } from '../../src/react/useAnalytics';
import { usePageTracking } from '../../src/react/usePageTracking';
import { createAnalytics } from '../../src/core/Analytics';
import { GoogleAnalyticsProvider } from '../../src/providers/google-analytics/GoogleAnalyticsProvider';
import { ClarityProvider } from '../../src/providers/clarity/ClarityProvider';
import { SegmentProvider } from '../../src/providers/segment/SegmentProvider';
import { getPageInfo, isBrowser, isServer, isOnline } from '../../src/utils/browser';
import { createStorage } from '../../src/utils/storage';
import { onHistoryChange } from '../../src/utils/history';

describe('environment guards', () => {
  it('detects the server environment', () => {
    expect(typeof window).toBe('undefined');
    expect(isBrowser()).toBe(false);
    expect(isServer()).toBe(true);
  });

  it('returns safe fallbacks instead of touching browser globals', () => {
    expect(getPageInfo()).toBeUndefined();
    expect(isOnline()).toBe(true);
    expect(onHistoryChange(() => undefined)).toBeTypeOf('function');
  });

  it('falls back to memory storage on the server', () => {
    const storage = createStorage({ type: 'localStorage', keyPrefix: 'ssr' });
    expect(storage.set('key', 'value')).toBe(true);
    expect(storage.get('key')).toBe('value');
  });
});

describe('analytics client on the server', () => {
  it('initializes without loading providers', async () => {
    const analytics = createAnalytics();

    await expect(
      analytics.init({
        providers: { googleAnalytics: { measurementId: 'G-XXXXXXXXXX' } },
        autoTrack: { pageViews: true, clicks: true, outboundLinks: true },
        performanceTracking: { enabled: true },
        errorTracking: { captureErrors: true },
      })
    ).resolves.toBeUndefined();

    expect(analytics.isInitialized()).toBe(true);
    expect(analytics.getProviders()).toHaveLength(0);
    expect(analytics.getAnonymousId()).toBeNull();
  });

  it('accepts tracking calls as no-ops', async () => {
    const analytics = createAnalytics();
    await analytics.init({});

    expect(() => {
      analytics.trackEvent('server_event', { foo: 'bar' });
      analytics.page('/server');
      analytics.identify('user-1', { plan: 'pro' });
      analytics.group('group-1');
      analytics.reset();
      analytics.setConsent({ analytics: true });
      analytics.trackError(new Error('server error'));
    }).not.toThrow();

    await expect(analytics.flush()).resolves.toBeUndefined();
  });

  it('still runs plugins on the server', async () => {
    const track = vi.fn();
    const analytics = createAnalytics();
    await analytics.init({ plugins: [{ name: 'server-plugin', track }] });

    analytics.trackEvent('server_event');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(track).toHaveBeenCalledWith('server_event', expect.anything(), expect.anything());
  });
});

describe('providers on the server', () => {
  it('does not touch the DOM during initialization', async () => {
    const context = {
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      environment: 'production' as const,
      debug: false,
      consent: { categories: { analytics: true }, decided: true },
    };

    await expect(
      new GoogleAnalyticsProvider().initialize({
        ...context,
        config: { measurementId: 'G-XXXXXXXXXX' },
      })
    ).resolves.toBeUndefined();

    await expect(
      new SegmentProvider().initialize({ ...context, config: { writeKey: 'key' } })
    ).resolves.toBeUndefined();

    await expect(
      new ClarityProvider().initialize({ ...context, config: { projectId: 'abcd1234' } })
    ).resolves.toBeUndefined();
  });
});

describe('React rendering on the server', () => {
  it('renders the provider tree to a string', () => {
    const analytics = createAnalytics();

    const html = renderToString(
      <AnalyticsProvider
        analytics={analytics}
        config={{ providers: { googleAnalytics: { measurementId: 'G-XXXXXXXXXX' } } }}
        pageTracking
      >
        <main>server rendered</main>
      </AnalyticsProvider>
    );

    expect(html).toContain('server rendered');
  });

  it('renders components that consume the hooks', () => {
    const analytics = createAnalytics();

    function Consumer() {
      const instance = useAnalytics();
      usePageTracking();
      return <span>{instance.name}</span>;
    }

    const html = renderToString(
      <AnalyticsProvider analytics={analytics}>
        <AnalyticsBoundary>
          <Consumer />
        </AnalyticsBoundary>
      </AnalyticsProvider>
    );

    expect(html).toContain('default');
  });
});
