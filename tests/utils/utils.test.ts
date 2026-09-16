import { describe, expect, it, vi } from 'vitest';
import { isSensitiveKey, redactForLogging, sanitizeProperties } from '../../src/utils/sanitize';
import {
  isValidClarityProjectId,
  isValidMeasurementId,
  isValidWriteKey,
  validateEventName,
  validateGroupId,
  validateUserId,
} from '../../src/utils/validation';
import { createStorage, readJson, writeJson } from '../../src/utils/storage';
import { getCookie, removeCookie, setCookie } from '../../src/utils/cookies';
import { createLogger, noopLogger, resolveLogLevel } from '../../src/utils/logger';
import { generateId, generateShortId } from '../../src/utils/id';
import { loadScript, removeScript } from '../../src/utils/script';
import { isOutboundUrl } from '../../src/utils/browser';

describe('sanitizeProperties', () => {
  it('redacts sensitive keys at any depth', () => {
    const result = sanitizeProperties({
      email: 'user@example.com',
      password: 'hunter2',
      'api-key': 'abc',
      nested: { authToken: 'xyz', safe: 'value' },
    });

    expect(result).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      'api-key': '[REDACTED]',
      nested: { authToken: '[REDACTED]', safe: 'value' },
    });
  });

  it('accepts extra keys to redact', () => {
    const result = sanitizeProperties(
      { internalRef: 'x', keep: 'y' },
      { redactKeys: ['internalRef'] }
    );
    expect(result).toEqual({ internalRef: '[REDACTED]', keep: 'y' });
  });

  it('can be switched off', () => {
    const result = sanitizeProperties({ password: 'hunter2' }, { redact: false });
    expect(result).toEqual({ password: 'hunter2' });
  });

  it('enforces depth and size limits', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
    expect(sanitizeProperties(deep, { maxDepth: 2 })).toEqual({ a: { b: '[Object]' } });

    const wide = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`key_${index}`, index])
    );
    expect(Object.keys(sanitizeProperties(wide, { maxProperties: 3 }) ?? {})).toHaveLength(3);
  });

  it('handles circular references, dates and errors', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;

    const result = sanitizeProperties({
      circular,
      when: new Date('2024-01-01T00:00:00.000Z'),
      failure: new Error('boom'),
      fn: () => undefined,
    });

    expect(result).toMatchObject({
      circular: { name: 'root', self: '[Circular]' },
      when: '2024-01-01T00:00:00.000Z',
      failure: { name: 'Error', message: 'boom' },
    });
    expect(result).not.toHaveProperty('fn');
  });

  it('identifies sensitive keys regardless of casing and separators', () => {
    expect(isSensitiveKey('Password')).toBe(true);
    expect(isSensitiveKey('credit-card')).toBe(true);
    expect(isSensitiveKey('CVV')).toBe(true);
    expect(isSensitiveKey('plan')).toBe(false);
  });

  it('redacts log payloads', () => {
    expect(redactForLogging({ token: 'abc', plan: 'pro' })).toEqual({
      token: '[REDACTED]',
      plan: 'pro',
    });
  });
});

describe('validation', () => {
  it('rejects empty event names', () => {
    expect(validateEventName('').valid).toBe(false);
    expect(validateEventName('   ').valid).toBe(false);
    expect(validateEventName(42).valid).toBe(false);
  });

  it('accepts snake_case names without warnings', () => {
    const result = validateEventName('product_viewed');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns about GA4-incompatible names', () => {
    expect(validateEventName('Product Viewed').warnings.join(' ')).toContain('snake_case');
    expect(validateEventName('a'.repeat(45)).warnings.join(' ')).toContain('40 characters');
    expect(validateEventName('session_start').warnings.join(' ')).toContain('reserved');
  });

  it('validates identifiers', () => {
    expect(validateUserId('user-1').valid).toBe(true);
    expect(validateUserId('').valid).toBe(false);
    expect(validateGroupId('group-1').valid).toBe(true);
    expect(validateGroupId(null).valid).toBe(false);
  });

  it('validates provider credentials', () => {
    expect(isValidMeasurementId('G-ABC123')).toBe(true);
    expect(isValidMeasurementId('UA-12345-1')).toBe(false);
    expect(isValidWriteKey('key')).toBe(true);
    expect(isValidWriteKey('')).toBe(false);
    expect(isValidClarityProjectId('abcd1234')).toBe(true);
    expect(isValidClarityProjectId('bad id!')).toBe(false);
  });
});

describe('storage', () => {
  it('reads and writes JSON through localStorage', () => {
    const storage = createStorage({ type: 'localStorage', keyPrefix: 'test' });
    writeJson(storage, 'payload', { hello: 'world' });

    expect(readJson<{ hello: string }>(storage, 'payload')).toEqual({ hello: 'world' });
    expect(window.localStorage.getItem('test_payload')).toBe('{"hello":"world"}');
  });

  it('returns undefined for malformed JSON', () => {
    const storage = createStorage({ type: 'localStorage', keyPrefix: 'test' });
    storage.set('broken', 'not json');
    expect(readJson(storage, 'broken')).toBeUndefined();
  });

  it('falls back to memory when web storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const storage = createStorage({ type: 'localStorage', keyPrefix: 'fallback' });
    expect(storage.set('key', 'value')).toBe(true);

    setItem.mockRestore();
    expect(storage.get('key')).toBe('value');
  });

  it('supports the no-op storage type', () => {
    const storage = createStorage({ type: 'none' });
    expect(storage.set('key', 'value')).toBe(false);
    expect(storage.get('key')).toBeNull();
  });

  it('stores values in cookies when configured', () => {
    const storage = createStorage({ type: 'cookie', keyPrefix: 'ck' });
    storage.set('consent', 'granted');

    expect(storage.get('consent')).toBe('granted');
    storage.remove('consent');
    expect(storage.get('consent')).toBeNull();
  });
});

describe('cookies', () => {
  it('round-trips a value', () => {
    setCookie('test_cookie', 'value with spaces', { expires: 1 });
    expect(getCookie('test_cookie')).toBe('value with spaces');

    removeCookie('test_cookie');
    expect(getCookie('test_cookie')).toBeNull();
  });

  it('returns null for an unknown cookie', () => {
    expect(getCookie('never_set')).toBeNull();
  });
});

describe('logger', () => {
  it('filters output by level', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({ level: 'warn', sink });

    logger.debug('hidden');
    logger.info('hidden');
    logger.warn('shown');
    logger.error('shown');

    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledWith('[Analytics] shown');
    expect(sink.error).toHaveBeenCalled();
  });

  it('prefixes scoped output and supports children', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    createLogger({ level: 'debug', scope: 'app', sink }).child('ga').debug('message', { a: 1 });

    expect(sink.debug).toHaveBeenCalledWith('[Analytics][app:ga] message', { a: 1 });
  });

  it('silences everything at the silent level', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({ level: 'silent', sink });

    logger.error('nope');
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('maps the debug flag to a level', () => {
    expect(resolveLogLevel(true)).toBe('debug');
    expect(resolveLogLevel(false)).toBe('warn');
    expect(resolveLogLevel(false, 'error')).toBe('error');
  });

  it('exposes a no-op logger', () => {
    expect(() => noopLogger.error('ignored')).not.toThrow();
  });
});

describe('ids', () => {
  it('generates unique v4-shaped ids', () => {
    const first = generateId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(generateId()).not.toBe(first);
    expect(generateShortId()).not.toBe(generateShortId());
  });
});

describe('script loader', () => {
  it('injects a tag once and reuses the pending promise', async () => {
    const first = loadScript({ src: 'https://example.com/tag.js', id: 'analytics-kit-test' });
    const second = loadScript({ src: 'https://example.com/tag.js', id: 'analytics-kit-test' });

    expect(document.querySelectorAll('#analytics-kit-test')).toHaveLength(1);

    const tag = document.getElementById('analytics-kit-test') as HTMLScriptElement;
    tag.onload?.(new Event('load'));

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    removeScript('analytics-kit-test');
    expect(document.getElementById('analytics-kit-test')).toBeNull();
  });

  it('rejects when the tag fails to load', async () => {
    const promise = loadScript({
      src: 'https://example.com/broken.js',
      id: 'analytics-kit-broken',
    });
    const tag = document.getElementById('analytics-kit-broken') as HTMLScriptElement;
    tag.onerror?.(new Event('error'));

    await expect(promise).rejects.toThrow(/Failed to load script/);
  });
});

describe('outbound links', () => {
  it('detects cross-origin http(s) links only', () => {
    expect(isOutboundUrl('https://example.com/page')).toBe(true);
    expect(isOutboundUrl('/internal')).toBe(false);
    expect(isOutboundUrl('mailto:someone@example.com')).toBe(false);
    expect(isOutboundUrl('not a url')).toBe(false);
  });
});
