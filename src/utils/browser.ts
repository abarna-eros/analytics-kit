/**
 * Environment guards.
 *
 * Every browser API access in this package goes through one of these helpers so
 * that server rendering never touches `window`, `document` or `navigator`.
 */

/** `true` when a DOM is available (browser or jsdom). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/** `true` when running in a Node-like server environment. */
export function isServer(): boolean {
  return !isBrowser();
}

/** Returns `window` only in the browser, otherwise `undefined`. */
export function getWindow(): (Window & typeof globalThis) | undefined {
  return isBrowser() ? window : undefined;
}

/** Returns `document` only in the browser, otherwise `undefined`. */
export function getDocument(): Document | undefined {
  return isBrowser() ? window.document : undefined;
}

/** Returns `navigator` only when it exists. */
export function getNavigator(): Navigator | undefined {
  return typeof navigator !== 'undefined' ? navigator : undefined;
}

/** `true` when the browser reports an online connection (optimistic default). */
export function isOnline(): boolean {
  const nav = getNavigator();
  if (!nav || typeof nav.onLine !== 'boolean') return true;
  return nav.onLine;
}

/** `true` when the user has enabled a Do Not Track signal. */
export function isDoNotTrackEnabled(): boolean {
  const nav = getNavigator();
  if (!nav) return false;
  const win = getWindow();
  const signals = [
    nav.doNotTrack,
    (nav as Navigator & { msDoNotTrack?: string }).msDoNotTrack,
    (win as (Window & { doNotTrack?: string }) | undefined)?.doNotTrack,
  ];
  return signals.some((signal) => signal === '1' || signal === 'yes');
}

/** Current page descriptor, or `undefined` on the server. */
export interface PageInfo {
  path: string;
  url: string;
  title: string;
  referrer: string;
  search: string;
  hash: string;
}

export function getPageInfo(): PageInfo | undefined {
  const win = getWindow();
  const doc = getDocument();
  if (!win || !doc) return undefined;
  return {
    path: win.location.pathname,
    url: win.location.href,
    title: doc.title,
    referrer: doc.referrer,
    search: win.location.search,
    hash: win.location.hash,
  };
}

/** Schedules non-critical work without blocking rendering. */
export function runWhenIdle(callback: () => void, timeout = 2000): () => void {
  const win = getWindow();
  if (!win) {
    return () => undefined;
  }

  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const idleWin = win as IdleWindow;

  if (typeof idleWin.requestIdleCallback === 'function') {
    const handle = idleWin.requestIdleCallback(callback, { timeout });
    return () => idleWin.cancelIdleCallback?.(handle);
  }

  const handle = win.setTimeout(callback, 0);
  return () => win.clearTimeout(handle);
}

/** `true` when the given href points at a different origin than the current page. */
export function isOutboundUrl(href: string): boolean {
  const win = getWindow();
  if (!win) return false;
  try {
    const url = new URL(href, win.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin !== win.location.origin;
  } catch {
    return false;
  }
}
