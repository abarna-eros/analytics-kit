import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/index';
import { BaseProvider } from '../../src/providers/BaseProvider';
import type {
  AnalyticsEventProperties,
  AnalyticsProvider,
  ProviderInitContext,
  UserTraits,
} from '../../src/core/types';
import { flushMicrotasks } from '../helpers/mockProvider';

/** Typed event map, exactly as an application would declare it. */
type AppEvents = {
  button_clicked: { buttonName: string; location: string };
  product_viewed: { productId: string; productName: string };
  checkout_started: { cartValue: number };
};

describe('custom providers', () => {
  it('accepts a plain object implementing the interface', async () => {
    const sent: Array<[string, AnalyticsEventProperties | undefined]> = [];

    const myProvider: AnalyticsProvider = {
      name: 'my-provider',
      initialize: () => undefined,
      track: (eventName, properties) => {
        sent.push([eventName, properties]);
      },
      page: () => undefined,
      identify: () => undefined,
    };

    const analytics = createAnalytics();
    await analytics.init({ customProviders: [myProvider] });

    analytics.trackEvent('custom_event', { value: 1 });
    await flushMicrotasks();

    expect(sent).toEqual([['custom_event', expect.objectContaining({ value: 1 })]]);
  });

  it('supports the BaseProvider helper', async () => {
    interface MyConfig extends Record<string, unknown> {
      endpoint: string;
    }

    const beacons: unknown[] = [];

    class MyProvider extends BaseProvider<MyConfig> {
      readonly name = 'beacon';
      initialized = false;

      protected onInitialize(context: ProviderInitContext<MyConfig>): void {
        void context;
        this.initialized = true;
      }

      track(eventName: string, properties?: AnalyticsEventProperties): void {
        if (!this.isReady()) return;
        beacons.push({ endpoint: this.config.endpoint, eventName, properties });
      }

      page(): void {}
      identify(userId: string, traits?: UserTraits): void {
        void userId;
        void traits;
      }
    }

    const provider = new MyProvider({ endpoint: '/collect' });
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    expect(provider.initialized).toBe(true);

    analytics.trackEvent('beacon_event', { a: 1 });
    await flushMicrotasks();

    expect(beacons).toEqual([
      { endpoint: '/collect', eventName: 'beacon_event', properties: { a: 1 } },
    ]);

    provider.destroy();
    analytics.trackEvent('after_destroy');
    await flushMicrotasks();
    expect(beacons).toHaveLength(1);
  });

  it('registers a custom provider through addProvider', async () => {
    const track = vi.fn();
    const analytics = createAnalytics();
    await analytics.init({});

    await analytics.addProvider({
      name: 'late-provider',
      initialize: () => undefined,
      track,
      page: () => undefined,
      identify: () => undefined,
    });

    analytics.trackEvent('late_event');
    await flushMicrotasks();

    expect(track).toHaveBeenCalled();
  });

  it('honours a custom required consent declaration', async () => {
    const track = vi.fn();
    const analytics = createAnalytics();

    await analytics.init({
      consent: { storage: 'memory' },
      customProviders: [
        {
          name: 'marketing-provider',
          requiredConsent: ['marketing'],
          initialize: () => undefined,
          track,
          page: () => undefined,
          identify: () => undefined,
        },
      ],
    });

    analytics.setConsent({ analytics: true });
    analytics.trackEvent('needs_marketing');
    await flushMicrotasks();
    expect(track).not.toHaveBeenCalled();

    analytics.setConsent({ marketing: true });
    await flushMicrotasks();
    analytics.trackEvent('needs_marketing');
    await flushMicrotasks();
    expect(track).toHaveBeenCalled();
  });
});

describe('typed events', () => {
  it('accepts declared events with matching payloads', async () => {
    const track = vi.fn();
    const analytics = createAnalytics<AppEvents>();

    await analytics.init({
      customProviders: [
        {
          name: 'typed',
          initialize: () => undefined,
          track,
          page: () => undefined,
          identify: () => undefined,
        },
      ],
    });

    analytics.track('button_clicked', { buttonName: 'Signup', location: 'header' });
    analytics.track('checkout_started', { cartValue: 499 });
    await flushMicrotasks();

    expect(track).toHaveBeenCalledTimes(2);
  });

  it('provides an escape hatch for dynamic event names', async () => {
    const track = vi.fn();
    const analytics = createAnalytics<AppEvents>();

    await analytics.init({
      customProviders: [
        {
          name: 'typed',
          initialize: () => undefined,
          track,
          page: () => undefined,
          identify: () => undefined,
        },
      ],
    });

    const dynamicName = `experiment_${Math.floor(Math.random() * 10)}_viewed`;
    analytics.trackEvent(dynamicName, { arbitrary: true });
    await flushMicrotasks();

    expect(track).toHaveBeenCalledWith(dynamicName, expect.anything(), expect.anything());
  });

  it('rejects unknown events and wrong payloads at compile time', () => {
    const analytics = createAnalytics<AppEvents>();

    // @ts-expect-error unknown event name
    analytics.track('not_declared', {});

    // @ts-expect-error missing required property
    analytics.track('button_clicked', { buttonName: 'Signup' });

    // @ts-expect-error wrong property type
    analytics.track('checkout_started', { cartValue: 'free' });

    expect(analytics).toBeDefined();
  });
});
