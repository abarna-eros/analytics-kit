import { describe, expect, it, vi } from 'vitest';
import { GoogleAnalyticsProvider } from '../../src/providers/google-analytics/GoogleAnalyticsProvider';
import { ConfigurationError } from '../../src/core/errors';
import type { GoogleAnalyticsConfig } from '../../src/providers/google-analytics/types';
import type { ConsentSnapshot, ProviderInitContext } from '../../src/core/types';
import { noopLogger } from '../../src/utils/logger';

const MEASUREMENT_ID = 'G-TEST123456';

function consentSnapshot(categories: Record<string, boolean> = {}): ConsentSnapshot {
  return { categories, decided: true, updatedAt: Date.now() };
}

function initContext(
  config: Partial<GoogleAnalyticsConfig> = {},
  consent = consentSnapshot({ analytics: true })
): ProviderInitContext<GoogleAnalyticsConfig> {
  return {
    config: { measurementId: MEASUREMENT_ID, ...config } as GoogleAnalyticsConfig,
    logger: noopLogger,
    environment: 'test',
    debug: false,
    consent,
    anonymousId: 'anon-1',
  };
}

/** Replaces the gtag shim with a spy while keeping the data layer intact. */
function stubGtag() {
  const gtag = vi.fn();
  Object.defineProperty(window, 'gtag', { value: gtag, writable: true, configurable: true });
  return gtag;
}

describe('GoogleAnalyticsProvider', () => {
  it('requires a measurement id', async () => {
    const provider = new GoogleAnalyticsProvider();
    await expect(provider.initialize(initContext({ measurementId: '' }))).rejects.toBeInstanceOf(
      ConfigurationError
    );
  });

  it('creates the data layer and configures the tag', async () => {
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    const dataLayer = (window as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(Array.isArray(dataLayer)).toBe(true);

    const commands = dataLayer.map((entry) => Array.from(entry as IArguments));
    expect(commands.some(([command]) => command === 'js')).toBe(true);
    expect(commands.some(([command, id]) => command === 'config' && id === MEASUREMENT_ID)).toBe(
      true
    );
  });

  it('disables automatic page views by default', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    const configCall = gtag.mock.calls.find(([command]) => command === 'config');
    expect(configCall?.[2]).toMatchObject({ send_page_view: false });
  });

  it('injects the official gtag.js script', async () => {
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext());

    const script = document.getElementById('analytics-kit-gtag') as HTMLScriptElement | null;
    expect(script?.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
    expect(script?.async).toBe(true);
  });

  it('does not inject a script when loadScript is false', async () => {
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    expect(document.getElementById('analytics-kit-gtag')).toBeNull();
  });

  it('maps track onto a gtag event', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.track('product_viewed', { productId: '123', productName: 'Example' });

    expect(gtag).toHaveBeenCalledWith('event', 'product_viewed', {
      productId: '123',
      productName: 'Example',
      send_to: MEASUREMENT_ID,
    });
  });

  it('maps page onto a page_view event', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.page('/dashboard', {
      path: '/dashboard',
      title: 'Dashboard',
      url: 'https://example.com/dashboard',
    });

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/dashboard',
        page_title: 'Dashboard',
        page_location: 'https://example.com/dashboard',
      })
    );
  });

  it('sets user id and user properties on identify', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.identify('user-123', { plan: 'premium' });

    expect(gtag).toHaveBeenCalledWith('set', { user_id: 'user-123' });
    expect(gtag).toHaveBeenCalledWith(
      'set',
      'user_properties',
      expect.objectContaining({ plan: 'premium' })
    );
  });

  it('clears the user id on reset', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.reset();
    expect(gtag).toHaveBeenCalledWith('set', { user_id: null });
  });

  it('sends consent mode defaults before configuring the tag', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(
      initContext({ loadScript: false }, consentSnapshot({ analytics: true, marketing: false }))
    );

    const consentIndex = gtag.mock.calls.findIndex(
      ([command, type]) => command === 'consent' && type === 'default'
    );
    const configIndex = gtag.mock.calls.findIndex(([command]) => command === 'config');

    expect(consentIndex).toBeGreaterThanOrEqual(0);
    expect(consentIndex).toBeLessThan(configIndex);
    expect(gtag.mock.calls[consentIndex]?.[2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'denied',
    });
  });

  it('updates consent signals when consent changes', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.setConsent(consentSnapshot({ analytics: true, marketing: true }));

    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      personalization_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });
  });

  it('skips consent commands when consent mode is disabled', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false, consentMode: false }));

    provider.setConsent(consentSnapshot({ analytics: true }));
    expect(gtag.mock.calls.some(([command]) => command === 'consent')).toBe(false);
  });

  it('enables debug_mode when debugging', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false, debug: true }));

    const configCall = gtag.mock.calls.find(([command]) => command === 'config');
    expect(configCall?.[2]).toMatchObject({ debug_mode: true });
  });

  it('normalizes names when asked to', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false, normalizeNames: true }));

    provider.track('Product Viewed', { productId: '1' });
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'product_viewed',
      expect.objectContaining({ product_id: '1' })
    );
  });

  it('ignores calls made before initialization', () => {
    const provider = new GoogleAnalyticsProvider();
    expect(() => provider.track('too_early')).not.toThrow();
  });

  it('stops sending after destroy', async () => {
    const gtag = stubGtag();
    const provider = new GoogleAnalyticsProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.destroy();
    gtag.mockClear();
    provider.track('after_destroy');

    expect(gtag).not.toHaveBeenCalled();
  });
});
