import { afterEach, beforeEach, vi } from 'vitest';
import { resetScriptCache } from '../src/utils/script';
import { clearMemoryStorage } from '../src/utils/storage';

/**
 * Global test setup.
 *
 * Nothing here contacts a real analytics service: vendor globals are stubbed
 * per test, and the script loader never performs network work.
 *
 * The DOM branches are guarded because the SSR suite runs in the `node`
 * environment, where `window` does not exist.
 */

const hasDom = (): boolean => typeof window !== 'undefined';

beforeEach(() => {
  resetScriptCache();
  clearMemoryStorage();

  if (!hasDom()) return;

  // jsdom does not implement PerformanceObserver; several features probe for it.
  if (!('PerformanceObserver' in window)) {
    class MockPerformanceObserver {
      observe(): void {}
      disconnect(): void {}
      takeRecords(): PerformanceEntryList {
        return [];
      }
      static supportedEntryTypes: string[] = [];
    }
    Object.defineProperty(window, 'PerformanceObserver', {
      writable: true,
      configurable: true,
      value: MockPerformanceObserver,
    });
  }

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* storage may be unavailable in a given test */
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  if (!hasDom()) return;

  // Remove any script tags injected by a provider under test.
  document.querySelectorAll('script[id^="analytics-kit-"]').forEach((node) => node.remove());

  const scope = window as unknown as Record<string, unknown>;
  delete scope.dataLayer;
  delete scope.gtag;
  delete scope.analytics;
  delete scope.clarity;
});
