# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

| Bump | When |
| --- | --- |
| **MAJOR** | Breaking change to the public API: removed or renamed exports, changed method signatures, changed defaults that alter what is collected, or a raised peer dependency floor. |
| **MINOR** | Backwards-compatible additions: new providers, new configuration options, new hooks, new optional provider capabilities. |
| **PATCH** | Backwards-compatible fixes: bug fixes, provider mapping corrections, documentation, internal refactors and performance work. |

Pre-1.0 (`0.x`) releases may adjust the API in a **minor** bump while the design settles.
From 1.0.0 onward the public API is stable and follows the table above. Anything not
exported from a documented entry point is internal and may change in any release.

## [Unreleased]

## [0.2.1] - 2026-09-17

### Changed

- Package **homepage** now points to the documentation site:
  [https://abarna-eros.github.io/analytics-kit/](https://abarna-eros.github.io/analytics-kit/).
  The GitHub README remains the technical source of truth.

## [0.2.0] - 2026-09-17

### Added

- **Developer logging API** — `analytics.log.debug/info/warn/error`, `analytics.log.event`,
  `analytics.log.view` and `analytics.log.identify`. These write through the configured
  logger and never send data to providers.
- **`LoggerOptions`** — `enabled`, `level`, `prefix`, `timestamps`, `showPayloads`,
  `redactKeys`, `redact`, and a nested custom `logger` sink. `AnalyticsConfig.logger`
  still accepts a bare `Logger` instance.
- **`getIntegrationStatus()`** — per-integration availability, skip reasons
  (`consent`, `disabled`, `unavailable`, …) and last delivery result
  (`success` / `skipped` / `unavailable` / `failed`).
- **`getDebugReport()`** — redacted, circular-safe snapshot of logger config, identity,
  consent, integrations and recent log lines. Safe on the server.
- Automatic action logs for init, track, page, identify, group, reset, consent and
  per-provider delivery. Logging failures never abort tracking.

## [0.1.0] - 2026-09-16

Initial release.

### Added

- **Core engine** — provider-independent client (`createAnalytics`, `AnalyticsClient`) with
  `track`, `page`, `identify`, `group`, `reset`, `trackError` and `flush`.
- **Provider abstraction** — a single `AnalyticsProvider` interface plus an optional
  `BaseProvider` helper. The core contains no vendor-specific code.
- **Google Analytics 4 provider** — official gtag.js integration with Consent Mode v2,
  DebugView support, cookie configuration, custom dimensions and multi-property support.
- **Twilio Segment provider** — official analytics.js snippet with call queueing, custom
  CDN support, integration toggles, and support for an existing `@segment/analytics-next`
  instance.
- **Microsoft Clarity provider** — official tag integration with custom tags, custom
  events, session upgrade, `consentv2` support and a typed provider-specific API
  (`getClarity`).
- **Consent management** — category-based, CMP-agnostic gating with persistence, buffering
  until a decision, per-provider requirements and change subscriptions.
- **Privacy controls** — automatic redaction of sensitive property keys, opt-out, Do Not
  Track support, configurable anonymous id and storage backend.
- **React integration** — `AnalyticsProvider`, `useAnalytics`, `useOptionalAnalytics`,
  `usePageTracking`, `useConsent` and `AnalyticsBoundary`. SSR-safe and StrictMode-safe.
- **Next.js integration** — `NextAnalyticsProvider`, `useNextPageTracking`,
  `usePagesRouterPageTracking` and `AnalyticsScript`, as an optional peer dependency.
- **Optional automatic tracking** — page views, outbound links, opted-in element clicks and
  visibility changes, all disabled by default.
- **Performance tracking** — TTFB, FCP, LCP, CLS, INP and navigation timing via
  `PerformanceObserver`, with sampling.
- **Error tracking** — manual `trackError` plus optional global capture, with stack traces
  opt-in.
- **Batching, retry and offline queueing** — all optional, with flush-on-unload, bounded
  exponential backoff and no retrying of configuration errors.
- **Plugin system** — lifecycle hooks plus a `beforeSend` hook that can enrich or veto
  calls, with a bundled logging plugin.
- **Typed events** — optional application event map giving compile-time checked event names
  and payloads, with `trackEvent` as an escape hatch.
- **Packaging** — ESM and CommonJS builds, `.d.ts`/`.d.cts` declarations, source maps,
  subpath exports, `sideEffects: false`, lazily loaded provider chunks and zero runtime
  dependencies.

[unreleased]: https://github.com/abarna-eros/analytics-kit/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/abarna-eros/analytics-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/abarna-eros/analytics-kit/releases/tag/v0.2.0
[0.1.0]: https://github.com/abarna-eros/analytics-kit/releases/tag/v0.1.0
