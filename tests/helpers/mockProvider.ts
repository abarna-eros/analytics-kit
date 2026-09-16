import { vi } from 'vitest';
import type {
  AnalyticsEventProperties,
  AnalyticsProvider,
  ConsentCategory,
  ConsentSnapshot,
  DispatchContext,
  GroupTraits,
  ProviderInitContext,
  UserTraits,
} from '../../src/core/types';

export interface MockProvider extends AnalyticsProvider {
  initialize: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  page: ReturnType<typeof vi.fn>;
  identify: ReturnType<typeof vi.fn>;
  group: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  setConsent: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  initContext?: ProviderInitContext;
}

export interface MockProviderOptions {
  name?: string;
  requiredConsent?: readonly ConsentCategory[];
  /** Make every call (including initialize) throw. */
  failing?: boolean;
  /** Make only initialize throw. */
  failOnInit?: boolean;
  /** Resolve calls asynchronously. */
  async?: boolean;
}

/** A fully instrumented provider used to assert what the core dispatches. */
export function createMockProvider(options: MockProviderOptions = {}): MockProvider {
  const {
    name = 'mock',
    requiredConsent,
    failing = false,
    failOnInit = false,
    async = false,
  } = options;

  const behave = (label: string) => {
    if (failing) throw new Error(`${name} ${label} failed`);
    return async ? Promise.resolve() : undefined;
  };

  const provider: MockProvider = {
    name,
    ...(requiredConsent ? { requiredConsent } : {}),
    initialize: vi.fn((context: ProviderInitContext) => {
      provider.initContext = context;
      if (failing || failOnInit) throw new Error(`${name} initialize failed`);
      return async ? Promise.resolve() : undefined;
    }),
    track: vi.fn(
      (_event: string, _properties?: AnalyticsEventProperties, _context?: DispatchContext) =>
        behave('track')
    ),
    page: vi.fn(
      (_name?: string, _properties?: AnalyticsEventProperties, _context?: DispatchContext) =>
        behave('page')
    ),
    identify: vi.fn((_userId: string, _traits?: UserTraits, _context?: DispatchContext) =>
      behave('identify')
    ),
    group: vi.fn((_groupId: string, _traits?: GroupTraits, _context?: DispatchContext) =>
      behave('group')
    ),
    reset: vi.fn(() => behave('reset')),
    setConsent: vi.fn((_consent: ConsentSnapshot) => behave('setConsent')),
    flush: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(() => behave('destroy')),
  };

  return provider;
}

/**
 * Waits for queued microtasks.
 *
 * Dispatch is deliberately fire-and-forget, and a flush delivers queued calls
 * sequentially through several `await` points, so the default is generous
 * enough to cover a small batch.
 */
export async function flushMicrotasks(times = 30): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}
