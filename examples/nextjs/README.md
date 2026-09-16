# Next.js example (App Router)

Demonstrates the App Router integration: a thin client boundary for analytics, automatic
route tracking, consent gating, Server Components that ship no analytics code, and the
server/client credential split.

## Run it

```bash
# from the repository root, build the package first
npm install
npm run build

cd examples/nextjs
npm install
cp .env.example .env.local   # optional; placeholders work without real IDs
npm run dev
```

## What to look at

| File                    | Shows                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `app/analytics.ts`      | Typed event map, module-scope instance, `NEXT_PUBLIC_*` config  |
| `app/providers.tsx`     | The `'use client'` boundary and `NextAnalyticsProvider`         |
| `app/layout.tsx`        | Server Component root layout wrapping children in the boundary  |
| `app/page.tsx`          | Server Component that delegates interactivity to a client child |
| `app/product/[id]/`     | Server-fetched data, client-side view tracking, Clarity API     |
| `app/account/page.tsx`  | `identify`, `group`, `reset`, opt-out, provider status          |
| `app/ConsentBanner.tsx` | `useConsent` with nothing loaded before a decision              |

## Server Components stay server-rendered

Wrapping `children` in a client component does not turn them into client components — they
are rendered on the server and passed through as an already-rendered tree. Only
`providers.tsx`, `ConsentBanner.tsx`, `TrackingButtons.tsx`, `ProductTracking.tsx` and
`account/page.tsx` ship to the browser.

`NextAnalyticsProvider` wraps its route tracker in `<Suspense>` internally because
`useSearchParams()` would otherwise opt every route into client-side rendering.

## Loading vendor scripts with `next/script` instead

By default the providers inject their own script tags. If you prefer Next.js to control
loading (for a CSP nonce or `beforeInteractive` priority), render `AnalyticsScript` in the
layout and tell the provider not to load the script:

```tsx
import { AnalyticsScript } from 'analytics-bridge/next';

<AnalyticsScript googleAnalytics={{ measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID! }} />;
```

```ts
providers: {
  googleAnalytics: { measurementId: '...', loadScript: false },
}
```

## Credentials

`NEXT_PUBLIC_*` values are inlined into the browser bundle. The GA4 Measurement ID, Segment
write key and Clarity project ID are public identifiers and belong there. A Measurement
Protocol `api_secret`, a Segment access token or a Clarity export token must never be
prefixed with `NEXT_PUBLIC_` and must never be imported from a client component — see
`.env.example`.
