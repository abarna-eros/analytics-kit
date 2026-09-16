# Writing a custom provider

A provider is any object that implements `AnalyticsProvider`. Third-party providers get
exactly the same treatment as the built-in ones: consent gating, property sanitisation,
batching, retries and failure isolation are all handled by the core.

## The interface

```ts
interface AnalyticsProvider<TConfig = unknown> {
  readonly name: string;
  readonly requiredConsent?: readonly ConsentCategory[]; // defaults to ['analytics']

  initialize(context: ProviderInitContext<TConfig>): void | Promise<void>;
  track(eventName: string, properties?, context?): void | Promise<void>;
  page(pageName?, properties?, context?): void | Promise<void>;
  identify(userId: string, traits?, context?): void | Promise<void>;

  group?(groupId: string, traits?, context?): void | Promise<void>;
  reset?(): void | Promise<void>;
  setConsent?(consent: ConsentSnapshot): void | Promise<void>;
  flush?(): Promise<void>;
  destroy?(): void | Promise<void>;
}
```

**Required**: `name`, `initialize`, `track`, `page`, `identify`.
**Optional**: everything else. The core detects which optional methods exist and skips
providers that do not implement the operation, rather than sending an approximation.

### `ProviderInitContext`

| Field         | Description                                             |
| ------------- | ------------------------------------------------------- |
| `config`      | Your provider's configuration                           |
| `logger`      | Level-filtered logger; use it instead of `console`      |
| `environment` | `'development'` \| `'test'` \| `'production'` \| custom |
| `debug`       | Whether debug logging is on                             |
| `consent`     | Consent snapshot at initialisation time                 |
| `anonymousId` | The package's pseudonymous id, if enabled               |

### The third `context` argument

`track`, `page`, `identify` and `group` receive an optional third argument carrying
`anonymousId`, `userId`, `timestamp` and the current `consent` snapshot. Ignore it if your
destination does not need it — the first two arguments match the familiar signature.

## Minimal example

```ts
import type { AnalyticsProvider } from 'analytics-bridge';

interface MyConfig {
  endpoint: string;
  apiKey: string; // must be a public, client-safe key
}

export class MyAnalyticsProvider implements AnalyticsProvider<MyConfig> {
  readonly name = 'my-provider';
  readonly requiredConsent = ['analytics'] as const;

  private endpoint = '';
  private apiKey = '';

  initialize({ config, logger }: ProviderInitContext<MyConfig>): void {
    if (!config.endpoint) throw new ConfigurationError('endpoint is required', this.name);
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    logger.debug('my-provider ready');
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    this.send({ type: 'track', eventName, properties });
  }

  page(pageName?: string, properties?: Record<string, unknown>): void {
    this.send({ type: 'page', pageName, properties });
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.send({ type: 'identify', userId, traits });
  }

  private send(payload: unknown): void {
    // sendBeacon survives page unload, unlike fetch
    navigator.sendBeacon(
      `${this.endpoint}?key=${encodeURIComponent(this.apiKey)}`,
      JSON.stringify(payload)
    );
  }
}
```

Register it:

```ts
await analytics.addProvider(new MyAnalyticsProvider({ endpoint: '/collect', apiKey: 'pk_...' }));

// or at initialisation
await analytics.init({
  customProviders: [new MyAnalyticsProvider({ endpoint: '/collect', apiKey: 'pk_...' })],
});
```

## Using `BaseProvider`

`BaseProvider` stores config, logger and ready state for you:

```ts
import { BaseProvider } from 'analytics-bridge';

export class MyProvider extends BaseProvider<MyConfig> {
  readonly name = 'my-provider';

  protected async onInitialize(): Promise<void> {
    await fetch(`${this.config.endpoint}/session`, { method: 'POST' });
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    if (!this.isReady()) return; // false before init and after destroy
    this.logger.debug(`sending ${eventName}`);
    // ...
  }

  page(): void {}
  identify(): void {}
}
```

## Configuration-driven registration

To let your provider be configured by key like the built-ins, supply a resolver:

```ts
const analytics = createAnalytics({
  resolveProvider: async (key, config) => {
    if (key !== 'myProvider') return null;
    const { MyAnalyticsProvider } = await import('./MyAnalyticsProvider');
    return new MyAnalyticsProvider(config as MyConfig);
  },
});

await analytics.init({
  providers: { myProvider: { endpoint: '/collect', apiKey: 'pk_...' } },
});
```

Returning `null` for unknown keys lets the core report a clear warning. Using dynamic
`import()` keeps your provider out of the main chunk until it is configured.

## Rules to follow

**Never throw from a tracking method to signal a routine problem.** The core catches
everything, but a throw is treated as a failure and may trigger retries. Return early
instead.

**Throw `ConfigurationError` for invalid configuration.** It extends `NonRetryableError`,
so the core will not retry something that cannot succeed.

**Guard every browser API.** `initialize` may run in a jsdom test; use the exported
`isBrowser()` helper and return early when there is no DOM.

**Do not re-sanitise properties.** They arrive already redacted and depth-limited.

**Do not block.** `track` should be fire-and-forget. Use `sendBeacon` or an unawaited
request; implement `flush()` if you buffer internally.

**Declare your consent requirements.** Set `requiredConsent` so the core can gate you
correctly. A marketing pixel should declare `['marketing']`, not rely on the default.

**Clean up in `destroy()`.** Remove listeners and timers; the core calls it on
`removeProvider()` and `destroy()`.

## Testing a custom provider

```ts
import { createAnalytics } from 'analytics-bridge';

it('sends events to my destination', async () => {
  const beacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true);

  const analytics = createAnalytics();
  await analytics.init({
    customProviders: [new MyAnalyticsProvider({ endpoint: '/collect', apiKey: 'pk_test' })],
  });

  analytics.track('my_event', { value: 1 });
  await vi.waitFor(() => expect(beacon).toHaveBeenCalled());
});
```

Remember that `disableInTest` defaults to `true`, so leave `environment` unset (it defaults
to `'production'`) or set `disableInTest: false` in tests.
