import { describe, expect, it, vi } from 'vitest';
import { SegmentProvider } from '../../src/providers/segment/SegmentProvider';
import { ConfigurationError } from '../../src/core/errors';
import type { SegmentAnalytics, SegmentConfig } from '../../src/providers/segment/types';
import type { ProviderInitContext } from '../../src/core/types';
import { noopLogger } from '../../src/utils/logger';

const WRITE_KEY = 'test_write_key';

function initContext(config: Partial<SegmentConfig> = {}): ProviderInitContext<SegmentConfig> {
  return {
    config: { writeKey: WRITE_KEY, ...config } as SegmentConfig,
    logger: noopLogger,
    environment: 'test',
    debug: false,
    consent: { categories: { analytics: true }, decided: true },
    anonymousId: 'anon-123',
  };
}

function createFakeSegment(): SegmentAnalytics {
  return {
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
    group: vi.fn(),
    reset: vi.fn(),
    ready: vi.fn((callback: () => void) => callback()),
    setAnonymousId: vi.fn(),
  };
}

describe('SegmentProvider', () => {
  it('requires a write key or an instance', async () => {
    const provider = new SegmentProvider();
    await expect(provider.initialize(initContext({ writeKey: '' }))).rejects.toBeInstanceOf(
      ConfigurationError
    );
  });

  it('installs the queueing snippet stub on window', async () => {
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ loadScript: false }));

    const globalAnalytics = (window as unknown as { analytics: Record<string, unknown> }).analytics;
    expect(typeof globalAnalytics.track).toBe('function');
    expect(globalAnalytics._writeKey).toBe(WRITE_KEY);
    expect(Array.isArray(globalAnalytics)).toBe(true);
  });

  it('queues calls made before the bundle loads', async () => {
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.track('subscription_started', { plan: 'premium', price: 499 });

    const queue = (window as unknown as { analytics: unknown[] }).analytics;
    expect(queue).toContainEqual([
      'track',
      'subscription_started',
      { plan: 'premium', price: 499 },
      undefined,
    ]);
  });

  it('injects analytics.js from the Segment CDN', async () => {
    const provider = new SegmentProvider();
    await provider.initialize(initContext());

    const script = document.getElementById('analytics-kit-segment') as HTMLScriptElement | null;
    expect(script?.src).toBe(
      `https://cdn.segment.com/analytics.js/v1/${WRITE_KEY}/analytics.min.js`
    );
  });

  it('supports a custom CDN host', async () => {
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ cdnURL: 'https://cdn.example.com' }));

    const script = document.getElementById('analytics-kit-segment') as HTMLScriptElement | null;
    expect(script?.src).toContain('https://cdn.example.com/analytics.js/v1/');
  });

  it('uses a supplied analytics-next instance instead of the snippet', async () => {
    const instance = createFakeSegment();
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ instance }));

    expect(document.getElementById('analytics-kit-segment')).toBeNull();
    expect(provider.getSegment()).toBe(instance);
  });

  it('maps the generic API onto Segment calls', async () => {
    const instance = createFakeSegment();
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ instance }));

    provider.track('subscription_started', { plan: 'premium', price: 499 });
    provider.identify('user-123', { email: 'user@example.com', plan: 'premium' });
    provider.group('company-123', { name: 'Example Company' });
    provider.page('/dashboard', { path: '/dashboard' });
    provider.reset();

    expect(instance.track).toHaveBeenCalledWith(
      'subscription_started',
      { plan: 'premium', price: 499 },
      undefined
    );
    expect(instance.identify).toHaveBeenCalledWith(
      'user-123',
      { email: 'user@example.com', plan: 'premium' },
      undefined
    );
    expect(instance.group).toHaveBeenCalledWith(
      'company-123',
      { name: 'Example Company' },
      undefined
    );
    expect(instance.page).toHaveBeenCalledWith(
      '/dashboard',
      { path: '/dashboard' },
      undefined,
      undefined
    );
    expect(instance.reset).toHaveBeenCalled();
  });

  it('calls page without a name when none is supplied', async () => {
    const instance = createFakeSegment();
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ instance }));

    provider.page(undefined, { path: '/home' });
    expect(instance.page).toHaveBeenCalledWith({ path: '/home' }, undefined, undefined, undefined);
  });

  it('forwards integration toggles', async () => {
    const instance = createFakeSegment();
    const provider = new SegmentProvider();
    await provider.initialize(
      initContext({ instance, integrations: { 'Google Analytics': false } })
    );

    provider.track('event_with_integrations');
    expect(instance.track).toHaveBeenCalledWith(
      'event_with_integrations',
      {},
      {
        integrations: { 'Google Analytics': false },
      }
    );
  });

  it('syncs the anonymous id only when asked', async () => {
    const instance = createFakeSegment();

    const withoutSync = new SegmentProvider();
    await withoutSync.initialize(initContext({ instance }));
    expect(instance.setAnonymousId).not.toHaveBeenCalled();

    const withSync = new SegmentProvider();
    await withSync.initialize(initContext({ instance, syncAnonymousId: true }));
    expect(instance.setAnonymousId).toHaveBeenCalledWith('anon-123');
  });

  it('resolves flush once analytics.js is ready', async () => {
    const instance = createFakeSegment();
    const provider = new SegmentProvider();
    await provider.initialize(initContext({ instance }));

    await expect(provider.flush()).resolves.toBeUndefined();
    expect(instance.ready).toHaveBeenCalled();
  });

  it('ignores calls made before initialization', () => {
    const provider = new SegmentProvider();
    expect(() => provider.track('too_early')).not.toThrow();
  });
});
