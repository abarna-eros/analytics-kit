import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import type { Analytics, AnalyticsConfig } from '../../src/core/types';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

interface AppEvents {
  button_clicked: { buttonName: string; location: string };
  checkout_started: { cartValue: number };
  [key: string]: Record<string, unknown>;
}

async function setup(config: AnalyticsConfig = {}) {
  const provider = createMockProvider();
  const analytics = createAnalytics<AppEvents>();
  await analytics.init({ customProviders: [provider], ...config });
  return { analytics, provider };
}

describe('initialization', () => {
  it('registers and initializes configured providers', async () => {
    const { analytics, provider } = await setup();

    expect(analytics.isInitialized()).toBe(true);
    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(analytics.getProviders()).toHaveLength(1);
  });

  it('is idempotent so StrictMode double mounts cannot double initialize', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    await Promise.all([
      analytics.init({ customProviders: [provider] }),
      analytics.init({ customProviders: [provider] }),
    ]);
    await analytics.init({ customProviders: [provider] });

    expect(provider.initialize).toHaveBeenCalledTimes(1);
  });

  it('passes resolved configuration to the provider', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      debug: true,
      environment: 'development',
    });

    expect(provider.initContext?.debug).toBe(true);
    expect(provider.initContext?.environment).toBe('development');
    expect(provider.initContext?.anonymousId).toEqual(expect.any(String));
  });

  it('buffers calls made before init and replays them afterwards', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    analytics.trackEvent('early_event', { source: 'before_init' });
    expect(provider.track).not.toHaveBeenCalled();

    await analytics.init({ customProviders: [provider] });
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledWith(
      'early_event',
      expect.objectContaining({ source: 'before_init' }),
      expect.anything()
    );
  });

  it('warns when providers are configured without a resolver', async () => {
    const warn = vi.fn();
    const analytics = createAnalytics();
    await analytics.init({
      providers: { googleAnalytics: { measurementId: 'G-TEST' } },
      logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no provider resolver'));
    expect(analytics.getProviders()).toHaveLength(0);
  });
});

describe('tracking methods', () => {
  let analytics: Analytics<AppEvents>;
  let provider: ReturnType<typeof createMockProvider>;

  beforeEach(async () => {
    ({ analytics, provider } = await setup());
  });

  it('dispatches track with properties and context', async () => {
    analytics.track('button_clicked', { buttonName: 'Signup', location: 'header' });
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledWith(
      'button_clicked',
      expect.objectContaining({ buttonName: 'Signup', location: 'header' }),
      expect.objectContaining({ timestamp: expect.any(Number) })
    );
  });

  it('rejects an empty event name without throwing', async () => {
    expect(() => analytics.trackEvent('')).not.toThrow();
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();
  });

  it('fills page properties from the current location', async () => {
    analytics.page();
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({ path: '/', url: expect.stringContaining('http') }),
      expect.anything()
    );
  });

  it('identifies a user and remembers the identity', async () => {
    analytics.identify('user-123', { plan: 'premium' });
    await flushMicrotasks();

    expect(provider.identify).toHaveBeenCalledWith(
      'user-123',
      { plan: 'premium' },
      expect.anything()
    );
    expect(analytics.getIdentity()).toMatchObject({
      userId: 'user-123',
      traits: { plan: 'premium' },
    });
  });

  it('associates a group', async () => {
    analytics.group('company-123', { name: 'Example Company' });
    await flushMicrotasks();

    expect(provider.group).toHaveBeenCalledWith(
      'company-123',
      { name: 'Example Company' },
      expect.anything()
    );
  });

  it('clears the identity and rotates the anonymous id on reset', async () => {
    analytics.identify('user-123', { plan: 'premium' });
    const firstAnonymousId = analytics.getAnonymousId();

    analytics.reset();
    await flushMicrotasks();

    expect(provider.reset).toHaveBeenCalled();
    expect(analytics.getIdentity()).toMatchObject({ userId: null, groupId: null, traits: {} });
    expect(analytics.getAnonymousId()).not.toBe(firstAnonymousId);
  });

  it('merges default properties into events', async () => {
    const { analytics: instance, provider: target } = await setup({
      defaultProperties: () => ({ app_version: '1.2.3' }),
    });

    instance.trackEvent('custom_event', { foo: 'bar' });
    await flushMicrotasks();

    expect(target.track).toHaveBeenCalledWith(
      'custom_event',
      expect.objectContaining({ app_version: '1.2.3', foo: 'bar' }),
      expect.anything()
    );
  });

  it('redacts sensitive properties before dispatch', async () => {
    analytics.trackEvent('form_submitted', {
      email: 'user@example.com',
      password: 'hunter2',
      card: { cardNumber: '4111111111111111' },
    });
    await flushMicrotasks();

    const [, properties] = provider.track.mock.calls[0] ?? [];
    expect(properties).toMatchObject({
      email: 'user@example.com',
      password: '[REDACTED]',
      card: { cardNumber: '[REDACTED]' },
    });
  });

  it('emits an error event through trackError', async () => {
    analytics.trackError(new Error('boom'), { component: 'Checkout', action: 'payment' });
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledWith(
      'error_occurred',
      expect.objectContaining({
        error_name: 'Error',
        error_message: 'boom',
        component: 'Checkout',
        action: 'payment',
      }),
      expect.anything()
    );
  });

  it('omits stack traces unless explicitly enabled', async () => {
    analytics.trackError(new Error('boom'));
    await flushMicrotasks();
    expect(provider.track.mock.calls[0]?.[1]).not.toHaveProperty('error_stack');

    const { analytics: withStacks, provider: stackProvider } = await setup({
      errorTracking: { includeStackTrace: true },
    });
    withStacks.trackError(new Error('boom'));
    await flushMicrotasks();

    expect(stackProvider.track.mock.calls[0]?.[1]).toHaveProperty('error_stack');
  });
});

describe('provider management', () => {
  it('adds and removes providers at runtime', async () => {
    const { analytics } = await setup();
    const extra = createMockProvider({ name: 'extra' });

    await analytics.addProvider(extra);
    expect(analytics.provider('extra')).toBe(extra);

    analytics.trackEvent('after_add');
    await flushMicrotasks();
    expect(extra.track).toHaveBeenCalled();

    await analytics.removeProvider('extra');
    expect(analytics.provider('extra')).toBeUndefined();
    expect(extra.destroy).toHaveBeenCalled();

    extra.track.mockClear();
    analytics.trackEvent('after_remove');
    await flushMicrotasks();
    expect(extra.track).not.toHaveBeenCalled();
  });

  it('never calls a provider disabled through configuration', async () => {
    const provider = createMockProvider({ name: 'disabled-provider' });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    analytics.setProviderEnabled('disabled-provider', false);
    analytics.trackEvent('ignored_event');
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
  });

  it('skips providers disabled in the providers config block', async () => {
    const analytics = createAnalytics({
      resolveProvider: (key) => (key === 'mock' ? createMockProvider() : null),
    });
    const resolver = vi.fn();
    await analytics.init({ providers: { mock: { enabled: false, ...{} } } });
    expect(resolver).not.toHaveBeenCalled();
    expect(analytics.getProviders()).toHaveLength(0);
  });

  it('restricts a call with only/except options', async () => {
    const first = createMockProvider({ name: 'first' });
    const second = createMockProvider({ name: 'second' });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [first, second] });

    analytics.trackEvent('only_first', {}, { only: ['first'] });
    await flushMicrotasks();
    expect(first.track).toHaveBeenCalledTimes(1);
    expect(second.track).not.toHaveBeenCalled();

    analytics.trackEvent('except_first', {}, { except: ['first'] });
    await flushMicrotasks();
    expect(first.track).toHaveBeenCalledTimes(1);
    expect(second.track).toHaveBeenCalledTimes(1);
  });

  it('reports provider status', async () => {
    const { analytics } = await setup();
    expect(analytics.getProviderStatus()).toEqual([
      {
        name: 'mock',
        enabled: true,
        initialized: true,
        consentGranted: true,
        requiredConsent: ['analytics'],
      },
    ]);
  });
});

describe('failure isolation', () => {
  it('keeps healthy providers working when one throws', async () => {
    const healthy = createMockProvider({ name: 'healthy' });
    const broken = createMockProvider({ name: 'broken', failing: true });
    const onError = vi.fn();

    const analytics = createAnalytics();
    await analytics.init({ customProviders: [broken, healthy], onError });

    expect(() => analytics.trackEvent('still_works')).not.toThrow();
    await flushMicrotasks();

    expect(healthy.track).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'broken', operation: 'initialize' })
    );
  });

  it('does not throw when a provider rejects asynchronously', async () => {
    const provider = createMockProvider({ name: 'async-broken' });
    provider.track.mockRejectedValue(new Error('network down'));

    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    analytics.trackEvent('async_failure');
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalled();
  });

  it('isolates a provider that fails to initialize', async () => {
    const provider = createMockProvider({ name: 'bad-init', failOnInit: true });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    analytics.trackEvent('after_failed_init');
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
    expect(analytics.getProviderStatus()[0]?.initialized).toBe(false);
  });
});

describe('enablement and privacy', () => {
  it('stops dispatching when disabled', async () => {
    const { analytics, provider } = await setup();

    analytics.setEnabled(false);
    analytics.trackEvent('ignored');
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
    expect(analytics.isEnabled()).toBe(false);
  });

  it('honours opt-out and opt-in', async () => {
    const { analytics, provider } = await setup();

    analytics.optOut();
    analytics.trackEvent('ignored');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();
    expect(analytics.isOptedOut()).toBe(true);

    analytics.optIn();
    analytics.trackEvent('allowed');
    await flushMicrotasks();
    expect(provider.track).toHaveBeenCalledTimes(1);
  });

  it('disables providers in development when configured', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      environment: 'development',
      disableInDevelopment: true,
    });

    analytics.trackEvent('dev_event');
    await flushMicrotasks();

    expect(provider.initialize).not.toHaveBeenCalled();
    expect(provider.track).not.toHaveBeenCalled();
  });

  it('respects Do Not Track when enabled', async () => {
    // jsdom does not define `doNotTrack`, so it is installed for this test only.
    Object.defineProperty(window.navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    });

    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      privacy: { respectDoNotTrack: true },
    });

    analytics.trackEvent('dnt_event');
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
    Reflect.deleteProperty(window.navigator, 'doNotTrack');
  });

  it('can run without an anonymous id', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], privacy: { anonymousId: false } });

    expect(analytics.getAnonymousId()).toBeNull();
  });
});

describe('lifecycle', () => {
  it('flushes providers and tears everything down on destroy', async () => {
    const { analytics, provider } = await setup();

    await analytics.flush();
    expect(provider.flush).toHaveBeenCalled();

    await analytics.destroy();
    expect(provider.destroy).toHaveBeenCalled();
    expect(analytics.isInitialized()).toBe(false);

    analytics.trackEvent('after_destroy');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();
  });
});
