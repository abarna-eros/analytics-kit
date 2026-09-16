# React example (Vite + React Router)

Demonstrates initialisation, consent-gated loading, React Router page tracking, event
tracking, identify/group/reset, provider-specific APIs and per-call provider targeting.

## Run it

```bash
# from the repository root, build the package first
npm install
npm run build

cd examples/react
npm install
cp .env.example .env.local   # optional; placeholders work without real IDs
npm run dev
```

With placeholder IDs the vendor scripts will fail to load. That is the point: the app keeps
working, and `analytics.getProviderStatus()` on the Account page shows which providers
failed.

## What to look at

| File                        | Shows                                                                     |
| --------------------------- | ------------------------------------------------------------------------- |
| `src/analytics.ts`          | Typed event map, one instance, consent defaults, env-driven config        |
| `src/App.tsx`               | `AnalyticsProvider`, `AnalyticsBoundary`, router-driven `usePageTracking` |
| `src/ConsentBanner.tsx`     | `useConsent`, buffering until a decision is made                          |
| `src/pages/HomePage.tsx`    | Typed `track`, dynamic `trackEvent`, `trackError`                         |
| `src/pages/ProductPage.tsx` | Clarity-specific API, `only: ['segment']` targeting                       |
| `src/pages/AccountPage.tsx` | `identify`, `group`, `reset`, opt-out, provider status                    |

## Things worth trying

Open DevTools with `debug: true` (on by default in dev) and watch the `[Analytics]` output.
Reject consent and confirm no vendor request is made; then accept and watch the buffered
page view replay.

`main.tsx` wraps the app in `StrictMode`, so effects run twice in development. Providers are
still initialised once — `init()` is idempotent.
