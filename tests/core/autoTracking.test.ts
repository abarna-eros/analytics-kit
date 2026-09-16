import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { AutoTracker } from '../../src/tracking/AutoTracker';
import { ErrorTracker } from '../../src/tracking/ErrorTracker';
import { PerformanceTracker } from '../../src/tracking/PerformanceTracker';
import { resolveConfig } from '../../src/core/config';
import { noopLogger } from '../../src/utils/logger';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

function autoTrackerOptions(autoTrack = {}) {
  const track = vi.fn();
  const page = vi.fn();
  const tracker = new AutoTracker({
    config: resolveConfig({ autoTrack }).autoTrack,
    logger: noopLogger,
    track,
    page,
  });
  return { tracker, track, page };
}

describe('automatic tracking defaults', () => {
  it('collects nothing unless explicitly enabled', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({ customProviders: [provider] });

    document.body.innerHTML = '<a href="https://external.example.com">external</a>';
    document.querySelector('a')?.click();
    document.dispatchEvent(new Event('visibilitychange'));
    await flushMicrotasks();

    expect(provider.track).not.toHaveBeenCalled();
    expect(provider.page).not.toHaveBeenCalled();
  });
});

describe('AutoTracker', () => {
  it('tracks page views on load and history navigation', async () => {
    const { tracker, page } = autoTrackerOptions({ pageViews: true });
    tracker.start();

    expect(page).toHaveBeenCalledTimes(1);

    window.history.pushState({}, '', '/auto-tracked');
    await flushMicrotasks();
    expect(page).toHaveBeenCalledTimes(2);

    tracker.stop();
    window.history.pushState({}, '', '/after-stop');
    await flushMicrotasks();
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('tracks outbound links only', () => {
    const { tracker, track } = autoTrackerOptions({ outboundLinks: true });
    tracker.start();

    document.body.innerHTML = `
      <a id="external" href="https://external.example.com/pricing">External</a>
      <a id="internal" href="/internal">Internal</a>
    `;

    document.getElementById('external')?.click();
    expect(track).toHaveBeenCalledWith('outbound_link_clicked', {
      link_url: 'https://external.example.com/pricing',
      link_domain: 'external.example.com',
      link_text: 'External',
    });

    track.mockClear();
    document.getElementById('internal')?.click();
    expect(track).not.toHaveBeenCalled();

    tracker.stop();
  });

  it('tracks only opted-in elements for clicks', () => {
    const { tracker, track } = autoTrackerOptions({ clicks: true });
    tracker.start();

    document.body.innerHTML = `
      <button id="opted" data-analytics-event="signup_clicked" data-analytics-location="header">Sign up</button>
      <button id="plain">Plain</button>
    `;

    document.getElementById('opted')?.click();
    expect(track).toHaveBeenCalledWith('signup_clicked', { location: 'header' });

    track.mockClear();
    document.getElementById('plain')?.click();
    expect(track).not.toHaveBeenCalled();

    tracker.stop();
  });

  it('supports a custom click selector', () => {
    const { tracker, track } = autoTrackerOptions({
      clicks: { selector: '[data-track]', eventAttribute: 'data-track' },
    });
    tracker.start();

    document.body.innerHTML = '<button id="custom" data-track="custom_click">Go</button>';
    document.getElementById('custom')?.click();

    expect(track).toHaveBeenCalledWith('custom_click', {});
    tracker.stop();
  });

  it('tracks visibility changes', () => {
    const { tracker, track } = autoTrackerOptions({ visibilityChange: true });
    tracker.start();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(track).toHaveBeenCalledWith('visibility_changed', {
      visibility_state: document.visibilityState,
    });

    tracker.stop();
  });

  it('attaches a single click listener for both click features', () => {
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const { tracker } = autoTrackerOptions({ clicks: true, outboundLinks: true });
    tracker.start();

    const clickListeners = addEventListener.mock.calls.filter(([type]) => type === 'click');
    expect(clickListeners).toHaveLength(1);

    tracker.stop();
    addEventListener.mockRestore();
  });
});

describe('ErrorTracker', () => {
  it('reports window errors and unhandled rejections', () => {
    const report = vi.fn();
    const tracker = new ErrorTracker({
      config: resolveConfig({ errorTracking: { captureErrors: true } }).errorTracking,
      logger: noopLogger,
      report,
    });
    tracker.start();

    window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
    expect(report).toHaveBeenCalledWith(expect.any(Error), { error_source: 'window.onerror' });

    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('rejected');
    window.dispatchEvent(rejection);

    expect(report).toHaveBeenCalledTimes(2);
    tracker.stop();
  });

  it('caps the number of reported errors', () => {
    const report = vi.fn();
    const tracker = new ErrorTracker({
      config: resolveConfig({
        errorTracking: { captureErrors: true, maxErrorsPerSession: 2 },
      }).errorTracking,
      logger: noopLogger,
      report,
    });
    tracker.start();

    for (let index = 0; index < 5; index += 1) {
      window.dispatchEvent(new ErrorEvent('error', { message: `boom ${index}` }));
    }

    expect(report).toHaveBeenCalledTimes(2);
    tracker.stop();
  });

  it('stops reporting once stopped', () => {
    const report = vi.fn();
    const tracker = new ErrorTracker({
      config: resolveConfig({ errorTracking: { captureErrors: true } }).errorTracking,
      logger: noopLogger,
      report,
    });

    tracker.start();
    tracker.stop();
    window.dispatchEvent(new ErrorEvent('error', { message: 'ignored' }));

    expect(report).not.toHaveBeenCalled();
  });
});

describe('PerformanceTracker', () => {
  it('observes the configured entry types', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const observers: Array<(entries: { getEntries: () => PerformanceEntry[] }) => void> = [];

    class MockObserver {
      constructor(callback: (list: { getEntries: () => PerformanceEntry[] }) => void) {
        observers.push(callback);
      }
      observe = observe;
      disconnect = disconnect;
    }
    vi.stubGlobal('PerformanceObserver', MockObserver);

    const track = vi.fn();
    const tracker = new PerformanceTracker({
      config: resolveConfig({
        performanceTracking: { enabled: true, metrics: ['fcp', 'lcp', 'cls'] },
      }).performanceTracking,
      logger: noopLogger,
      track,
    });

    tracker.start();
    // Observers are registered during idle time so rendering is never blocked.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const observedTypes = observe.mock.calls.map(([init]) => (init as { type: string }).type);
    expect(observedTypes).toEqual(
      expect.arrayContaining(['paint', 'largest-contentful-paint', 'layout-shift'])
    );

    observers[0]?.({
      getEntries: () => [
        { name: 'first-contentful-paint', startTime: 123.456 } as PerformanceEntry,
      ],
    });

    expect(track).toHaveBeenCalledWith('performance_metric', {
      metric_name: 'fcp',
      metric_value: 123.456,
      metric_unit: 'millisecond',
    });

    tracker.stop();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('skips collection when sampled out', () => {
    const track = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const tracker = new PerformanceTracker({
      config: resolveConfig({ performanceTracking: { enabled: true, sampleRate: 0.1 } })
        .performanceTracking,
      logger: noopLogger,
      track,
    });

    tracker.start();
    expect(track).not.toHaveBeenCalled();
    tracker.stop();
  });
});
