import { getDocument } from './browser';

export interface LoadScriptOptions {
  src: string;
  async?: boolean;
  defer?: boolean;
  /** Marks the tag so repeated loads are detected across provider instances. */
  id?: string;
  attributes?: Record<string, string>;
  nonce?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Rejects if the script has not loaded within this many ms. @default 10000 */
  timeout?: number;
}

const pending = new Map<string, Promise<void>>();

/**
 * Injects a third-party script tag exactly once per document.
 *
 * Returns a promise that settles on load/error. Callers never have to await it:
 * the vendor snippets used by this package all queue calls made before load.
 */
export function loadScript(options: LoadScriptOptions): Promise<void> {
  const doc = getDocument();
  if (!doc) {
    return Promise.reject(new Error('loadScript called outside the browser'));
  }

  const key = options.id ?? options.src;
  const existingPromise = pending.get(key);
  if (existingPromise) return existingPromise;

  const existingTag = options.id
    ? doc.getElementById(options.id)
    : doc.querySelector(`script[src="${options.src}"]`);
  if (existingTag) {
    const resolved = Promise.resolve();
    pending.set(key, resolved);
    return resolved;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = options.src;
    script.async = options.async ?? true;
    if (options.defer) script.defer = true;
    if (options.id) script.id = options.id;
    if (options.nonce) script.nonce = options.nonce;
    if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      script.setAttribute(name, value);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    script.onload = () => {
      cleanup();
      resolve();
    };
    script.onerror = () => {
      cleanup();
      pending.delete(key);
      script.parentNode?.removeChild(script);
      reject(new Error(`Failed to load script: ${options.src}`));
    };

    const timeout = options.timeout ?? 10_000;
    if (timeout > 0) {
      timer = setTimeout(() => {
        cleanup();
        pending.delete(key);
        reject(new Error(`Timed out loading script: ${options.src}`));
      }, timeout);
      // Never keep a Node process alive because of a pending script timer.
      (timer as unknown as { unref?: () => void }).unref?.();
    }

    const parent = doc.head ?? doc.body ?? doc.documentElement;
    parent.appendChild(script);
  });

  pending.set(key, promise);
  return promise;
}

/** Removes a previously injected script tag and forgets its load promise. */
export function removeScript(idOrSrc: string): void {
  const doc = getDocument();
  pending.delete(idOrSrc);
  if (!doc) return;
  const tag =
    doc.getElementById(idOrSrc) ?? doc.querySelector(`script[src="${idOrSrc}"]`) ?? undefined;
  tag?.parentNode?.removeChild(tag);
}

/** Test hook: clears the module-level load cache. */
export function resetScriptCache(): void {
  pending.clear();
}
