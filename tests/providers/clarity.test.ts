import { describe, expect, it, vi } from 'vitest';
import { ClarityProvider, getClarity } from '../../src/providers/clarity/ClarityProvider';
import { ConfigurationError } from '../../src/core/errors';
import { createAnalytics } from '../../src/core/Analytics';
import type { ClarityConfig } from '../../src/providers/clarity/types';
import type { ConsentSnapshot, ProviderInitContext } from '../../src/core/types';
import { noopLogger } from '../../src/utils/logger';

const PROJECT_ID = 'abcd1234';

function initContext(
  config: Partial<ClarityConfig> = {},
  consent: ConsentSnapshot = { categories: { analytics: true }, decided: true }
): ProviderInitContext<ClarityConfig> {
  return {
    config: { projectId: PROJECT_ID, ...config } as ClarityConfig,
    logger: noopLogger,
    environment: 'test',
    debug: false,
    consent,
  };
}

function stubClarity() {
  const clarity = vi.fn();
  Object.defineProperty(window, 'clarity', { value: clarity, writable: true, configurable: true });
  return clarity;
}

describe('ClarityProvider', () => {
  it('requires a project id', async () => {
    const provider = new ClarityProvider();
    await expect(provider.initialize(initContext({ projectId: '' }))).rejects.toBeInstanceOf(
      ConfigurationError
    );
  });

  it('installs the queueing shim when Clarity is absent', async () => {
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    const clarity = (
      window as unknown as { clarity: ((...args: unknown[]) => void) & { q?: unknown[] } }
    ).clarity;
    expect(typeof clarity).toBe('function');

    provider.event('queued_before_load');
    expect(clarity.q).toContainEqual(['event', 'queued_before_load']);
  });

  it('injects the official Clarity tag', async () => {
    const provider = new ClarityProvider();
    await provider.initialize(initContext());

    const script = document.getElementById('analytics-kit-clarity') as HTMLScriptElement | null;
    expect(script?.src).toBe(`https://www.clarity.ms/tag/${PROJECT_ID}`);
  });

  it('maps track onto a Clarity custom event', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.track('checkout_started', { cartValue: 42 });
    expect(clarity).toHaveBeenCalledWith('event', 'checkout_started');
  });

  it('does not turn event properties into tags by default', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.track('checkout_started', { cartValue: 42 });
    expect(clarity).not.toHaveBeenCalledWith('set', 'cartValue', '42');
  });

  it('writes event properties as tags when enabled', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false, eventPropertiesAsTags: true }));

    provider.track('checkout_started', { cartValue: 42 });
    expect(clarity).toHaveBeenCalledWith('set', 'cartValue', '42');
  });

  it('identifies a user', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.identify('user-123');
    expect(clarity).toHaveBeenCalledWith('identify', 'user-123');
  });

  it('supports the extended identify signature', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.identifyUser('user-123', 'session-1', 'page-1', 'Ada');
    expect(clarity).toHaveBeenCalledWith('identify', 'user-123', 'session-1', 'page-1', 'Ada');
  });

  it('sets custom tags, including array values', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.setTag('plan', 'premium');
    provider.setTag('features', ['a', 'b']);

    expect(clarity).toHaveBeenCalledWith('set', 'plan', 'premium');
    expect(clarity).toHaveBeenCalledWith('set', 'features', ['a', 'b']);
  });

  it('applies configured tags at initialization', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false, tags: { tier: 'enterprise' } }));

    expect(clarity).toHaveBeenCalledWith('set', 'tier', 'enterprise');
  });

  it('prioritises a session for configured events', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(
      initContext({ loadScript: false, upgradeOnEvents: ['checkout_started'] })
    );

    provider.track('checkout_started');
    expect(clarity).toHaveBeenCalledWith('upgrade', 'checkout_started');
  });

  it('forwards consent using consentv2', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(
      initContext({ loadScript: false }, { categories: { analytics: true }, decided: true })
    );

    expect(clarity).toHaveBeenCalledWith('consentv2', {
      analytics_Storage: 'granted',
      ad_Storage: 'denied',
    });

    provider.setConsent({ categories: { analytics: true, marketing: true }, decided: true });
    expect(clarity).toHaveBeenCalledWith('consentv2', {
      analytics_Storage: 'granted',
      ad_Storage: 'granted',
    });
  });

  it('ignores page calls unless page tags are enabled', async () => {
    const clarity = stubClarity();
    const provider = new ClarityProvider();
    await provider.initialize(initContext({ loadScript: false }));

    provider.page('/dashboard');
    expect(clarity).not.toHaveBeenCalledWith('set', 'page', '/dashboard');

    const tagging = new ClarityProvider();
    await tagging.initialize(initContext({ loadScript: false, pageTags: true }));
    tagging.page('/dashboard');
    expect(clarity).toHaveBeenCalledWith('set', 'page', '/dashboard');
  });

  it('is reachable through the provider-specific accessor', async () => {
    const clarity = stubClarity();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [new ClarityProvider({ projectId: PROJECT_ID, loadScript: false })],
    });

    const provider = getClarity(analytics);
    expect(provider).toBeInstanceOf(ClarityProvider);

    provider?.setTag('plan', 'premium');
    provider?.event('checkout_started');

    expect(clarity).toHaveBeenCalledWith('set', 'plan', 'premium');
    expect(clarity).toHaveBeenCalledWith('event', 'checkout_started');
  });
});
