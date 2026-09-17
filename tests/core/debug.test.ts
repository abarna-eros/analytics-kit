import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

function createSink() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('developer logging API', () => {
  it('exposes log.debug/info/warn/error, event, view and identify', async () => {
    const sink = createSink();
    const analytics = createAnalytics();
    await analytics.init({
      debug: true,
      logger: sink,
      disableInTest: false,
    });

    analytics.log.debug('hello', { plan: 'pro' });
    analytics.log.info('ready');
    analytics.log.warn('careful');
    analytics.log.error('failed');
    analytics.log.event('checkout_started', { cartValue: 20, email: 'a@b.com' });
    analytics.log.view('Home');
    analytics.log.identify('user-1', { email: 'a@b.com', plan: 'pro' });

    expect(sink.debug).toHaveBeenCalledWith(expect.stringContaining('hello'), { plan: 'pro' });
    expect(sink.info).toHaveBeenCalledWith(expect.stringContaining('ready'));
    expect(sink.warn).toHaveBeenCalledWith(expect.stringContaining('careful'));
    expect(sink.error).toHaveBeenCalledWith(expect.stringContaining('failed'));
    expect(sink.info).toHaveBeenCalledWith(
      expect.stringContaining('event: checkout_started'),
      expect.objectContaining({ cartValue: 20, email: '[REDACTED]' })
    );
    expect(sink.info).toHaveBeenCalledWith(expect.stringContaining('view: Home'));
    expect(sink.info).toHaveBeenCalledWith(
      expect.stringContaining('identify: user-1'),
      expect.objectContaining({ email: '[REDACTED]', plan: 'pro' })
    );
  });

  it('does not send analytics.log.event to providers', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], debug: true });

    analytics.log.event('not_a_real_track', { a: 1 });
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
  });

  it('never throws when the custom logger throws', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      debug: true,
      logger: {
        debug: () => {
          throw new Error('logger down');
        },
        info: () => {
          throw new Error('logger down');
        },
        warn: () => {
          throw new Error('logger down');
        },
        error: () => {
          throw new Error('logger down');
        },
      },
    });

    expect(() => {
      analytics.log.debug('x');
      analytics.log.event('y');
      analytics.trackEvent('button_clicked', { buttonName: 'Signup' });
    }).not.toThrow();

    await flushMicrotasks();
    expect(provider.track).toHaveBeenCalled();
  });
});

describe('getIntegrationStatus and getDebugReport', () => {
  it('reports success after a delivered event', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], debug: true });

    analytics.trackEvent('button_clicked', { buttonName: 'Go' });
    await flushMicrotasks();

    const status = analytics.getIntegrationStatus()[0];
    expect(status).toBeDefined();
    expect(status?.name).toBe('mock');
    expect(status?.available).toBe(true);
    expect(status?.initialized).toBe(true);
    expect(status?.lastDelivery?.status).toBe('success');
    expect(status?.lastDelivery?.operation).toBe('track');
  });

  it('reports skipped when consent is missing', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      debug: true,
      consent: { required: true, queueUntilDecision: true },
    });

    const status = analytics.getIntegrationStatus()[0];
    expect(status?.initialized).toBe(false);
    expect(status?.available).toBe(false);
    expect(status?.skippedReason).toBe('consent');
  });

  it('reports unavailable when a provider fails to initialize', async () => {
    const provider = createMockProvider({ failOnInit: true });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], debug: true });

    const status = analytics.getIntegrationStatus()[0];
    expect(status?.available).toBe(false);
    expect(status?.skippedReason).toBe('unavailable');
    expect(status?.lastError).toContain('initialize failed');
  });

  it('reports failed when a provider throws during track', async () => {
    const provider = createMockProvider();
    provider.track.mockImplementation(() => {
      throw new Error('network down');
    });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], debug: true });

    analytics.trackEvent('button_clicked');
    await flushMicrotasks();

    const status = analytics.getIntegrationStatus()[0];
    expect(status?.initialized).toBe(true);
    expect(status?.lastDelivery?.status).toBe('failed');
    expect(status?.lastError).toContain('network down');
  });

  it('returns a redacted debug report that is SSR-safe', async () => {
    const analytics = createAnalytics({ name: 'app' });
    await analytics.init({
      debug: true,
      logger: { enabled: true, level: 'debug', timestamps: true, prefix: '[AB]' },
    });

    analytics.log.event('checkout_started', { email: 'hidden@example.com', total: 10 });
    const report = analytics.getDebugReport();

    expect(report.packageName).toBe('analytics-bridge');
    expect(report.instanceName).toBe('app');
    expect(report.debug).toBe(true);
    expect(report.logLevel).toBe('debug');
    expect(report.logger.prefix).toBe('[AB]');
    expect(report.logger.timestamps).toBe(true);
    expect(report.initialized).toBe(true);
    expect(typeof report.ssr).toBe('boolean');
    expect(report.recentLogs.some((entry) => entry.category === 'event')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('hidden@example.com');
  });

  it('keeps getProviderStatus unchanged', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    const snapshot = analytics.getProviderStatus();
    expect(snapshot[0]).toEqual({
      name: 'mock',
      enabled: true,
      initialized: true,
      consentGranted: true,
      requiredConsent: ['analytics'],
    });
  });
});
