import { describe, expect, it } from 'vitest';
import { createAnalytics, getAnalytics, resetAnalytics, setAnalytics } from '../../src/index';
import { flushMicrotasks } from '../helpers/mockProvider';

/**
 * End-to-end coverage of the root entry point, which resolves the built-in
 * provider keys through dynamic imports.
 */

describe('built-in provider resolution', () => {
  it('loads all three providers from a single init call', async () => {
    const analytics = createAnalytics();

    await analytics.init({
      providers: {
        googleAnalytics: { measurementId: 'G-TEST123456', loadScript: false },
        segment: { writeKey: 'test_write_key', loadScript: false },
        clarity: { projectId: 'abcd1234', loadScript: false },
      },
    });

    expect(
      analytics
        .getProviders()
        .map((provider) => provider.name)
        .sort()
    ).toEqual(['clarity', 'google-analytics', 'segment']);
    expect(analytics.getProviderStatus().every((status) => status.initialized)).toBe(true);
  });

  it('runs several providers simultaneously for one call', async () => {
    const analytics = createAnalytics();
    await analytics.init({
      providers: {
        googleAnalytics: { measurementId: 'G-TEST123456', loadScript: false },
        segment: { writeKey: 'test_write_key', loadScript: false },
        clarity: { projectId: 'abcd1234', loadScript: false },
      },
    });

    analytics.trackEvent('product_viewed', { productId: '123' });
    await flushMicrotasks();

    const dataLayer = (window as unknown as { dataLayer: IArguments[] }).dataLayer;
    const gaEvents = dataLayer
      .map((entry) => Array.from(entry))
      .filter(([command, name]) => command === 'event' && name === 'product_viewed');
    expect(gaEvents).toHaveLength(1);

    const segmentQueue = (window as unknown as { analytics: unknown[] }).analytics;
    expect(segmentQueue.some((call) => Array.isArray(call) && call[1] === 'product_viewed')).toBe(
      true
    );

    const clarityQueue = (window as unknown as { clarity: { q?: unknown[][] } }).clarity;
    expect(
      clarityQueue.q?.some((call) => call[0] === 'event' && call[1] === 'product_viewed')
    ).toBe(true);
  });

  it('never loads a provider that is disabled', async () => {
    const analytics = createAnalytics();
    await analytics.init({
      providers: {
        googleAnalytics: { enabled: true, measurementId: 'G-TEST123456', loadScript: false },
        segment: { enabled: false, writeKey: 'test_write_key' },
        clarity: { enabled: true, projectId: 'abcd1234', loadScript: false },
      },
    });

    expect(analytics.provider('segment')).toBeUndefined();
    expect((window as unknown as { analytics?: unknown }).analytics).toBeUndefined();
  });

  it('accepts alternative provider keys', async () => {
    const analytics = createAnalytics();
    await analytics.init({
      providers: {
        ga4: { measurementId: 'G-TEST123456', loadScript: false },
        microsoftClarity: { projectId: 'abcd1234', loadScript: false },
      },
    });

    expect(analytics.provider('google-analytics')).toBeDefined();
    expect(analytics.provider('clarity')).toBeDefined();
  });

  it('warns but keeps working for an unknown provider key', async () => {
    const analytics = createAnalytics();
    await analytics.init({
      providers: {
        unknownVendor: { someKey: 'value' },
        googleAnalytics: { measurementId: 'G-TEST123456', loadScript: false },
      },
    });

    expect(analytics.getProviders()).toHaveLength(1);
  });

  it('isolates a provider whose configuration is invalid', async () => {
    const analytics = createAnalytics();
    await analytics.init({
      providers: {
        googleAnalytics: { measurementId: '', loadScript: false },
        clarity: { projectId: 'abcd1234', loadScript: false },
      },
    });

    const status = analytics.getProviderStatus();
    expect(status.find((entry) => entry.name === 'google-analytics')?.initialized).toBe(false);
    expect(status.find((entry) => entry.name === 'clarity')?.initialized).toBe(true);
  });
});

describe('singleton API', () => {
  it('returns the same instance and can be replaced or reset', () => {
    resetAnalytics();

    const first = getAnalytics();
    expect(getAnalytics()).toBe(first);

    const replacement = createAnalytics({ name: 'replacement' });
    setAnalytics(replacement);
    expect(getAnalytics()).toBe(replacement);

    resetAnalytics();
    expect(getAnalytics()).not.toBe(replacement);

    resetAnalytics();
  });

  it('supports multiple independent instances', async () => {
    const first = createAnalytics({ name: 'first' });
    const second = createAnalytics({ name: 'second' });

    await first.init({ providers: { clarity: { projectId: 'abcd1234', loadScript: false } } });
    await second.init({});

    expect(first.getProviders()).toHaveLength(1);
    expect(second.getProviders()).toHaveLength(0);
    expect(first.name).toBe('first');
    expect(second.name).toBe('second');
  });
});
