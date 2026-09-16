import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { createLoggingPlugin } from '../../src/plugins/logging';
import type { Plugin } from '../../src/plugins/types';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

function createSpyPlugin(name = 'spy') {
  const calls = {
    initialize: vi.fn(),
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
    group: vi.fn(),
    reset: vi.fn(),
    destroy: vi.fn(),
  };
  const plugin: Plugin = { name, ...calls };
  return { plugin, calls };
}

describe('plugin lifecycle', () => {
  it('runs every lifecycle hook', async () => {
    const { plugin, calls } = createSpyPlugin();
    const analytics = createAnalytics();

    await analytics.init({ plugins: [plugin], customProviders: [createMockProvider()] });
    expect(calls.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production', debug: false })
    );

    analytics.trackEvent('plugin_event', { foo: 'bar' });
    analytics.page('/dashboard');
    analytics.identify('user-1', { plan: 'pro' });
    analytics.group('group-1', { name: 'Acme' });
    analytics.reset();
    await flushMicrotasks();

    expect(calls.track).toHaveBeenCalledWith(
      'plugin_event',
      expect.objectContaining({ foo: 'bar' }),
      expect.anything()
    );
    expect(calls.page).toHaveBeenCalled();
    expect(calls.identify).toHaveBeenCalledWith('user-1', { plan: 'pro' }, expect.anything());
    expect(calls.group).toHaveBeenCalledWith('group-1', { name: 'Acme' }, expect.anything());
    expect(calls.reset).toHaveBeenCalled();

    await analytics.destroy();
    expect(calls.destroy).toHaveBeenCalled();
  });

  it('registers a plugin after initialization with use()', async () => {
    const { plugin, calls } = createSpyPlugin('late');
    const analytics = createAnalytics();
    await analytics.init({});

    expect(analytics.use(plugin)).toBe(analytics);
    await flushMicrotasks();
    expect(calls.initialize).toHaveBeenCalled();

    analytics.trackEvent('after_use');
    await flushMicrotasks();
    expect(calls.track).toHaveBeenCalled();
  });

  it('removes a plugin', async () => {
    const { plugin, calls } = createSpyPlugin('removable');
    const analytics = createAnalytics();
    await analytics.init({ plugins: [plugin] });

    analytics.removePlugin('removable');
    await flushMicrotasks();
    expect(calls.destroy).toHaveBeenCalled();

    analytics.trackEvent('after_removal');
    await flushMicrotasks();
    expect(calls.track).not.toHaveBeenCalled();
  });

  it('lets a plugin rewrite the payload before dispatch', async () => {
    const provider = createMockProvider();
    const enrich: Plugin = {
      name: 'enrich',
      beforeSend: (payload) => ({
        ...payload,
        properties: { ...payload.properties, enriched: true },
      }),
    };

    const analytics = createAnalytics();
    await analytics.init({ plugins: [enrich], customProviders: [provider] });

    analytics.trackEvent('enriched_event');
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledWith(
      'enriched_event',
      expect.objectContaining({ enriched: true }),
      expect.anything()
    );
  });

  it('lets a plugin veto a call', async () => {
    const provider = createMockProvider();
    const blocker: Plugin = {
      name: 'blocker',
      beforeSend: (payload) => (payload.name === 'blocked_event' ? false : undefined),
    };

    const analytics = createAnalytics();
    await analytics.init({ plugins: [blocker], customProviders: [provider] });

    analytics.trackEvent('blocked_event');
    analytics.trackEvent('allowed_event');
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledTimes(1);
    expect(provider.track).toHaveBeenCalledWith(
      'allowed_event',
      expect.anything(),
      expect.anything()
    );
  });

  it('isolates plugin failures from providers and callers', async () => {
    const provider = createMockProvider();
    const onError = vi.fn();
    const broken: Plugin = {
      name: 'broken',
      track: () => {
        throw new Error('plugin exploded');
      },
      beforeSend: () => {
        throw new Error('beforeSend exploded');
      },
    };

    const analytics = createAnalytics();
    await analytics.init({ plugins: [broken], customProviders: [provider], onError });

    expect(() => analytics.trackEvent('despite_broken_plugin')).not.toThrow();
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ source: 'plugin:broken' }));
  });

  it('ships a logging plugin that redacts sensitive values', async () => {
    const write = vi.fn();
    const analytics = createAnalytics();
    await analytics.init({ plugins: [createLoggingPlugin({ write })] });

    analytics.trackEvent('logged_event', { plan: 'premium', apiKey: 'secret-value' });
    await flushMicrotasks();

    expect(write).toHaveBeenCalledWith(
      '[Analytics] track: logged_event',
      expect.objectContaining({ plan: 'premium', apiKey: '[REDACTED]' })
    );
  });
});
