import { StrictMode, useEffect, useState } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsProvider } from '../../src/react/AnalyticsProvider';
import { useAnalytics, useOptionalAnalytics } from '../../src/react/useAnalytics';
import { useConsent } from '../../src/react/useConsent';
import { usePageTracking } from '../../src/react/usePageTracking';
import { AnalyticsBoundary } from '../../src/react/AnalyticsBoundary';
import { createAnalytics } from '../../src/core/Analytics';
import type { Analytics, AnalyticsEventMap } from '../../src/core/types';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

function wrapper(analytics: Analytics<AnalyticsEventMap>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>;
  };
}

describe('useAnalytics', () => {
  it('returns the instance from the provider', () => {
    const analytics = createAnalytics();
    const { result } = renderHook(() => useAnalytics(), { wrapper: wrapper(analytics) });

    expect(result.current).toBe(analytics);
  });

  it('throws a helpful error when used outside the provider', () => {
    expect(() => renderHook(() => useAnalytics())).toThrow(/outside of <AnalyticsProvider>/);
  });

  it('returns null from the optional hook when there is no provider', () => {
    const { result } = renderHook(() => useOptionalAnalytics());
    expect(result.current).toBeNull();
  });

  it('keeps the same instance across re-renders', () => {
    const analytics = createAnalytics();
    const { result, rerender } = renderHook(() => useAnalytics(), { wrapper: wrapper(analytics) });

    const first = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(first);
  });
});

describe('AnalyticsProvider', () => {
  it('initializes the instance once with the supplied config', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    const initSpy = vi.spyOn(analytics, 'init');

    render(
      <AnalyticsProvider analytics={analytics} config={{ customProviders: [provider] }}>
        <span>child</span>
      </AnalyticsProvider>
    );

    await waitFor(() => expect(analytics.isInitialized()).toBe(true));
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(screen.getByText('child')).toBeDefined();
  });

  it('does not initialize providers twice under StrictMode', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    render(
      <StrictMode>
        <AnalyticsProvider analytics={analytics} config={{ customProviders: [provider] }}>
          <span>strict child</span>
        </AnalyticsProvider>
      </StrictMode>
    );

    await waitFor(() => expect(analytics.isInitialized()).toBe(true));
    expect(provider.initialize).toHaveBeenCalledTimes(1);
  });

  it('does not re-initialize when an inline config object changes identity', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    const initSpy = vi.spyOn(analytics, 'init');

    function Host() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        if (count < 3) setCount((value) => value + 1);
      }, [count]);

      return (
        <AnalyticsProvider analytics={analytics} config={{ customProviders: [provider] }}>
          <span>renders: {count}</span>
        </AnalyticsProvider>
      );
    }

    render(<Host />);
    await waitFor(() => expect(screen.getByText(/renders: 3/)).toBeDefined());

    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it('does not destroy the instance on unmount by default', async () => {
    const analytics = createAnalytics();
    const destroySpy = vi.spyOn(analytics, 'destroy');

    const { unmount } = render(
      <AnalyticsProvider analytics={analytics} config={{}}>
        <span>child</span>
      </AnalyticsProvider>
    );

    await waitFor(() => expect(analytics.isInitialized()).toBe(true));
    unmount();

    expect(destroySpy).not.toHaveBeenCalled();
  });

  it('destroys the instance when destroyOnUnmount is set', async () => {
    const analytics = createAnalytics();
    const destroySpy = vi.spyOn(analytics, 'destroy');

    const { unmount } = render(
      <AnalyticsProvider analytics={analytics} config={{}} destroyOnUnmount>
        <span>child</span>
      </AnalyticsProvider>
    );

    await waitFor(() => expect(analytics.isInitialized()).toBe(true));
    unmount();

    expect(destroySpy).toHaveBeenCalled();
  });
});

describe('usePageTracking', () => {
  it('tracks the initial page view', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    renderHook(() => usePageTracking(), { wrapper: wrapper(analytics) });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledTimes(1);
  });

  it('can skip the initial page view', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    renderHook(() => usePageTracking({ trackInitialPageView: false }), {
      wrapper: wrapper(analytics),
    });
    await flushMicrotasks();

    expect(provider.page).not.toHaveBeenCalled();
  });

  it('tracks history navigation', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    renderHook(() => usePageTracking(), { wrapper: wrapper(analytics) });
    await flushMicrotasks();
    provider.page.mockClear();

    act(() => {
      window.history.pushState({}, '', '/dashboard');
    });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledTimes(1);
  });

  it('tracks controlled path changes and deduplicates repeats', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    const { rerender } = renderHook(({ path }: { path: string }) => usePageTracking({ path }), {
      wrapper: wrapper(analytics),
      initialProps: { path: '/one' },
    });
    await flushMicrotasks();
    expect(provider.page).toHaveBeenCalledTimes(1);

    rerender({ path: '/one' });
    await flushMicrotasks();
    expect(provider.page).toHaveBeenCalledTimes(1);

    rerender({ path: '/two' });
    await flushMicrotasks();
    expect(provider.page).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    renderHook(() => usePageTracking({ enabled: false }), { wrapper: wrapper(analytics) });
    await flushMicrotasks();

    expect(provider.page).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    const { unmount } = renderHook(() => usePageTracking(), { wrapper: wrapper(analytics) });
    await flushMicrotasks();
    unmount();
    provider.page.mockClear();

    act(() => {
      window.history.pushState({}, '', '/after-unmount');
    });
    await flushMicrotasks();

    expect(provider.page).not.toHaveBeenCalled();
  });
});

describe('useConsent', () => {
  it('exposes and updates consent state', async () => {
    const analytics = createAnalytics();
    await analytics.init({ consent: { storage: 'memory' } });

    const { result } = renderHook(() => useConsent(), { wrapper: wrapper(analytics) });

    expect(result.current.consent.decided).toBe(false);

    act(() => {
      result.current.setConsent({ analytics: true, marketing: false });
    });

    expect(result.current.consent.decided).toBe(true);
    expect(result.current.isGranted('analytics')).toBe(true);
    expect(result.current.isGranted('marketing')).toBe(false);

    act(() => {
      result.current.clearConsent();
    });
    expect(result.current.consent.decided).toBe(false);
  });
});

describe('AnalyticsBoundary', () => {
  it('reports render errors and shows the fallback', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Boom(): never {
      throw new Error('render exploded');
    }

    render(
      <AnalyticsProvider analytics={analytics}>
        <AnalyticsBoundary component="Checkout" fallback={<span>fallback shown</span>}>
          <Boom />
        </AnalyticsBoundary>
      </AnalyticsProvider>
    );

    await flushMicrotasks();

    expect(screen.getByText('fallback shown')).toBeDefined();
    expect(provider.track).toHaveBeenCalledWith(
      'error_occurred',
      expect.objectContaining({ component: 'Checkout', error_message: 'render exploded' }),
      expect.anything()
    );

    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    const analytics = createAnalytics();
    render(
      <AnalyticsProvider analytics={analytics}>
        <AnalyticsBoundary>
          <span>all good</span>
        </AnalyticsBoundary>
      </AnalyticsProvider>
    );

    expect(screen.getByText('all good')).toBeDefined();
  });
});
