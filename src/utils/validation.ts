import { GA4_MAX_EVENT_NAME_LENGTH, MAX_EVENT_NAME_LENGTH } from '../core/constants';

export interface ValidationResult {
  valid: boolean;
  /** Non-fatal issues worth surfacing in debug mode. */
  warnings: string[];
  error?: string;
}

/**
 * GA4 reserves these names; sending them is silently dropped by Google, so we
 * surface a warning instead of letting the data disappear.
 */
const GA4_RESERVED_EVENT_NAMES = new Set([
  'ad_activeview',
  'ad_click',
  'ad_exposure',
  'ad_query',
  'ad_reward',
  'adunit_exposure',
  'app_clear_data',
  'app_exception',
  'app_install',
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'error',
  'first_open',
  'first_visit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'session_start',
  'user_engagement',
]);

export function validateEventName(name: unknown): ValidationResult {
  const warnings: string[] = [];

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, warnings, error: 'Event name must be a non-empty string.' };
  }
  if (name.length > MAX_EVENT_NAME_LENGTH) {
    return {
      valid: false,
      warnings,
      error: `Event name exceeds ${MAX_EVENT_NAME_LENGTH} characters.`,
    };
  }
  if (name.length > GA4_MAX_EVENT_NAME_LENGTH) {
    warnings.push(
      `Event name "${name}" is longer than ${GA4_MAX_EVENT_NAME_LENGTH} characters and will be rejected by GA4.`
    );
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    warnings.push(
      `Event name "${name}" is not alphanumeric snake_case; GA4 only accepts letters, digits and underscores starting with a letter.`
    );
  }
  if (GA4_RESERVED_EVENT_NAMES.has(name)) {
    warnings.push(`Event name "${name}" is reserved by GA4 and will be ignored by that provider.`);
  }

  return { valid: true, warnings };
}

export function validateUserId(userId: unknown): ValidationResult {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return { valid: false, warnings: [], error: 'User id must be a non-empty string.' };
  }
  return { valid: true, warnings: [] };
}

export function validateGroupId(groupId: unknown): ValidationResult {
  if (typeof groupId !== 'string' || groupId.trim().length === 0) {
    return { valid: false, warnings: [], error: 'Group id must be a non-empty string.' };
  }
  return { valid: true, warnings: [] };
}

/** GA4 measurement ids look like `G-XXXXXXXXXX`. */
export function isValidMeasurementId(id: unknown): id is string {
  return typeof id === 'string' && /^(G|GT|AW|DC)-[A-Za-z0-9_-]+$/.test(id);
}

/** Segment write keys are opaque strings; we only check they are usable. */
export function isValidWriteKey(key: unknown): key is string {
  return typeof key === 'string' && key.trim().length > 0;
}

/** Clarity project ids are short lowercase alphanumeric strings. */
export function isValidClarityProjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]+$/i.test(id.trim()) && id.trim().length > 0;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
