import Script from 'next/script';
import type { ReactNode } from 'react';

type ScriptStrategy = 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';

export interface AnalyticsScriptProps {
  /** GA4 measurement id, e.g. `G-XXXXXXXXXX`. */
  googleAnalyticsId?: string;
  /** Microsoft Clarity project id. */
  clarityProjectId?: string;
  /** Segment write key. */
  segmentWriteKey?: string;
  /** Next.js loading strategy. @default 'afterInteractive' */
  strategy?: ScriptStrategy;
  /** CSP nonce. */
  nonce?: string;
  /** Let gtag send its own page views. Keep `false` for App Router apps. @default false */
  gaSendPageView?: boolean;
}

/** Ids are interpolated into inline scripts, so only known-safe shapes are allowed. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function assertSafeId(value: string, label: string): boolean {
  if (SAFE_ID.test(value)) return true;
  // Rendering an unvalidated id into an inline script would be an injection
  // vector; skipping is safer than escaping heuristics.
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`[Analytics] ${label} "${value}" contains unsupported characters`);
  }
  return false;
}

/**
 * Loads vendor tags through `next/script` instead of runtime injection.
 *
 * Useful when you want Next.js to control script priority, or when a strict CSP
 * requires nonces on every tag. Pair it with `loadScript: false` in the matching
 * provider config so the tag is not injected twice.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * <AnalyticsScript googleAnalyticsId={process.env.NEXT_PUBLIC_GA_ID} />
 * ```
 */
export function AnalyticsScript({
  googleAnalyticsId,
  clarityProjectId,
  segmentWriteKey,
  strategy = 'afterInteractive',
  nonce,
  gaSendPageView = false,
}: AnalyticsScriptProps): ReactNode {
  const gaId =
    googleAnalyticsId && assertSafeId(googleAnalyticsId, 'measurementId')
      ? googleAnalyticsId
      : undefined;
  const clarityId =
    clarityProjectId && assertSafeId(clarityProjectId, 'projectId') ? clarityProjectId : undefined;
  const segmentKey =
    segmentWriteKey && assertSafeId(segmentWriteKey, 'writeKey') ? segmentWriteKey : undefined;

  return (
    <>
      {gaId ? (
        <>
          <Script
            id="analytics-kit-gtag"
            strategy={strategy}
            nonce={nonce}
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          />
          <Script id="analytics-kit-gtag-init" strategy={strategy} nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(
              gaId
            )},{send_page_view:${gaSendPageView}});`}
          </Script>
        </>
      ) : null}

      {clarityId ? (
        <Script id="analytics-kit-clarity" strategy={strategy} nonce={nonce}>
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(
            clarityId
          )});`}
        </Script>
      ) : null}

      {segmentKey ? (
        // The full snippet is required: it installs the queueing stub and sets
        // `_writeKey`, which the analytics.js bundle reads on boot.
        <Script id="analytics-kit-segment" strategy={strategy} nonce={nonce}>
          {`!function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var t=analytics.methods[e];analytics[t]=analytics.factory(t)}analytics.load=function(e,t){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.segment.com/analytics.js/v1/"+e+"/analytics.min.js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a);analytics._loadOptions=t};analytics.SNIPPET_VERSION="4.15.3";analytics.load(${JSON.stringify(
            segmentKey
          )})}}();`}
        </Script>
      ) : null}
    </>
  );
}
