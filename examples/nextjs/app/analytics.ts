import { createAnalytics, type AnalyticsConfig } from 'analytics-bridge';

export type AppEvents = {
  button_clicked: { buttonName: string; location: string };
  product_viewed: { productId: string; productName: string; price: number };
  checkout_started: { cartValue: number; itemCount: number };
};

/**
 * Created at module scope so the instance survives re-renders and is shared by
 * every client component. This module is imported only from client components.
 *
 * Creating an instance is inert: nothing touches `window` until `init()` runs
 * inside an effect, so importing this on the server is safe.
 */
export const analytics = createAnalytics<AppEvents>();

/**
 * Only `NEXT_PUBLIC_*` variables may appear here — everything in this file ends
 * up in the browser bundle. A GA4 Measurement Protocol api_secret, a Segment
 * access token or a Clarity export token must stay in server-only env vars.
 */
export const analyticsConfig: AnalyticsConfig = {
  providers: {
    googleAnalytics: {
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-XXXXXXXXXX',
      // The package sends page views itself on route change; letting gtag do it
      // too would double-count.
      sendPageView: false,
    },
    segment: {
      writeKey: process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY ?? 'YOUR_SEGMENT_WRITE_KEY',
    },
    clarity: {
      projectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? 'YOUR_CLARITY_PROJECT_ID',
    },
  },

  environment: process.env.NODE_ENV,
  debug: process.env.NODE_ENV === 'development',
  disableInDevelopment: false,

  consent: {
    defaults: { analytics: false, marketing: false, personalization: false },
  },
};
