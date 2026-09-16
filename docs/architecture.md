# Architecture

## Layers

```
Application code
        │  track / page / identify / group / reset
        ▼
┌─────────────────────────────────────────────────────────┐
│  AnalyticsClient (core)                                 │
│                                                         │
│  validate → defaults → sanitize → gate → queue          │
│                                   │                     │
│                                   ▼                     │
│                          plugins.beforeSend             │
│                                   │                     │
│                     ┌─────────────┴─────────────┐       │
│                     ▼                           ▼       │
│                 plugins                    providers    │
└─────────────────────────────────────────────────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                       ▼                       ▼
                  GoogleAnalytics            Segment                  Clarity
                     (gtag.js)          (analytics.js)            (clarity tag)
```

The core never imports a provider implementation. It only knows the
`AnalyticsProvider` interface. Provider _config types_ are imported with
`import type`, which compiles away entirely, so there is no runtime coupling.

## Directory layout

```
src/
  core/
    types.ts            Public type surface (compiles away)
    constants.ts        Defaults and sensitive-key list
    config.ts           Config resolution and environment gating
    errors.ts           Error classes; NonRetryableError drives retry policy
    consent.ts          ConsentManager: categories, persistence, subscriptions
    queue.ts            DispatchQueue: batching, offline parking, flush-on-unload
    AnalyticsClient.ts  The engine
    Analytics.ts        createAnalytics + singleton helpers
    index.ts            /core entry point

  providers/
    BaseProvider.ts     Optional base class for custom providers
    google-analytics/   gtag.js implementation + config types
    segment/            analytics.js implementation + config types
    clarity/            Clarity tag implementation + config types

  plugins/
    types.ts            Plugin interface
    PluginManager.ts    Registration and isolated hook invocation
    logging.ts          Bundled example plugin

  tracking/
    AutoTracker.ts      Page views, outbound links, clicks, visibility
    PerformanceTracker.ts  Web Vitals via PerformanceObserver
    ErrorTracker.ts     Optional global error capture

  react/                React entry: context, provider, hooks, error boundary
  next/                 Next.js entry: App Router, Pages Router, next/script

  utils/
    browser.ts          Every window/document/navigator access goes through here
    storage.ts          Failure-tolerant key/value storage
    cookies.ts          Cookie helpers
    sanitize.ts         Redaction and depth/size limits
    validation.ts       Event name and credential validation
    logger.ts           Level-filtered logger
    script.ts           Idempotent script tag injection
    history.ts          History API subscription (shared via a global symbol)
    retry.ts            Bounded backoff
    id.ts               Anonymous id generation

  index.ts              Root entry: core + lazy built-in provider resolver
```

## Dispatch pipeline

A call goes through these stages, in order:

1. **Validation** — invalid event names and user ids are logged and dropped. Never thrown.
2. **Enablement** — `enabled`, opt-out and Do Not Track are checked.
3. **Default properties** — merged in (a factory is evaluated per call).
4. **Sanitisation** — sensitive keys redacted, depth and size limits enforced. This happens
   _before_ queueing, so raw sensitive data is never held in a buffer or written to storage.
5. **Buffering** — if `init()` has not finished, or consent has not been decided, the call
   is buffered (bounded) and replayed later.
6. **Queueing** — batching and offline parking, or immediate dispatch when both are off.
7. **`beforeSend` plugins** — may rewrite the payload or veto the call.
8. **Plugin notification** — plugins receive the call (also on the server).
9. **Provider dispatch** — eligible providers are called in parallel, each in isolation.

Stage 9 is skipped entirely on the server.

## Provider eligibility

A provider receives a call only when all of these hold:

- it is enabled (`enabled !== false` and not toggled off at runtime),
- it finished initialising successfully,
- every consent category it requires is granted,
- it is not excluded by the call's `only` / `except` options,
- it implements the method (`group` and `reset` are optional).

## Failure isolation

Every provider and plugin invocation is wrapped. A failure is logged, reported through
`onError`, and then dropped. Consequences:

- A provider that throws during `initialize` is marked failed and never receives calls.
  The other providers are unaffected.
- A provider that throws during `track` does not prevent the other providers from
  receiving the same event.
- A rejected promise from an async provider is caught; unhandled rejections are impossible.
- `AnalyticsBoundary` wraps its own reporting in a second try/catch, so analytics can never
  turn a render error into a second render error.

## Consent state machine

```
          ┌──────────────┐  setConsent()   ┌──────────────┐
          │  undecided   │ ───────────────▶│   decided    │
          │  (buffering) │                 │              │
          └──────────────┘ ◀─────────────── └──────────────┘
                              clearConsent()
```

- **Undecided**: no provider is initialised, no script is loaded, calls are buffered.
- **Decided**: providers whose categories are granted initialise and start receiving the
  replayed buffer; the rest stay dormant.
- **Revoked**: providers stop receiving calls immediately and are notified through
  `setConsent` so they can update their own consent signals (for example Google Consent
  Mode or Clarity's `consentv2`).

When no `consent` block is configured the gate is off and the client behaves as if
everything were granted.

## Browser and server boundaries

| Feature                                 | Browser                                         | Server                           |
| --------------------------------------- | ----------------------------------------------- | -------------------------------- |
| `init()`                                | Full initialisation                             | Config, consent and plugins only |
| Providers                               | Loaded and called                               | Never loaded                     |
| Vendor scripts                          | Injected                                        | Never injected                   |
| Plugins                                 | Run                                             | Run                              |
| `track` / `page` / `identify` / `group` | Dispatched                                      | Silent no-op after plugins       |
| Anonymous id                            | Generated and persisted                         | `null`                           |
| Storage                                 | localStorage / sessionStorage / cookie / memory | Memory only                      |
| Automatic tracking                      | Started when enabled                            | Never started                    |

Every browser global is reached through `src/utils/browser.ts`. No module reads `window`,
`document`, `navigator` or `localStorage` at import time, which is what keeps the package
safe to import from a React Server Component or a Node process.

## Bundle strategy

- The root entry resolves built-in provider keys with dynamic `import()`, so each provider
  becomes its own chunk. Configuring GA4 alone never downloads Segment or Clarity.
- `sideEffects: false` plus subpath exports let bundlers drop everything unused.
- `/react` and `/next` import only _types_ from the core, so the React entry does not
  duplicate the engine and a React-only app never pulls in Next.js.
- Every entry is built in a **single** `tsup` pass. This is load-bearing rather than
  incidental: `tsup` bundles declarations per build, so building `/react` separately would
  emit a second, independent copy of the whole type surface. `Analytics<T>` from `.` and
  from `/react` would then be distinct declarations, and TypeScript would fail to infer `T`
  across them — `<AnalyticsProvider analytics={typedInstance}>` would silently fall back to
  the untyped default event map. Building together also emits the shared core once and
  references it from each entry instead of inlining it into all of them.
- esbuild strips module-level directives when bundling, so `'use client'` is re-applied to
  `react.*` and `next.*` in `tsup`'s `onSuccess` hook. It is prepended to the existing first
  line so source map line numbers stay correct.
- `history.ts` keeps its subscriber registry on a global symbol, so if an application does
  end up with two copies of the package they still cooperate and patch `history.pushState`
  exactly once.
