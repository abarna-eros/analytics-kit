import type { CookieOptions, StorageType } from '../core/types';
import { isBrowser } from './browser';
import { getCookie, removeCookie, setCookie } from './cookies';

/**
 * Uniform, failure-tolerant key/value storage.
 *
 * Browser storage throws in several real situations (Safari private mode,
 * disabled cookies, cross-origin iframes, quota exhaustion). Every operation
 * here degrades to an in-memory map instead of propagating the error.
 */
export interface KeyValueStorage {
  readonly type: StorageType;
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /** Removes only keys written by this package. */
  clear(): void;
}

const memoryStore = new Map<string, string>();

/** Test hook: empties the in-memory fallback shared by all memory storages. */
export function clearMemoryStorage(): void {
  memoryStore.clear();
}

function isWebStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  if (!isBrowser()) return false;
  try {
    const storage = window[type];
    if (!storage) return false;
    const probe = '__ak_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export interface CreateStorageOptions {
  type?: StorageType;
  keyPrefix?: string;
  cookie?: CookieOptions;
}

export function createStorage(options: CreateStorageOptions = {}): KeyValueStorage {
  const { type = 'localStorage', keyPrefix = '', cookie } = options;
  const prefixed = (key: string): string => (keyPrefix ? `${keyPrefix}_${key}` : key);
  const writtenKeys = new Set<string>();

  if (type === 'none') {
    return {
      type: 'none',
      get: () => null,
      set: () => false,
      remove: () => undefined,
      clear: () => undefined,
    };
  }

  if (type === 'cookie') {
    return {
      type: 'cookie',
      get: (key) => getCookie(prefixed(key)),
      set: (key, value) => {
        writtenKeys.add(key);
        return setCookie(prefixed(key), value, cookie ?? { expires: 365 });
      },
      remove: (key) => removeCookie(prefixed(key), cookie ?? {}),
      clear: () => {
        for (const key of writtenKeys) removeCookie(prefixed(key), cookie ?? {});
        writtenKeys.clear();
      },
    };
  }

  const memoryFallback: KeyValueStorage = {
    type: 'memory',
    get: (key) => memoryStore.get(prefixed(key)) ?? null,
    set: (key, value) => {
      memoryStore.set(prefixed(key), value);
      writtenKeys.add(key);
      return true;
    },
    remove: (key) => {
      memoryStore.delete(prefixed(key));
    },
    clear: () => {
      for (const key of writtenKeys) memoryStore.delete(prefixed(key));
      writtenKeys.clear();
    },
  };

  if (type === 'memory') return memoryFallback;

  if (!isWebStorageAvailable(type)) return memoryFallback;

  const storage = window[type];

  return {
    type,
    get: (key) => {
      try {
        return storage.getItem(prefixed(key));
      } catch {
        return memoryFallback.get(key);
      }
    },
    set: (key, value) => {
      writtenKeys.add(key);
      try {
        storage.setItem(prefixed(key), value);
        return true;
      } catch {
        return memoryFallback.set(key, value);
      }
    },
    remove: (key) => {
      try {
        storage.removeItem(prefixed(key));
      } catch {
        /* ignore */
      }
      memoryFallback.remove(key);
    },
    clear: () => {
      for (const key of writtenKeys) {
        try {
          storage.removeItem(prefixed(key));
        } catch {
          /* ignore */
        }
      }
      writtenKeys.clear();
      memoryFallback.clear();
    },
  };
}

/** Reads and parses a JSON value, returning `undefined` on any failure. */
export function readJson<T>(storage: KeyValueStorage, key: string): T | undefined {
  const raw = storage.get(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Serialises and writes a JSON value, swallowing serialisation errors. */
export function writeJson(storage: KeyValueStorage, key: string, value: unknown): boolean {
  try {
    return storage.set(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
