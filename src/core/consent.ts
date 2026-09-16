import { DEFAULT_REQUIRED_CONSENT } from './constants';
import type {
  ConsentCategory,
  ConsentSnapshot,
  ConsentState,
  Logger,
  ResolvedAnalyticsConfig,
} from './types';
import { createStorage, readJson, writeJson, type KeyValueStorage } from '../utils/storage';

interface PersistedConsent {
  categories: ConsentState;
  decided: boolean;
  updatedAt: number;
}

/**
 * Provider-independent consent gate.
 *
 * The manager knows nothing about any specific CMP: an integration simply calls
 * {@link ConsentManager.set} whenever the CMP reports a change, and providers
 * are gated on the categories they declare.
 */
export class ConsentManager {
  private categories: ConsentState;
  private decided = false;
  private updatedAt?: number;
  private readonly listeners = new Set<(snapshot: ConsentSnapshot) => void>();
  private readonly storage: KeyValueStorage;
  private readonly storageKey: string;
  private readonly required: boolean;
  private readonly logger?: Logger;

  constructor(config: ResolvedAnalyticsConfig['consent'], logger?: Logger) {
    this.required = config.required;
    this.storageKey = config.storageKey;
    this.logger = logger;
    this.storage = createStorage({
      type: config.storage,
      cookie: config.cookie,
    });

    this.categories = { ...config.defaults };

    const persisted = readJson<PersistedConsent>(this.storage, this.storageKey);
    if (persisted && typeof persisted === 'object' && persisted.categories) {
      this.categories = { ...this.categories, ...persisted.categories };
      this.decided = Boolean(persisted.decided);
      this.updatedAt = persisted.updatedAt;
      this.logger?.debug('Restored persisted consent', persisted.categories);
    }
  }

  /** `true` when consent gating is switched off entirely. */
  isRequired(): boolean {
    return this.required;
  }

  snapshot(): ConsentSnapshot {
    return {
      categories: { ...this.categories },
      decided: this.decided || !this.required,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * `true` when calls may flow: either a decision was recorded, or consent
   * gating is switched off entirely.
   */
  hasDecision(): boolean {
    return !this.required || this.decided;
  }

  /**
   * `true` only when {@link ConsentManager.set} was actually called.
   *
   * Distinct from {@link ConsentManager.hasDecision}: a manager with gating
   * disabled lets everything through but has no real decision to carry over.
   */
  hasExplicitDecision(): boolean {
    return this.decided;
  }

  /** Whether a single category is granted. Unknown categories are denied. */
  isGranted(category: ConsentCategory): boolean {
    if (!this.required) return true;
    return this.categories[category] === true;
  }

  /**
   * Whether every category a provider requires is granted.
   * Providers without a declaration fall back to `['analytics']`.
   */
  isAllowed(requiredCategories: readonly ConsentCategory[] = DEFAULT_REQUIRED_CONSENT): boolean {
    if (!this.required) return true;
    if (requiredCategories.length === 0) return true;
    return requiredCategories.every((category) => this.isGranted(category));
  }

  set(update: ConsentState): ConsentSnapshot {
    const next: ConsentState = { ...this.categories };
    for (const [category, granted] of Object.entries(update)) {
      if (typeof granted === 'boolean') next[category] = granted;
    }

    this.categories = next;
    this.decided = true;
    this.updatedAt = Date.now();
    this.persist();
    this.logger?.debug('Consent updated', next);
    this.emit();
    return this.snapshot();
  }

  /** Clears the decision and forgets anything persisted. */
  clear(): ConsentSnapshot {
    this.categories = {};
    this.decided = false;
    this.updatedAt = undefined;
    this.storage.remove(this.storageKey);
    this.logger?.debug('Consent cleared');
    this.emit();
    return this.snapshot();
  }

  subscribe(listener: (snapshot: ConsentSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.listeners.clear();
  }

  private persist(): void {
    const payload: PersistedConsent = {
      categories: this.categories,
      decided: this.decided,
      updatedAt: this.updatedAt ?? Date.now(),
    };
    writeJson(this.storage, this.storageKey, payload);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        this.logger?.error('Consent listener threw', error);
      }
    }
  }
}
