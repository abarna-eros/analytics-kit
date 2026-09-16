import type { CookieOptions } from '../core/types';
import { getDocument } from './browser';

/**
 * Minimal, SSR-safe cookie helpers.
 *
 * Only used when a consumer explicitly selects cookie storage; nothing in this
 * package writes cookies by default.
 */

export function getCookie(name: string): string | null {
  const doc = getDocument();
  if (!doc) return null;
  const encoded = encodeURIComponent(name);
  const entries = doc.cookie ? doc.cookie.split('; ') : [];
  for (const entry of entries) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    if (entry.slice(0, separator) !== encoded) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1));
    } catch {
      return entry.slice(separator + 1);
    }
  }
  return null;
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): boolean {
  const doc = getDocument();
  if (!doc) return false;

  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);

  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (typeof options.expires === 'number') {
    const expires = new Date(Date.now() + options.expires * 864e5);
    parts.push(`Expires=${expires.toUTCString()}`);
    parts.push(`Max-Age=${Math.floor(options.expires * 86400)}`);
  }

  const sameSite = options.sameSite ?? 'Lax';
  parts.push(`SameSite=${sameSite}`);

  // `SameSite=None` is only honoured together with `Secure`.
  if (options.secure || sameSite === 'None') parts.push('Secure');

  try {
    doc.cookie = parts.join('; ');
    return true;
  } catch {
    return false;
  }
}

export function removeCookie(name: string, options: CookieOptions = {}): void {
  setCookie(name, '', { ...options, expires: -1 });
}
