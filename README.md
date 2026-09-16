# @analytics-kit/react-analytics

One provider-independent analytics API for React and Next.js applications.

Configure Google Analytics 4, Twilio Segment and Microsoft Clarity once, then call `track`,
`page` and `identify` without ever writing vendor-specific code in your app. Adding,
removing or swapping a destination becomes a config change instead of a refactor.

```ts
analytics.track('product_viewed', { productId: '123', productName: 'Example' });
```

That single call reaches every configured provider, translated into `gtag('event', ...)`,
`analytics.track(...)` and `clarity('event', ...)` respectively.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Features](#2-features)
3. [Supported providers](#3-supported-providers)
4. [Installation](#4-installation)
5. [Quick start](#5-quick-start)
6. [React setup](#6-react-setup)
7. [Next.js setup](#7-nextjs-setup)
8. [Google Analytics 4 setup](#8-google-analytics-4-setup)
9. [Segment setup](#9-segment-setup)
10. [Clarity setup](#10-clarity-setup)
11. [Event tracking](#11-event-tracking)
12. [Page tracking](#12-page-tracking)
13. [User identification](#13-user-identification)
14. [Group tracking](#14-group-tracking)
15. [Consent management](#15-consent-management)
16. [Automatic tracking](#16-automatic-tracking)
17. [Performance tracking](#17-performance-tracking)
18. [Error tracking](#18-error-tracking)
19. [Batching](#19-batching)
20. [Offline support](#20-offline-support)
21. [Custom providers](#21-custom-providers)
22. [Plugins](#22-plugins)
23. [TypeScript](#23-typescript)
24. [Privacy](#24-privacy)
25. [Security](#25-security)
26. [Troubleshooting](#26-troubleshooting)
27. [API reference](#27-api-reference)
28. [Contributing](#28-contributing)
29. [License](#29-license)

---

## 1. Introduction

Analytics code has a habit of leaking into product code. A component ends up importing
`gtag`, a hook calls `window.analytics`, and a third file pokes at `clarity`. Swapping a
vendor then means touching every one of those files, and none of it is testable.

This package puts a single interface in front of every destination:

- Your application talks to **one API**: `track`, `page`, `identify`, `group`, `reset`.
- Each destination implements **one interface**: `AnalyticsProvider`.
- The core knows nothing about GA4, Segment or Clarity. Provider code stays in provider files.

Everything else — consent gating, batching, retries, sanitisation, failure isolation — is
handled once in the core instead of three times in three integrations.

**Execution model:** all providers are browser-only. On the server every call is a safe
no-op, so server rendering never touches `window`, `document` or `localStorage`, and no
vendor script is ever injected during SSR.

## 2. Features

| Capability                 | Notes                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| Provider abstraction       | One interface; the core contains zero vendor code                            |
| Multiple providers at once | GA4 + Segment + Clarity in parallel, each isolated                           |
| Failure isolation          | A throwing provider never breaks other providers or your app                 |
| Typed events               | Optional event map gives compile-time checked names and payloads             |
| Consent management         | Category-based, CMP-agnostic, with buffering until a decision                |
| Privacy defaults           | Sensitive keys redacted, opt-out, Do Not Track, anonymous id control         |
| React integration          | Provider, hooks, error boundary, StrictMode-safe                             |
| Next.js integration        | App Router and Pages Router helpers, optional peer dependency                |
| Automatic tracking         | Page views, outbound links, opted-in clicks, visibility — all off by default |
| Web Vitals                 | LCP, CLS, INP, FCP, TTFB and navigation timing via `PerformanceObserver`     |
| Error tracking             | Manual `trackError` plus optional global capture                             |
| Batching & retry           | Optional queueing with flush-on-unload and bounded backoff                   |
| Offline queue              | Optional parking of calls while offline, with replay                         |
| Plugins                    | Observe, enrich or veto any call                                             |
| Tree-shakable              | Providers load as separate chunks; subpath exports for everything            |
| Zero runtime dependencies  | Nothing but your peer-installed React                                        |

## 3. Supported providers

| Provider           | Key               | Import path                      | Credential                      | Client-safe? |
| ------------------ | ----------------- | -------------------------------- | ------------------------------- | ------------ |
| Google Analytics 4 | `googleAnalytics` | `.../providers/google-analytics` | Measurement ID (`G-XXXXXXXXXX`) | Yes — public |
| Twilio Segment     | `segment`         | `.../providers/segment`          | Write key                       | Yes — public |
| Microsoft Clarity  | `clarity`         | `.../providers/clarity`          | Project ID                      | Yes — public |

Anything else can be added as a [custom provider](#21-custom-providers) without changing
the public API.

## 4. Installation

```bash
npm install @analytics-kit/react-analytics
```

```bash
pnpm add @analytics-kit/react-analytics
# or
yarn add @analytics-kit/react-analytics
```

Peer dependencies:

| Package | Requirement | Notes                                       |
| ------- | ----------- | ------------------------------------------- |
| `react` | `>=17.0.0`  | Needed for the `/react` and `/next` entries |
| `next`  | `>=13.4.0`  | **Optional**; only for the `/next` entry    |

The package ships ESM and CommonJS builds, `.d.ts`/`.d.cts` declarations, and source maps.

## 5. Quick start

```ts
import { createAnalytics } from '@analytics-kit/react-analytics';

export const analytics = createAnalytics();

await analytics.init({
  providers: {
    googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    segment: { writeKey: 'YOUR_WRITE_KEY' },
    clarity: { projectId: 'YOUR_PROJECT_ID' },
  },
  debug: process.env.NODE_ENV !== 'production',
  environment: process.env.NODE_ENV,
});

analytics.track('button_clicked', { button: 'signup' });
analytics.page();
analytics.identify('user-123', { name: 'John', plan: 'premium' });
analytics.group('company-123', { name: 'Example Company' });
analytics.reset();
```

`init()` returns a promise you can await, but you do not have to: calls made before
initialisation completes are buffered and replayed, so nothing is lost.

Two runnable applications cover everything below end to end:
[`examples/react`](./examples/react) (Vite + React Router) and
[`examples/nextjs`](./examples/nextjs) (App Router).

### Enabling and disabling providers

```ts
await analytics.init({
  providers: {
    googleAnalytics: { enabled: true, measurementId: 'G-XXXXXXXXXX' },
    segment: { enabled: false, writeKey: 'YOUR_WRITE_KEY' },
    clarity: { enabled: true, projectId: 'YOUR_PROJECT_ID' },
  },
});
```

A provider with `enabled: false` is never loaded, never initialised and never called — its
code is not even downloaded.

## 6. React setup

Create the instance **once**, outside your component tree, and pass it to the provider.

```tsx
// analytics.ts
import { createAnalytics } from '@analytics-kit/react-analytics';

export const analytics = createAnalytics();
```

```tsx
// App.tsx
import { AnalyticsProvider } from '@analytics-kit/react-analytics/react';
import { analytics } from './analytics';

export function App() {
  return (
    <AnalyticsProvider
      analytics={analytics}
      config={{
        providers: { googleAnalytics: { measurementId: import.meta.env.VITE_GA_ID } },
        environment: import.meta.env.MODE,
      }}
      pageTracking
    >
      <Routes />
    </AnalyticsProvider>
  );
}
```

```tsx
// Any component
import { useAnalytics } from '@analytics-kit/react-analytics/react';

function LoginButton() {
  const analytics = useAnalytics();

  return (
    <button onClick={() => analytics.track('button_clicked', { buttonName: 'Login' })}>
      Log in
    </button>
  );
}
```

`init()` is idempotent, so React StrictMode's double mount cannot initialise a provider
twice, and re-renders never create a second instance.

### With React Router

Pass the current path so tracking follows the router rather than the History API:

```tsx
import { useLocation } from 'react-router-dom';
import { usePageTracking } from '@analytics-kit/react-analytics/react';

function PageTracker() {
  usePageTracking({ path: useLocation().pathname });
  return null;
}
```

Without a `path`, `usePageTracking` listens for `pushState`, `replaceState`, `popstate` and
`hashchange`, which covers most routers automatically.

### Error boundary

```tsx
import { AnalyticsBoundary } from '@analytics-kit/react-analytics/react';

<AnalyticsBoundary component="Checkout" fallback={<CheckoutError />}>
  <Checkout />
</AnalyticsBoundary>;
```

Render errors are reported as `error_occurred` events. Analytics failures inside the
boundary can never escalate into a second render error.

## 7. Next.js setup

Next.js support is an optional layer. The core package never imports Next.js.

### App Router

```tsx
// app/providers.tsx
'use client';

import { createAnalytics } from '@analytics-kit/react-analytics';
import { NextAnalyticsProvider } from '@analytics-kit/react-analytics/next';

const analytics = createAnalytics();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextAnalyticsProvider
      analytics={analytics}
      config={{
        providers: {
          googleAnalytics: { measurementId: process.env.NEXT_PUBLIC_GA_ID! },
          clarity: { projectId: process.env.NEXT_PUBLIC_CLARITY_ID! },
        },
        environment: process.env.NODE_ENV,
      }}
    >
      {children}
    </NextAnalyticsProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`NextAnalyticsProvider` tracks App Router navigation and wraps the tracker in `<Suspense>`,
because `useSearchParams()` would otherwise opt the route into client-side rendering.

### Pages Router

```tsx
// pages/_app.tsx
import { AnalyticsProvider } from '@analytics-kit/react-analytics/react';
import { usePagesRouterPageTracking } from '@analytics-kit/react-analytics/next';
import { analytics } from '../analytics';

function PageTracker() {
  usePagesRouterPageTracking();
  return null;
}

export default function MyApp({ Component, pageProps }) {
  return (
    <AnalyticsProvider analytics={analytics} config={{/* ... */}}>
      <PageTracker />
      <Component {...pageProps} />
    </AnalyticsProvider>
  );
}
```

### Loading tags with `next/script`

To let Next.js control script priority (or to satisfy a strict CSP), render the tags
yourself and tell the providers not to inject them:

```tsx
// app/layout.tsx
import { AnalyticsScript } from '@analytics-kit/react-analytics/next';

<AnalyticsScript googleAnalyticsId={process.env.NEXT_PUBLIC_GA_ID} />;
```

```ts
providers: {
  googleAnalytics: { measurementId: process.env.NEXT_PUBLIC_GA_ID!, loadScript: false },
}
```

Only `NEXT_PUBLIC_*` variables are readable in the browser — which is correct here, since
all three providers use public client-side identifiers.

## 8. Google Analytics 4 setup

```ts
await analytics.init({
  providers: {
    googleAnalytics: {
      measurementId: 'G-XXXXXXXXXX',
      debug: false, // enables GA4 DebugView
      sendPageView: false, // let this package send page views instead
    },
  },
});
```

| Option                                                                             | Default        | Description                                        |
| ---------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- |
| `measurementId`                                                                    | —              | Required. `G-XXXXXXXXXX`                           |
| `sendPageView`                                                                     | `false`        | Let gtag.js send its own page view on load         |
| `loadScript`                                                                       | `true`         | Inject gtag.js (disable for GTM / `next/script`)   |
| `debug`                                                                            | global `debug` | Sets `debug_mode` for GA4 DebugView                |
| `consentMode`                                                                      | `true`         | Google Consent Mode v2 integration                 |
| `defaultConsent`                                                                   | all denied     | Initial consent signal values                      |
| `consentMapping`                                                                   | see below      | Maps consent categories to Google signals          |
| `dataLayerName`                                                                    | `'dataLayer'`  | Global data layer variable                         |
| `transportUrl`                                                                     | —              | Server-side tagging endpoint                       |
| `cookieDomain` / `cookiePrefix` / `cookieExpires` / `cookieFlags` / `cookieUpdate` | —              | Forwarded to gtag                                  |
| `allowGoogleSignals`                                                               | —              | `allow_google_signals`                             |
| `allowAdPersonalizationSignals`                                                    | —              | `allow_ad_personalization_signals`                 |
| `customMap`                                                                        | —              | GA4 `custom_map` for custom dimensions             |
| `normalizeNames`                                                                   | `false`        | Rewrite names/keys to GA4-safe snake_case          |
| `configParams`                                                                     | —              | Extra parameters merged into `gtag('config', ...)` |
| `additionalMeasurementIds`                                                         | —              | Send to more than one property                     |
| `nonce`                                                                            | —              | CSP nonce for the injected tag                     |

**How calls map to GA4**

| Package call           | GA4                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| `track(name, props)`   | `gtag('event', name, { ...props, send_to })`                           |
| `page(name, props)`    | `gtag('event', 'page_view', { page_path, page_title, page_location })` |
| `identify(id, traits)` | `gtag('set', { user_id })` + `gtag('set', 'user_properties', traits)`  |
| `reset()`              | `gtag('set', { user_id: null })`                                       |
| `setConsent(...)`      | `gtag('consent', 'update', ...)`                                       |

Default consent mapping: `analytics` → `analytics_storage`, `functionality_storage`,
`security_storage`; `marketing` → `ad_storage`, `ad_user_data`, `ad_personalization`;
`personalization` → `personalization_storage`.

GA4 event names must be snake_case, start with a letter and stay under 40 characters. In
debug mode you get a warning when a name or property key would be rejected by Google.

Session timeout is configured in the GA4 admin UI, not through gtag. IP anonymisation is
always on in GA4 and is not a configurable option.

## 9. Segment setup

```ts
await analytics.init({
  providers: {
    segment: { writeKey: 'YOUR_WRITE_KEY' },
  },
});

analytics.identify('user-123', { email: 'user@example.com', plan: 'premium' });
analytics.track('subscription_started', { plan: 'premium', price: 499 });
analytics.page('/dashboard');
analytics.group('company-123', { name: 'Example Company' });
analytics.reset();
```

The provider installs the official analytics.js queueing snippet, so calls made before the
bundle finishes downloading are replayed rather than dropped.

| Option               | Default                   | Description                                           |
| -------------------- | ------------------------- | ----------------------------------------------------- |
| `writeKey`           | —                         | Required unless `instance` is supplied                |
| `instance`           | —                         | An existing `@segment/analytics-next` instance        |
| `loadScript`         | `true`                    | Inject analytics.js                                   |
| `cdnURL`             | `https://cdn.segment.com` | Custom or proxied CDN                                 |
| `globalName`         | `'analytics'`             | Global variable used by the snippet                   |
| `loadOptions`        | —                         | Options passed to `analytics.load()`                  |
| `integrations`       | —                         | Per-call integration toggles                          |
| `syncAnonymousId`    | `false`                   | Push this package's anonymous id into Segment         |
| `sendPageViewOnLoad` | `false`                   | Mimic Segment's snippet, which calls `page()` on load |

Already using the npm SDK? Pass it in and no script is injected:

```ts
import { AnalyticsBrowser } from '@segment/analytics-next';

const segment = AnalyticsBrowser.load({ writeKey: 'YOUR_WRITE_KEY' });
await analytics.init({ providers: { segment: { instance: segment } } });
```

Anonymous users work out of the box: Segment maintains its own `ajs_anonymous_id`, and this
package maintains its own anonymous id, exposed via `analytics.getAnonymousId()`.

## 10. Clarity setup

```ts
await analytics.init({
  providers: {
    clarity: { projectId: 'YOUR_PROJECT_ID' },
  },
});
```

Clarity is a session-analytics product, not an event pipeline, so only part of the generic
API maps onto it. Clarity-specific features are available through a typed provider handle
instead of being forced into the generic interface:

```ts
import { getClarity } from '@analytics-kit/react-analytics/providers/clarity';

const clarity = getClarity(analytics);

clarity?.identifyUser('user-123');
clarity?.setTag('plan', 'premium');
clarity?.event('checkout_started');
clarity?.upgrade('checkout'); // prioritise this session for recording
```

The generic accessor works for any provider:

```ts
analytics.provider('clarity');
analytics.provider<ClarityProvider>('clarity')?.setTag('plan', 'premium');
```

| Option                  | Default | Description                                       |
| ----------------------- | ------- | ------------------------------------------------- |
| `projectId`             | —       | Required                                          |
| `loadScript`            | `true`  | Inject the Clarity tag                            |
| `consentMode`           | `true`  | Forward consent through Clarity's `consentv2` API |
| `trackEvents`           | `true`  | Map `track()` onto `clarity('event', name)`       |
| `eventPropertiesAsTags` | `false` | Also write event properties as custom tags        |
| `identifyUsers`         | `true`  | Map `identify()` onto `clarity('identify', id)`   |
| `traitsAsTags`          | `false` | Write user traits as custom tags                  |
| `pageTags`              | `false` | Write the path as a `page` tag                    |
| `upgradeOnEvents`       | —       | Event names that prioritise the session           |
| `tags`                  | —       | Custom tags applied at initialisation             |

`eventPropertiesAsTags` is off by default because Clarity tags are low-cardinality filters,
not event payloads. `reset()` is a no-op: Clarity clears identity on the next session.

## 11. Event tracking

```ts
analytics.track('product_viewed', { productId: '123', productName: 'Example' });
```

Dispatch can be narrowed per call:

```ts
analytics.track('internal_event', { step: 2 }, { only: ['segment'] });
analytics.track('noisy_event', {}, { except: ['clarity'] });
analytics.track('critical_event', {}, { immediate: true }); // bypass batching
```

Use `trackEvent` when the event name is not known at compile time:

```ts
analytics.trackEvent(`experiment_${variantId}_viewed`, { variantId });
```

## 12. Page tracking

Automatic page tracking is always opt-in.

```ts
analytics.page(); // derives path, url, title, referrer from the browser
analytics.page('/dashboard', { section: 'analytics' });
```

| Approach             | How                                                       |
| -------------------- | --------------------------------------------------------- |
| React, any router    | `usePageTracking()` or `<AnalyticsProvider pageTracking>` |
| React Router         | `usePageTracking({ path: useLocation().pathname })`       |
| Next.js App Router   | `NextAnalyticsProvider` or `useNextPageTracking()`        |
| Next.js Pages Router | `usePagesRouterPageTracking()`                            |
| No React at all      | `autoTrack: { pageViews: true }`                          |

Consecutive page views for the same URL are deduplicated.

## 13. User identification

```ts
analytics.identify('user-123', { name: 'John', plan: 'premium' });

analytics.getIdentity(); // { userId, anonymousId, traits, groupId }
analytics.getAnonymousId();

analytics.reset(); // clears identity and rotates the anonymous id
```

Call `reset()` on logout: it clears the user id, traits and group, rotates the anonymous
id, and forwards the reset to every provider that supports it.

## 14. Group tracking

```ts
analytics.group('company-123', { name: 'Example Company', plan: 'enterprise' });
```

Providers that do not implement `group` (GA4, Clarity) are skipped automatically rather
than receiving a translated approximation.

## 15. Consent management

The consent system is CMP-agnostic. It knows about categories, not vendors.

```ts
await analytics.init({
  providers: { googleAnalytics: { measurementId: 'G-XXXXXXXXXX' } },
  consent: {
    required: true,
    defaults: { analytics: false, marketing: false, personalization: false },
  },
});

analytics.setConsent({ analytics: true, marketing: false, personalization: false });
analytics.getConsent(); // { categories, decided, updatedAt }
analytics.clearConsent();

const unsubscribe = analytics.onConsentChange((consent) => {
  console.log(consent.categories);
});
```

**Gating is on as soon as a `consent` block is present in your config.** Without one, the
package makes no assumption about your legal context and does not gate anything.

While gating is on:

- No provider is initialised and no script is loaded until its categories are granted.
- Calls made before a decision are buffered (`queueUntilDecision`, default `true`) and
  replayed once consent is granted, so nothing is lost while a banner is open.
- Revoking consent stops dispatch to the affected providers immediately.
- The decision is persisted (`localStorage` by default; `sessionStorage`, `cookie` or
  `memory` also supported).

Each provider declares which categories it needs, and you can override that:

```ts
providers: {
  segment: { writeKey: '...', requiredConsent: ['analytics', 'marketing'] },
}
```

Wiring up an external CMP is just an event handler:

```ts
myCmp.on('change', (state) => {
  analytics.setConsent({
    analytics: state.statistics,
    marketing: state.marketing,
    personalization: state.preferences,
  });
});
```

In React:

```tsx
const { consent, setConsent } = useConsent();

if (consent.decided) return null;
return <button onClick={() => setConsent({ analytics: true })}>Accept</button>;
```

## 16. Automatic tracking

Everything is disabled by default and must be switched on explicitly.

```ts
await analytics.init({
  autoTrack: {
    pageViews: true,
    outboundLinks: true,
    clicks: true,
    visibilityChange: false,
  },
});
```

Click tracking is **opt-in per element**, which keeps the listener cheap and prevents
accidental collection of UI noise:

```html
<button data-analytics-event="signup_clicked" data-analytics-location="header">Sign up</button>
```

produces `signup_clicked` with `{ location: 'header' }`.

A single delegated click listener serves both outbound-link and element-click tracking. No
form values, input contents or element text beyond a link label are ever read.

## 17. Performance tracking

```ts
await analytics.init({
  performanceTracking: {
    enabled: true,
    metrics: ['ttfb', 'fcp', 'lcp', 'cls', 'inp', 'navigation'],
    sampleRate: 0.1,
  },
});
```

Emits `performance_metric` events with `metric_name`, `metric_value` and `metric_unit`.
Built directly on `PerformanceObserver` — no extra dependency. Observers are registered
during idle time, so collection never blocks rendering. LCP, CLS and INP are only final
when the page is hidden, so those are reported on `visibilitychange`/`pagehide`.

## 18. Error tracking

Manual reporting is always available:

```ts
analytics.trackError(error, { component: 'Checkout', action: 'payment' });
```

Global capture is opt-in:

```ts
await analytics.init({
  errorTracking: {
    captureErrors: false, // default
    includeStackTrace: false, // default
    maxErrorsPerSession: 10,
  },
});
```

Stack traces stay off by default because they can contain file paths and user input. Only
`error_name` and `error_message` are sent unless you enable them.

## 19. Batching

```ts
await analytics.init({
  batching: {
    enabled: true,
    maxEvents: 10,
    flushInterval: 5000,
    maxQueueSize: 100,
    flushOnUnload: true,
  },
});

await analytics.flush();
```

Calls are queued and flushed asynchronously when the batch fills, the interval elapses, or
the page is hidden (`pagehide` + `visibilitychange`), so queued events are not lost on
navigation.

This batches _dispatch to providers_. GA4 and Segment also batch their own network
transport, so batching mainly helps custom providers that make their own requests.

## 20. Offline support

```ts
await analytics.init({
  offline: { enabled: true, persist: true, maxQueueSize: 50 },
});
```

While `navigator.onLine` is false, calls are parked instead of dispatched, and replayed on
the `online` event. With `persist: true` the queue survives a reload. Disabled by default.

## 21. Custom providers

Any object implementing `AnalyticsProvider` works:

```ts
import type { AnalyticsProvider } from '@analytics-kit/react-analytics';

class MyAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'my-provider';
  readonly requiredConsent = ['analytics'] as const;

  initialize(context) {
    this.endpoint = context.config.endpoint;
  }

  track(eventName, properties) {
    navigator.sendBeacon(this.endpoint, JSON.stringify({ eventName, properties }));
  }

  page(pageName, properties) {}
  identify(userId, traits) {}
}

await analytics.addProvider(new MyAnalyticsProvider());
// or
await analytics.init({ customProviders: [new MyAnalyticsProvider()] });
```

Required: `name`, `initialize`, `track`, `page`, `identify`.
Optional: `group`, `reset`, `setConsent`, `flush`, `destroy`, `requiredConsent`.

`BaseProvider` removes the boilerplate of storing config, logger and ready state:

```ts
import { BaseProvider } from '@analytics-kit/react-analytics';

class MyProvider extends BaseProvider<{ endpoint: string }> {
  readonly name = 'my-provider';

  protected async onInitialize() {
    await fetch(`${this.config.endpoint}/session`, { method: 'POST' });
  }

  track(eventName: string, properties?: Record<string, unknown>) {
    if (!this.isReady()) return;
    navigator.sendBeacon(this.config.endpoint, JSON.stringify({ eventName, properties }));
  }

  page() {}
  identify() {}
}
```

Your provider gets the same treatment as the built-ins: consent gating, sanitised
properties, batching, retries and failure isolation.

## 22. Plugins

Plugins observe, enrich or veto calls before they reach any provider.

```ts
const loggingPlugin = {
  name: 'logger',
  track(eventName, properties) {
    console.log(eventName, properties);
  },
};

analytics.use(loggingPlugin);
analytics.removePlugin('logger');
```

Lifecycle: `initialize`, `beforeSend`, `track`, `page`, `identify`, `group`, `reset`,
`destroy` — all optional.

```ts
const enrichPlugin = {
  name: 'enrich',
  beforeSend: (payload) => ({
    ...payload,
    properties: { ...payload.properties, tenant: getTenantId() },
  }),
};

const samplingPlugin = {
  name: 'sampling',
  beforeSend: (payload) => (Math.random() < 0.1 ? payload : false), // false drops the call
};
```

A ready-made logging plugin ships with the package:

```ts
import { createLoggingPlugin } from '@analytics-kit/react-analytics';
analytics.use(createLoggingPlugin());
```

Unlike providers, plugins also run during server rendering, which makes them useful for
server-side logging.

## 23. TypeScript

Declare your events once and the whole API becomes type-checked:

```ts
type AppEvents = {
  button_clicked: { buttonName: string; location: string };
  product_viewed: { productId: string; productName: string };
  checkout_started: { cartValue: number };
};

const analytics = createAnalytics<AppEvents>();

analytics.track('button_clicked', { buttonName: 'Signup', location: 'header' });

analytics.track('button_clicked', { buttonName: 'Signup' }); // Error: missing 'location'
analytics.track('typo_event', {}); // Error: unknown event name
analytics.track('checkout_started', { cartValue: 'free' }); // Error: wrong type
```

`trackEvent()` is the escape hatch for dynamic names. Without a generic argument, the API
accepts any string, so adopting types later is not a breaking change.

In React, pass the map to the hook:

```ts
const analytics = useAnalytics<AppEvents>();
```

Exported types include `Analytics`, `AnalyticsProvider`, `AnalyticsConfig`,
`AnalyticsEvent`, `AnalyticsEventProperties`, `ConsentConfig`, `ConsentState`,
`ProviderConfig`, `Plugin`, `AnalyticsOptions`, plus every provider config type.

The source compiles under `strict`, `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`-friendly settings, and avoids `any` in the public surface.

## 24. Privacy

```ts
await analytics.init({
  privacy: {
    optOut: false,
    respectDoNotTrack: true,
    anonymousId: true,
    sanitizeProperties: true,
    redactKeys: ['internalUserRef'],
    maxPropertyDepth: 5,
    maxProperties: 100,
  },
  storage: { type: 'localStorage', keyPrefix: 'myapp_analytics' },
});

analytics.optOut();
analytics.optIn();
analytics.isOptedOut();
analytics.setEnabled(false);
```

**Nothing is collected automatically.** No page views, no clicks, no form data, no errors
unless you switch them on.

Every event payload is scanned before dispatch and known-sensitive keys are replaced with
`[REDACTED]`: passwords, tokens, API keys, authorization headers, card numbers, CVV, IBAN,
SSN, PIN, OTP, private keys and session ids, matched case-insensitively at any depth. Add
your own with `redactKeys`.

Storage is configurable (`localStorage`, `sessionStorage`, `cookie`, `memory`, `none`) and
degrades to memory when the browser blocks it, so Safari private mode never throws.

## 25. Security

| Credential                          | Where it belongs          |
| ----------------------------------- | ------------------------- |
| GA4 Measurement ID (`G-…`)          | Client — public by design |
| Segment **write key**               | Client — public by design |
| Clarity Project ID                  | Client — public by design |
| GA4 Measurement Protocol API secret | **Server only**           |
| Segment Public API / access tokens  | **Server only**           |
| Clarity Data Export API token       | **Server only**           |

The first three are visible in any browser's network tab by design; they identify a
destination, not an authenticated caller. The last three grant API access and must never
reach a client bundle or a `NEXT_PUBLIC_*` / `VITE_*` variable.

This package never reads environment variables itself — configuration is always supplied by
your application, so you stay in control of what is exposed.

Both inline-script helpers in the Next.js layer validate ids against `^[A-Za-z0-9_-]+$`
before interpolation, so a malformed id cannot inject script content.

## 26. Troubleshooting

**Nothing is being tracked.**
Enable `debug: true` and read the console. The most common causes are a consent decision
that was never made, `disableInTest`/`disableInDevelopment` matching your environment, or
an ad blocker blocking the vendor script.

**Events stop at "waiting for consent".**
You passed a `consent` block, which turns gating on. Call
`analytics.setConsent({ analytics: true })`, or remove the block if you do not need gating.

**"providers config was supplied but this instance has no provider resolver".**
You imported `createAnalytics` from `/core`, which is provider-agnostic. Import it from the
package root, or register providers via `customProviders`/`addProvider`.

**Nothing happens in tests.**
`disableInTest` defaults to `true`, so providers are disabled when
`environment === 'test'`. Set `disableInTest: false` or use a mock provider.

**Duplicate page views.**
Something is tracking twice — usually `sendPageView: true` in GA4 plus this package's page
tracking, or both `autoTrack.pageViews` and `usePageTracking()`.

**`useAnalytics() was called outside of <AnalyticsProvider>`.**
The component is not under the provider. In tests, wrap the component, or use
`useOptionalAnalytics()` where a missing provider is expected.

**Data appears in GA4 DebugView but not in reports.**
GA4 processing is delayed by up to 24 hours; also check the event name is snake_case, under
40 characters, and not one of GA4's reserved names. The package warns about all three in
debug mode.

**Checking what is registered:**

```ts
analytics.getProviderStatus();
// [{ name: 'google-analytics', enabled: true, initialized: true, consentGranted: true, ... }]
```

## 27. API reference

### `createAnalytics<TEvents>(options?): Analytics<TEvents>`

| Option            | Type               | Description                                  |
| ----------------- | ------------------ | -------------------------------------------- |
| `name`            | `string`           | Instance name used in logs                   |
| `resolveProvider` | `ProviderResolver` | Custom mapping from config keys to providers |

Also available: `getAnalytics()` (lazy singleton), `setAnalytics()`, `resetAnalytics()`.

### Instance methods

| Method                                                         | Description                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `init(config?)`                                                | Initialise the client and providers. Idempotent. Returns a promise |
| `ready()`                                                      | Resolves when initialisation has finished                          |
| `isInitialized()`                                              | Whether `init()` has completed                                     |
| `track(name, props?, options?)`                                | Track a typed event                                                |
| `trackEvent(name, props?, options?)`                           | Track a dynamically named event                                    |
| `page(name?, props?, options?)`                                | Track a page view                                                  |
| `identify(userId, traits?, options?)`                          | Associate the session with a user                                  |
| `group(groupId, traits?, options?)`                            | Associate the user with an account                                 |
| `reset()`                                                      | Clear identity and rotate the anonymous id                         |
| `trackError(error, context?)`                                  | Report a caught error                                              |
| `flush()`                                                      | Flush queued calls; returns a promise                              |
| `setConsent(state)` / `getConsent()` / `clearConsent()`        | Consent control                                                    |
| `onConsentChange(listener)`                                    | Subscribe to consent changes; returns unsubscribe                  |
| `optOut()` / `optIn()` / `isOptedOut()`                        | Opt-out control                                                    |
| `setEnabled(bool)` / `isEnabled()`                             | Master switch                                                      |
| `addProvider(provider, config?)` / `removeProvider(name)`      | Runtime provider management                                        |
| `provider<T>(name)` / `getProviders()` / `getProviderStatus()` | Provider access                                                    |
| `setProviderEnabled(name, bool)`                               | Toggle one provider                                                |
| `use(plugin)` / `removePlugin(name)`                           | Plugin management                                                  |
| `getIdentity()` / `getAnonymousId()`                           | Identity access                                                    |
| `getConfig()` / `setDebug(bool)`                               | Configuration access                                               |
| `destroy()`                                                    | Tear down listeners, timers and providers                          |

### `AnalyticsConfig`

| Key                    | Default        | Description                                        |
| ---------------------- | -------------- | -------------------------------------------------- |
| `providers`            | `{}`           | Built-in provider configuration                    |
| `customProviders`      | `[]`           | Provider instances to register                     |
| `plugins`              | `[]`           | Plugins to register                                |
| `enabled`              | `true`         | Master switch                                      |
| `debug`                | `false`        | Verbose `[Analytics]` logging                      |
| `logLevel`             | derived        | `silent` \| `error` \| `warn` \| `info` \| `debug` |
| `logger`               | `console`      | Custom logger implementation                       |
| `environment`          | `'production'` | Usually `process.env.NODE_ENV`                     |
| `disableInDevelopment` | `false`        | Disable providers in development                   |
| `disableInTest`        | `true`         | Disable providers in tests                         |
| `consent`              | off            | Consent gating (on when present)                   |
| `privacy`              | see §24        | Privacy controls                                   |
| `storage`              | `localStorage` | Storage backend and key prefix                     |
| `batching`             | off            | Event batching                                     |
| `retry`                | off            | Retry policy                                       |
| `offline`              | off            | Offline queueing                                   |
| `autoTrack`            | all off        | Automatic tracking                                 |
| `performanceTracking`  | off            | Web Vitals                                         |
| `errorTracking`        | off            | Global error capture                               |
| `defaultProperties`    | —              | Object or factory merged into every event          |
| `onError`              | —              | Called when a provider or plugin fails             |

### Entry points

| Import                                                      | Contents                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@analytics-kit/react-analytics`                            | `createAnalytics` with built-in provider resolution, core API, types                            |
| `@analytics-kit/react-analytics/core`                       | Provider-agnostic core                                                                          |
| `@analytics-kit/react-analytics/react`                      | `AnalyticsProvider`, `useAnalytics`, `usePageTracking`, `useConsent`, `AnalyticsBoundary`       |
| `@analytics-kit/react-analytics/next`                       | `NextAnalyticsProvider`, `useNextPageTracking`, `usePagesRouterPageTracking`, `AnalyticsScript` |
| `@analytics-kit/react-analytics/providers/google-analytics` | `GoogleAnalyticsProvider`                                                                       |
| `@analytics-kit/react-analytics/providers/segment`          | `SegmentProvider`                                                                               |
| `@analytics-kit/react-analytics/providers/clarity`          | `ClarityProvider`, `getClarity`                                                                 |

### Bundle size

Minified + gzipped, peer dependencies external:

| Entry                         | min+gzip |
| ----------------------------- | -------- |
| `.` (core + resolver)         | ~11.2 kB |
| `/react`                      | ~1.5 kB  |
| `/next`                       | ~2.9 kB  |
| `/providers/google-analytics` | ~2.3 kB  |
| `/providers/segment`          | ~1.9 kB  |
| `/providers/clarity`          | ~1.8 kB  |

Providers are loaded through dynamic `import()`, so configuring GA4 alone never downloads
the Segment or Clarity code. These figures measure the full barrel export; an app that
imports only `createAnalytics` tree-shakes further. Run `npm run size` to reproduce.

## 28. Contributing

```bash
npm install
npm run dev          # watch build
npm test             # run the suite
npm run test:watch
npm run lint
npm run typecheck
npm run format
npm run build
npm run size
npm run verify       # typecheck + lint + test + build + size
```

Tests never contact a real analytics service: `window`, `document`, `localStorage`, gtag,
Segment and Clarity are all mocked, and SSR safety is verified in a DOM-free environment.

Please keep provider-specific code inside its provider directory, keep the core free of
vendor logic, and add tests with any new behaviour. See [`docs/`](./docs) for architecture
notes and a guide to writing custom providers.

## 29. License

MIT — see [LICENSE](./LICENSE).
