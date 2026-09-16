/** Package-wide constants. Kept in one place so defaults are easy to audit. */

export const PACKAGE_NAME = 'analytics-bridge';

export const LOG_PREFIX = '[Analytics]';

/** Default storage key prefix for everything this package persists. */
export const STORAGE_KEY_PREFIX = 'ak_analytics';

export const ANONYMOUS_ID_KEY = 'anonymous_id';
export const CONSENT_STORAGE_KEY = `${STORAGE_KEY_PREFIX}_consent`;
export const OFFLINE_QUEUE_KEY = `${STORAGE_KEY_PREFIX}_offline_queue`;
export const OPT_OUT_KEY = 'opt_out';

/** Consent categories a provider requires when it does not declare its own. */
export const DEFAULT_REQUIRED_CONSENT = ['analytics'] as const;

/** Built-in event names emitted by the optional automatic tracking features. */
export const AUTO_EVENTS = {
  PAGE_VIEW: 'page_view',
  OUTBOUND_LINK: 'outbound_link_clicked',
  VISIBILITY_CHANGE: 'visibility_changed',
  ERROR: 'error_occurred',
  PERFORMANCE: 'performance_metric',
} as const;

/**
 * Property keys that are redacted before events leave the client.
 * Matching is case-insensitive and substring based.
 */
export const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'authorization',
  'auth',
  'credential',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'iban',
  'ssn',
  'socialsecurity',
  'taxid',
  'pin',
  'otp',
  'privatekey',
  'private_key',
  'sessionid',
  'session_id',
] as const;

export const REDACTED_VALUE = '[REDACTED]';

/** Ceiling on how much data a single property object may carry. */
export const DEFAULT_MAX_PROPERTY_DEPTH = 5;
export const DEFAULT_MAX_PROPERTIES = 100;

export const DEFAULT_BATCH_MAX_EVENTS = 10;
export const DEFAULT_BATCH_FLUSH_INTERVAL = 5000;
export const DEFAULT_BATCH_MAX_QUEUE_SIZE = 100;

export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_INITIAL_DELAY = 500;
export const DEFAULT_RETRY_MAX_DELAY = 10_000;

export const DEFAULT_OFFLINE_MAX_QUEUE_SIZE = 50;

export const DEFAULT_MAX_CONSENT_QUEUE = 50;

export const DEFAULT_MAX_ERRORS_PER_SESSION = 10;

/** Default selector for opt-in click tracking. */
export const DEFAULT_CLICK_SELECTOR = '[data-analytics-event]';
export const DEFAULT_CLICK_EVENT_ATTRIBUTE = 'data-analytics-event';
export const DEFAULT_CLICK_PROPERTY_PREFIX = 'data-analytics-';

/** GA4 rejects event names longer than this. */
export const GA4_MAX_EVENT_NAME_LENGTH = 40;
export const MAX_EVENT_NAME_LENGTH = 200;
