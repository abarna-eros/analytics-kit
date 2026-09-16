import { getWindow } from './browser';

type HistoryListener = (url: string) => void;

interface HistoryRegistry {
  listeners: Set<HistoryListener>;
  patched: boolean;
  originalPushState?: History['pushState'];
  originalReplaceState?: History['replaceState'];
  detachNative?: () => void;
}

/**
 * The registry lives on a global symbol so that the copies of this module in
 * the core bundle and in the React bundle share one set of listeners and patch
 * `history` exactly once.
 */
const REGISTRY_KEY = Symbol.for('@analytics-kit/history');

function getRegistry(): HistoryRegistry {
  const scope = globalThis as typeof globalThis & { [REGISTRY_KEY]?: HistoryRegistry };
  scope[REGISTRY_KEY] ??= { listeners: new Set<HistoryListener>(), patched: false };
  return scope[REGISTRY_KEY];
}

function currentUrl(): string {
  const win = getWindow();
  return win ? `${win.location.pathname}${win.location.search}${win.location.hash}` : '';
}

function notify(): void {
  const url = currentUrl();
  for (const listener of getRegistry().listeners) {
    try {
      listener(url);
    } catch {
      // A misbehaving subscriber must not break navigation for the others.
    }
  }
}

function patch(): void {
  const win = getWindow();
  const registry = getRegistry();
  if (!win || registry.patched) return;

  const history = win.history;
  registry.originalPushState = history.pushState;
  registry.originalReplaceState = history.replaceState;

  history.pushState = function patchedPushState(...args) {
    const result = registry.originalPushState?.apply(this, args);
    notify();
    return result;
  };

  history.replaceState = function patchedReplaceState(...args) {
    const result = registry.originalReplaceState?.apply(this, args);
    notify();
    return result;
  };

  const onNavigation = (): void => notify();
  win.addEventListener('popstate', onNavigation);
  win.addEventListener('hashchange', onNavigation);

  registry.detachNative = () => {
    win.removeEventListener('popstate', onNavigation);
    win.removeEventListener('hashchange', onNavigation);
  };
  registry.patched = true;
}

function unpatch(): void {
  const win = getWindow();
  const registry = getRegistry();
  if (!win || !registry.patched) return;

  if (registry.originalPushState) win.history.pushState = registry.originalPushState;
  if (registry.originalReplaceState) win.history.replaceState = registry.originalReplaceState;
  registry.detachNative?.();

  registry.originalPushState = undefined;
  registry.originalReplaceState = undefined;
  registry.detachNative = undefined;
  registry.patched = false;
}

/**
 * Subscribes to client-side navigation.
 *
 * `popstate` alone misses `pushState`/`replaceState`, which is how React Router
 * and the Next.js App Router navigate, so those two methods are wrapped once
 * and restored when the last subscriber unsubscribes.
 *
 * @returns An unsubscribe function.
 */
export function onHistoryChange(listener: HistoryListener): () => void {
  if (!getWindow()) return () => undefined;

  const registry = getRegistry();
  registry.listeners.add(listener);
  patch();

  return () => {
    registry.listeners.delete(listener);
    if (registry.listeners.size === 0) unpatch();
  };
}

/** Current `pathname + search + hash`, or an empty string on the server. */
export function getCurrentUrl(): string {
  return currentUrl();
}
