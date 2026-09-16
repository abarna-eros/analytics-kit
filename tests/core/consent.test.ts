import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { ConsentManager } from '../../src/core/consent';
import { resolveConfig } from '../../src/core/config';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

describe('ConsentManager', () => {
  const consentConfig = (overrides = {}) =>
    resolveConfig({ consent: { storage: 'memory', ...overrides } }).consent;

  it('denies every category until a decision is recorded', () => {
    const manager = new ConsentManager(consentConfig());

    expect(manager.hasDecision()).toBe(false);
    expect(manager.isGranted('analytics')).toBe(false);
    expect(manager.isAllowed(['analytics'])).toBe(false);
  });

  it('grants categories after setConsent', () => {
    const manager = new ConsentManager(consentConfig());
    manager.set({ analytics: true, marketing: false });

    expect(manager.hasDecision()).toBe(true);
    expect(manager.isGranted('analytics')).toBe(true);
    expect(manager.isGranted('marketing')).toBe(false);
    expect(manager.isAllowed(['analytics', 'marketing'])).toBe(false);
  });

  it('treats everything as granted when consent is not required', () => {
    const manager = new ConsentManager(resolveConfig({}).consent);

    expect(manager.isRequired()).toBe(false);
    expect(manager.hasDecision()).toBe(true);
    expect(manager.isGranted('marketing')).toBe(true);
  });

  it('applies configured defaults', () => {
    const manager = new ConsentManager(consentConfig({ defaults: { analytics: true } }));
    expect(manager.isGranted('analytics')).toBe(true);
    expect(manager.hasDecision()).toBe(false);
  });

  it('persists and restores a decision', () => {
    const config = resolveConfig({ consent: { storage: 'localStorage' } }).consent;
    new ConsentManager(config).set({ analytics: true });

    const restored = new ConsentManager(config);
    expect(restored.isGranted('analytics')).toBe(true);
    expect(restored.hasDecision()).toBe(true);
  });

  it('clears a decision', () => {
    const manager = new ConsentManager(consentConfig());
    manager.set({ analytics: true });
    manager.clear();

    expect(manager.hasDecision()).toBe(false);
    expect(manager.isGranted('analytics')).toBe(false);
  });

  it('notifies subscribers and supports unsubscribing', () => {
    const manager = new ConsentManager(consentConfig());
    const listener = vi.fn();

    const unsubscribe = manager.subscribe(listener);
    manager.set({ analytics: true });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    manager.set({ analytics: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('survives a throwing subscriber', () => {
    const manager = new ConsentManager(consentConfig());
    manager.subscribe(() => {
      throw new Error('listener exploded');
    });

    expect(() => manager.set({ analytics: true })).not.toThrow();
  });
});

describe('consent gating in the client', () => {
  it('holds providers and events until consent is granted', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    await analytics.init({
      customProviders: [provider],
      consent: { storage: 'memory' },
    });

    expect(provider.initialize).not.toHaveBeenCalled();

    analytics.trackEvent('queued_event');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();

    analytics.setConsent({ analytics: true });
    await flushMicrotasks();

    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(provider.track).toHaveBeenCalledWith(
      'queued_event',
      expect.anything(),
      expect.anything()
    );
  });

  it('drops queued calls when queueUntilDecision is disabled', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    await analytics.init({
      customProviders: [provider],
      consent: { storage: 'memory', queueUntilDecision: false },
    });

    analytics.trackEvent('dropped_event');
    analytics.setConsent({ analytics: true });
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
  });

  it('only releases providers whose categories are granted', async () => {
    const analyticsProvider = createMockProvider({ name: 'analytics-only' });
    const marketingProvider = createMockProvider({
      name: 'marketing-only',
      requiredConsent: ['marketing'],
    });

    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [analyticsProvider, marketingProvider],
      consent: { storage: 'memory' },
    });

    analytics.setConsent({ analytics: true, marketing: false });
    await flushMicrotasks();

    analytics.trackEvent('partial_consent');
    await flushMicrotasks();

    expect(analyticsProvider.track).toHaveBeenCalled();
    expect(marketingProvider.initialize).not.toHaveBeenCalled();
    expect(marketingProvider.track).not.toHaveBeenCalled();
  });

  it('forwards consent updates to initialized providers', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], consent: { storage: 'memory' } });

    analytics.setConsent({ analytics: true });
    await flushMicrotasks();
    analytics.setConsent({ marketing: true });
    await flushMicrotasks();

    expect(provider.setConsent).toHaveBeenCalledWith(
      expect.objectContaining({ categories: expect.objectContaining({ marketing: true }) })
    );
  });

  it('stops dispatching when consent is revoked', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider], consent: { storage: 'memory' } });

    analytics.setConsent({ analytics: true });
    await flushMicrotasks();

    analytics.setConsent({ analytics: false });
    await flushMicrotasks();

    provider.track.mockClear();
    analytics.trackEvent('after_revoke');
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
  });

  it('exposes consent through the public API', async () => {
    const analytics = createAnalytics();
    await analytics.init({ consent: { storage: 'memory' } });

    analytics.setConsent({ analytics: true, marketing: false, personalization: false });
    expect(analytics.getConsent()).toMatchObject({
      decided: true,
      categories: { analytics: true, marketing: false, personalization: false },
    });

    analytics.clearConsent();
    expect(analytics.getConsent().decided).toBe(false);
  });

  it('allows a provider config to override required consent categories', async () => {
    const provider = createMockProvider({ name: 'strict' });
    const analytics = createAnalytics();

    await analytics.init({ consent: { storage: 'memory' } });
    await analytics.addProvider(provider, { requiredConsent: ['marketing'] });

    analytics.setConsent({ analytics: true });
    await flushMicrotasks();
    expect(provider.initialize).not.toHaveBeenCalled();

    analytics.setConsent({ marketing: true });
    await flushMicrotasks();
    expect(provider.initialize).toHaveBeenCalled();
  });
});
