import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

/**
 * Next.js hooks are mocked so the suite exercises our integration logic without
 * booting a Next.js server.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/',
  searchParams: new URLSearchParams(),
}));

const pagesRouter = vi.hoisted(() => {
  const handlers = new Map<string, (url: string) => void>();
  return {
    handlers,
    router: {
      asPath: '/initial',
      events: {
        on: vi.fn((event: string, handler: (url: string) => void) => {
          handlers.set(event, handler);
        }),
        off: vi.fn((event: string) => {
          handlers.delete(event);
        }),
      },
    },
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

vi.mock('next/router', () => ({
  useRouter: () => pagesRouter.router,
}));

vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: string }) =>
    src ? (
      <script data-testid={id} data-src={src} />
    ) : (
      <script data-testid={id} data-inline={children} />
    ),
}));

const { useNextPageTracking } = await import('../../src/next/useNextPageTracking');
const { usePagesRouterPageTracking } = await import('../../src/next/usePagesRouterPageTracking');
const { NextAnalyticsProvider } = await import('../../src/next/NextAnalyticsProvider');
const { AnalyticsScript } = await import('../../src/next/AnalyticsScript');
const { AnalyticsProvider } = await import('../../src/react/AnalyticsProvider');

beforeEach(() => {
  navigation.pathname = '/';
  navigation.searchParams = new URLSearchParams();
  pagesRouter.handlers.clear();
  pagesRouter.router.asPath = '/initial';
});

async function setupAnalytics() {
  const provider = createMockProvider();
  const analytics = createAnalytics();
  await analytics.init({ customProviders: [provider] });
  return { analytics, provider };
}

describe('App Router page tracking', () => {
  it('tracks the initial route', async () => {
    const { analytics, provider } = await setupAnalytics();
    navigation.pathname = '/dashboard';

    renderHook(() => useNextPageTracking(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledTimes(1);
  });

  it('tracks a route change', async () => {
    const { analytics, provider } = await setupAnalytics();
    navigation.pathname = '/one';

    const { rerender } = renderHook(() => useNextPageTracking(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();
    provider.page.mockClear();

    navigation.pathname = '/two';
    rerender();
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledTimes(1);
  });

  it('includes search params by default and can exclude them', async () => {
    const { analytics, provider } = await setupAnalytics();
    navigation.pathname = '/search';
    navigation.searchParams = new URLSearchParams({ q: 'shoes' });

    renderHook(() => useNextPageTracking(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();
    expect(provider.page).toHaveBeenCalledTimes(1);

    provider.page.mockClear();
    renderHook(() => useNextPageTracking({ includeSearchParams: false }), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();
    expect(provider.page).toHaveBeenCalledTimes(1);
  });
});

describe('NextAnalyticsProvider', () => {
  it('renders children and initializes analytics', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    render(
      <NextAnalyticsProvider analytics={analytics} config={{ customProviders: [provider] }}>
        <span>next child</span>
      </NextAnalyticsProvider>
    );

    await vi.waitFor(() => expect(analytics.isInitialized()).toBe(true));
    expect(screen.getByText('next child')).toBeDefined();
    expect(provider.initialize).toHaveBeenCalledTimes(1);
  });

  it('can disable route tracking', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();

    render(
      <NextAnalyticsProvider
        analytics={analytics}
        config={{ customProviders: [provider] }}
        pageTracking={false}
      >
        <span>no tracking</span>
      </NextAnalyticsProvider>
    );

    await vi.waitFor(() => expect(analytics.isInitialized()).toBe(true));
    await flushMicrotasks();

    expect(provider.page).not.toHaveBeenCalled();
  });
});

describe('Pages Router page tracking', () => {
  it('tracks the initial route and subsequent navigation', async () => {
    const { analytics, provider } = await setupAnalytics();

    renderHook(() => usePagesRouterPageTracking(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledWith('/initial', expect.anything(), expect.anything());

    act(() => {
      pagesRouter.handlers.get('routeChangeComplete')?.('/next-page?ref=email');
    });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledWith(
      '/next-page?ref=email',
      expect.anything(),
      expect.anything()
    );
  });

  it('strips the query string when configured', async () => {
    const { analytics, provider } = await setupAnalytics();

    renderHook(() => usePagesRouterPageTracking({ includeSearchParams: false }), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });
    await flushMicrotasks();

    act(() => {
      pagesRouter.handlers.get('routeChangeComplete')?.('/next-page?ref=email');
    });
    await flushMicrotasks();

    expect(provider.page).toHaveBeenCalledWith('/next-page', expect.anything(), expect.anything());
  });

  it('unsubscribes from router events on unmount', async () => {
    const { analytics } = await setupAnalytics();

    const { unmount } = renderHook(() => usePagesRouterPageTracking(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
      ),
    });

    unmount();
    expect(pagesRouter.router.events.off).toHaveBeenCalledWith(
      'routeChangeComplete',
      expect.any(Function)
    );
  });
});

describe('AnalyticsScript', () => {
  it('renders the vendor tags it is given', () => {
    render(
      <AnalyticsScript
        googleAnalyticsId="G-XXXXXXXXXX"
        clarityProjectId="abcd1234"
        segmentWriteKey="write_key_123"
      />
    );

    expect(screen.getByTestId('analytics-kit-gtag').getAttribute('data-src')).toContain(
      'googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'
    );
    expect(screen.getByTestId('analytics-kit-gtag-init').getAttribute('data-inline')).toContain(
      'send_page_view:false'
    );
    expect(screen.getByTestId('analytics-kit-clarity').getAttribute('data-inline')).toContain(
      'clarity.ms/tag/'
    );
    expect(screen.getByTestId('analytics-kit-segment').getAttribute('data-inline')).toContain(
      'analytics.load("write_key_123")'
    );
  });

  it('renders nothing without ids', () => {
    const { container } = render(<AnalyticsScript />);
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  it('refuses ids that could break out of the inline script', () => {
    expect(() => render(<AnalyticsScript googleAnalyticsId={"G-X');alert(1);//"} />)).toThrow(
      /unsupported characters/
    );
  });
});
