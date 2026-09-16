import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../../src/core/Analytics';
import { NonRetryableError } from '../../src/core/errors';
import { computeBackoffDelay, withRetry } from '../../src/utils/retry';
import { createMockProvider, flushMicrotasks } from '../helpers/mockProvider';

describe('batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds events until the batch size is reached', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 3, flushInterval: 5000 },
    });

    analytics.trackEvent('one');
    analytics.trackEvent('two');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();

    analytics.trackEvent('three');
    await flushMicrotasks();
    expect(provider.track).toHaveBeenCalledTimes(3);
  });

  it('flushes on the configured interval', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 100, flushInterval: 1000 },
    });

    analytics.trackEvent('delayed');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    expect(provider.track).toHaveBeenCalledTimes(1);
  });

  it('flushes on demand through analytics.flush()', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 100, flushInterval: 60_000 },
    });

    analytics.trackEvent('manual');
    await analytics.flush();

    expect(provider.track).toHaveBeenCalledTimes(1);
    expect(provider.flush).toHaveBeenCalled();
  });

  it('flushes when the page is hidden so queued events are not lost', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 100, flushInterval: 60_000, flushOnUnload: true },
    });

    analytics.trackEvent('before_unload');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('pagehide'));
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledTimes(1);
  });

  it('bypasses the batch when a call is marked immediate', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 100, flushInterval: 60_000 },
    });

    analytics.trackEvent('urgent', {}, { immediate: true });
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledTimes(1);
  });

  it('drops the oldest entries past the queue limit', async () => {
    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      batching: { enabled: true, maxEvents: 1000, flushInterval: 60_000, maxQueueSize: 2 },
    });

    analytics.trackEvent('first');
    analytics.trackEvent('second');
    analytics.trackEvent('third');
    await analytics.flush();

    const trackedNames = provider.track.mock.calls.map(([name]) => name);
    expect(trackedNames).toEqual(['second', 'third']);
  });
});

describe('offline support', () => {
  it('parks events while offline and replays them when back online', async () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    const provider = createMockProvider();
    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      offline: { enabled: true, maxQueueSize: 10 },
    });

    analytics.trackEvent('while_offline');
    await flushMicrotasks();
    expect(provider.track).not.toHaveBeenCalled();

    onLineSpy.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await flushMicrotasks();

    expect(provider.track).toHaveBeenCalledWith(
      'while_offline',
      expect.anything(),
      expect.anything()
    );
    onLineSpy.mockRestore();
  });

  it('persists the offline queue when configured', async () => {
    const onLineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [createMockProvider()],
      offline: { enabled: true, persist: true, storageKey: 'test_offline_queue' },
    });

    analytics.trackEvent('persisted_event');
    await flushMicrotasks();

    const raw = window.localStorage.getItem('ak_analytics_test_offline_queue');
    expect(raw).toContain('persisted_event');

    onLineSpy.mockRestore();
  });
});

describe('retry', () => {
  it('computes bounded exponential backoff', () => {
    const options = { backoff: 'exponential' as const, initialDelay: 100, maxDelay: 1000 };

    expect(computeBackoffDelay(1, options)).toBeLessThanOrEqual(100);
    expect(computeBackoffDelay(10, options)).toBeLessThanOrEqual(1000);
    expect(computeBackoffDelay(1, { ...options, backoff: 'fixed' })).toBeLessThanOrEqual(100);
  });

  it('retries until the operation succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(operation, {
      maxAttempts: 3,
      backoff: 'fixed',
      initialDelay: 1,
      maxDelay: 5,
      sleep: () => Promise.resolve(),
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(operation, {
        maxAttempts: 3,
        backoff: 'linear',
        initialDelay: 1,
        maxDelay: 5,
        sleep: () => Promise.resolve(),
      })
    ).rejects.toThrow('always fails');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('never retries configuration errors', async () => {
    const operation = vi.fn().mockRejectedValue(new NonRetryableError('bad config'));

    await expect(
      withRetry(operation, {
        maxAttempts: 5,
        backoff: 'exponential',
        initialDelay: 1,
        maxDelay: 5,
        sleep: () => Promise.resolve(),
      })
    ).rejects.toThrow('bad config');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries failing provider calls when enabled', async () => {
    const provider = createMockProvider({ name: 'flaky' });
    provider.track
      .mockImplementationOnce(() => {
        throw new Error('transient');
      })
      .mockImplementationOnce(() => undefined);

    const analytics = createAnalytics();
    await analytics.init({
      customProviders: [provider],
      retry: { enabled: true, maxAttempts: 2, initialDelay: 1, maxDelay: 2 },
    });

    analytics.trackEvent('retried_event');
    await vi.waitFor(() => expect(provider.track).toHaveBeenCalledTimes(2));
  });
});
