import { createAnalytics, type AnalyticsConfig } from 'analytics-bridge';

/**
 * Application event map.
 *
 * Declaring events here makes `analytics.track()` reject unknown names and
 * mismatched payloads at compile time.
 */
export type AppEvents = {
  button_clicked: { buttonName: string; location: string };
  product_viewed: { productId: string; productName: string; price: number };
  checkout_started: { cartValue: number; itemCount: number };
  subscription_started: { plan: string; price: number };
};

/** One instance for the whole application, created outside the React tree. */
export const analytics = createAnalytics<AppEvents>();

/**
 * Credentials are read from Vite env vars and are placeholders in this example.
 *
 * All three are public client-side identifiers. Never put a Measurement
 * Protocol API secret, a Segment access token or a Clarity export token here.
 */
export const analyticsConfig: AnalyticsConfig = {
  providers: {
    googleAnalytics: {
      measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-XXXXXXXXXX',
      sendPageView: false,
    },
    segment: {
      writeKey: import.meta.env.VITE_SEGMENT_WRITE_KEY ?? 'YOUR_SEGMENT_WRITE_KEY',
    },
    clarity: {
      projectId: import.meta.env.VITE_CLARITY_PROJECT_ID ?? 'YOUR_CLARITY_PROJECT_ID',
    },
  },

  environment: import.meta.env.MODE,
  debug: import.meta.env.DEV,
  disableInDevelopment: false,

  // The presence of this block turns consent gating on: nothing is sent until
  // the banner is answered, and calls made in the meantime are replayed.
  consent: {
    defaults: { analytics: false, marketing: false, personalization: false },
  },

  defaultProperties: () => ({ app_version: '1.0.0' }),
};
