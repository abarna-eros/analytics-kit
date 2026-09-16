import type { DispatchContext, DispatchOptions, Logger, ResolvedAnalyticsConfig } from './types';
import { getDocument, getWindow, isOnline } from '../utils/browser';
import { generateShortId } from '../utils/id';
import { createStorage, readJson, writeJson, type KeyValueStorage } from '../utils/storage';

export type OperationType = 'track' | 'page' | 'identify' | 'group' | 'reset';

/** A single buffered analytics call. */
export interface QueuedCall {
  id: string;
  type: OperationType;
  /** Event name / page name / user id / group id depending on `type`. */
  name?: string;
  properties?: Record<string, unknown>;
  context: DispatchContext;
  options?: DispatchOptions;
  queuedAt: number;
}

export interface DispatchQueueOptions {
  batching: ResolvedAnalyticsConfig['batching'];
  offline: ResolvedAnalyticsConfig['offline'];
  storage: ResolvedAnalyticsConfig['storage'];
  logger: Logger;
  /** Sink that actually delivers a call to the providers. */
  dispatch: (call: QueuedCall) => Promise<void>;
}

/**
 * Buffers analytics calls according to the batching / offline configuration.
 *
 * With both features disabled (the default) calls pass straight through, so the
 * queue adds no latency and no timers to a standard setup.
 */
export class DispatchQueue {
  private buffer: QueuedCall[] = [];
  private offlineBuffer: QueuedCall[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> = Promise.resolve();
  private destroyed = false;
  private readonly storage?: KeyValueStorage;
  private readonly listeners: Array<() => void> = [];

  constructor(private readonly options: DispatchQueueOptions) {
    if (options.offline.enabled && options.offline.persist) {
      this.storage = createStorage({
        type: options.storage.type,
        keyPrefix: options.storage.keyPrefix,
        cookie: options.storage.cookie,
      });
      this.restorePersistedQueue();
    }

    this.attachListeners();
  }

  /** Number of calls currently waiting to be delivered. */
  size(): number {
    return this.buffer.length + this.offlineBuffer.length;
  }

  /** Accepts a call and decides whether to deliver, batch, or park it offline. */
  enqueue(call: Omit<QueuedCall, 'id' | 'queuedAt'>): void {
    if (this.destroyed) return;

    const entry: QueuedCall = {
      ...call,
      id: generateShortId(),
      queuedAt: Date.now(),
    };

    if (this.options.offline.enabled && !isOnline()) {
      this.parkOffline(entry);
      return;
    }

    const immediate = entry.options?.immediate === true;
    if (!this.options.batching.enabled || immediate) {
      this.deliver(entry);
      return;
    }

    this.buffer.push(entry);
    if (this.buffer.length > this.options.batching.maxQueueSize) {
      const dropped = this.buffer.shift();
      this.options.logger.warn(
        `Batch queue exceeded ${this.options.batching.maxQueueSize} entries; dropped oldest call`,
        dropped?.type
      );
    }

    if (this.buffer.length >= this.options.batching.maxEvents) {
      void this.flush();
      return;
    }

    this.scheduleFlush();
  }

  /** Delivers everything currently queued, including parked offline calls. */
  async flush(): Promise<void> {
    this.clearTimer();

    if (this.offlineBuffer.length > 0 && isOnline()) {
      const parked = this.offlineBuffer;
      this.offlineBuffer = [];
      this.persistOfflineQueue();
      this.buffer.unshift(...parked);
    }

    if (this.buffer.length === 0) {
      await this.inFlight;
      return;
    }

    const batch = this.buffer;
    this.buffer = [];

    this.options.logger.debug(`Flushing ${batch.length} queued call(s)`);

    const run = (async () => {
      for (const entry of batch) {
        await this.options.dispatch(entry);
      }
    })();

    this.inFlight = this.inFlight.then(() => run).catch(() => undefined);
    await this.inFlight;
  }

  /** Drops everything without delivering. */
  clear(): void {
    this.buffer = [];
    this.offlineBuffer = [];
    this.persistOfflineQueue();
    this.clearTimer();
  }

  async destroy(): Promise<void> {
    this.clearTimer();
    for (const remove of this.listeners) remove();
    this.listeners.length = 0;
    this.destroyed = true;
    await this.inFlight.catch(() => undefined);
  }

  private deliver(entry: QueuedCall): void {
    const run = this.options.dispatch(entry).catch(() => undefined);
    this.inFlight = this.inFlight.then(() => run);
  }

  private parkOffline(entry: QueuedCall): void {
    this.offlineBuffer.push(entry);
    if (this.offlineBuffer.length > this.options.offline.maxQueueSize) {
      this.offlineBuffer.shift();
    }
    this.persistOfflineQueue();
    this.options.logger.debug(`Offline: parked ${entry.type} call (${this.offlineBuffer.length})`);
  }

  private scheduleFlush(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.batching.flushInterval);
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  private clearTimer(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private persistOfflineQueue(): void {
    if (!this.storage) return;
    if (this.offlineBuffer.length === 0) {
      this.storage.remove(this.options.offline.storageKey);
      return;
    }
    writeJson(this.storage, this.options.offline.storageKey, this.offlineBuffer);
  }

  private restorePersistedQueue(): void {
    if (!this.storage) return;
    const persisted = readJson<QueuedCall[]>(this.storage, this.options.offline.storageKey);
    if (Array.isArray(persisted) && persisted.length > 0) {
      this.offlineBuffer = persisted.slice(-this.options.offline.maxQueueSize);
      this.options.logger.debug(`Restored ${this.offlineBuffer.length} offline call(s)`);
    }
  }

  private attachListeners(): void {
    const win = getWindow();
    const doc = getDocument();
    if (!win) return;

    if (this.options.offline.enabled) {
      const onOnline = (): void => {
        this.options.logger.debug('Connection restored; flushing offline queue');
        void this.flush();
      };
      win.addEventListener('online', onOnline);
      this.listeners.push(() => win.removeEventListener('online', onOnline));
    }

    if (this.options.batching.enabled && this.options.batching.flushOnUnload) {
      // `pagehide` is the reliable signal on mobile Safari; `visibilitychange`
      // covers tab switches and backgrounding.
      const onUnload = (): void => {
        void this.flush();
      };
      win.addEventListener('pagehide', onUnload);
      this.listeners.push(() => win.removeEventListener('pagehide', onUnload));

      if (doc) {
        const onVisibility = (): void => {
          if (doc.visibilityState === 'hidden') void this.flush();
        };
        doc.addEventListener('visibilitychange', onVisibility);
        this.listeners.push(() => doc.removeEventListener('visibilitychange', onVisibility));
      }
    }
  }
}
