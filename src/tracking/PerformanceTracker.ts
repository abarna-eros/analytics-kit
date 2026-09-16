import type {
  AnalyticsEventProperties,
  Logger,
  PerformanceMetric,
  ResolvedAnalyticsConfig,
} from '../core/types';
import { getDocument, getWindow, runWhenIdle } from '../utils/browser';

export interface PerformanceTrackerOptions {
  config: ResolvedAnalyticsConfig['performanceTracking'];
  logger: Logger;
  track: (eventName: string, properties?: AnalyticsEventProperties) => void;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
}

/**
 * Optional Web Vitals collection built directly on `PerformanceObserver`.
 *
 * No third-party dependency is used, nothing is measured synchronously, and
 * observers are registered during idle time so rendering is never blocked.
 *
 * LCP, CLS and INP are only final once the page is hidden, so those metrics are
 * reported on `visibilitychange`/`pagehide` rather than on load.
 */
export class PerformanceTracker {
  private readonly observers: PerformanceObserver[] = [];
  private readonly teardown: Array<() => void> = [];
  private readonly reported = new Set<PerformanceMetric>();

  private clsValue = 0;
  private lcpValue: number | undefined;
  private inpValue = 0;
  private started = false;
  private cancelIdle?: () => void;

  constructor(private readonly options: PerformanceTrackerOptions) {}

  start(): void {
    if (this.started) return;
    const win = getWindow();
    if (!win || typeof win.PerformanceObserver === 'undefined') {
      this.options.logger.debug('PerformanceObserver unavailable; performance tracking skipped');
      return;
    }
    if (Math.random() > this.options.config.sampleRate) {
      this.options.logger.debug('Performance tracking skipped by sampling');
      return;
    }

    this.started = true;
    this.cancelIdle = runWhenIdle(() => this.observe());
    this.attachFinalizers();
  }

  stop(): void {
    this.cancelIdle?.();
    for (const observer of this.observers) {
      try {
        observer.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.observers.length = 0;
    for (const remove of this.teardown) remove();
    this.teardown.length = 0;
    this.started = false;
  }

  private enabled(metric: PerformanceMetric): boolean {
    return this.options.config.metrics.includes(metric);
  }

  private observe(): void {
    if (this.enabled('fcp')) {
      this.createObserver('paint', (entries) => {
        for (const entry of entries) {
          if (entry.name === 'first-contentful-paint') {
            this.report('fcp', entry.startTime);
          }
        }
      });
    }

    if (this.enabled('lcp')) {
      this.createObserver('largest-contentful-paint', (entries) => {
        const last = entries[entries.length - 1] as LargestContentfulPaintEntry | undefined;
        if (last) this.lcpValue = last.renderTime || last.loadTime || last.startTime;
      });
    }

    if (this.enabled('cls')) {
      this.createObserver('layout-shift', (entries) => {
        for (const entry of entries as LayoutShiftEntry[]) {
          // Shifts following user input are expected and excluded from CLS.
          if (!entry.hadRecentInput) this.clsValue += entry.value;
        }
      });
    }

    if (this.enabled('inp')) {
      this.createObserver(
        'event',
        (entries) => {
          for (const entry of entries) {
            if (entry.duration > this.inpValue) this.inpValue = entry.duration;
          }
        },
        { durationThreshold: 40 }
      );
    }

    if (this.enabled('ttfb') || this.enabled('navigation')) {
      this.reportNavigationTiming();
    }
  }

  private createObserver(
    type: string,
    callback: (entries: PerformanceEntry[]) => void,
    extra: Record<string, unknown> = {}
  ): void {
    const win = getWindow();
    if (!win) return;
    try {
      const observer = new win.PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      this.observers.push(observer);
    } catch {
      // Unsupported entry types throw; that metric is simply not collected.
      this.options.logger.debug(`PerformanceObserver type "${type}" is not supported`);
    }
  }

  private reportNavigationTiming(): void {
    const win = getWindow();
    if (!win?.performance?.getEntriesByType) return;

    const emit = (): void => {
      const [navigation] = win.performance.getEntriesByType('navigation') as
        PerformanceNavigationTiming[] | [];
      if (!navigation) return;

      if (this.enabled('ttfb')) {
        this.report('ttfb', Math.max(0, navigation.responseStart - navigation.requestStart));
      }

      if (this.enabled('navigation')) {
        this.reportMetric('navigation', navigation.loadEventEnd - navigation.startTime, {
          dom_interactive: round(navigation.domInteractive),
          dom_content_loaded: round(navigation.domContentLoadedEventEnd),
          load_event: round(navigation.loadEventEnd),
          response_time: round(navigation.responseEnd - navigation.requestStart),
          dns_time: round(navigation.domainLookupEnd - navigation.domainLookupStart),
          tcp_time: round(navigation.connectEnd - navigation.connectStart),
          transfer_size: navigation.transferSize,
        });
      }
    };

    if (win.document?.readyState === 'complete') {
      emit();
      return;
    }
    const onLoad = (): void => emit();
    win.addEventListener('load', onLoad, { once: true });
    this.teardown.push(() => win.removeEventListener('load', onLoad));
  }

  /** LCP/CLS/INP are only final when the page goes away. */
  private attachFinalizers(): void {
    const win = getWindow();
    const doc = getDocument();
    if (!win) return;

    const finalize = (): void => {
      if (this.lcpValue !== undefined) this.report('lcp', this.lcpValue);
      if (this.enabled('cls')) this.report('cls', this.clsValue);
      if (this.inpValue > 0) this.report('inp', this.inpValue);
    };

    win.addEventListener('pagehide', finalize);
    this.teardown.push(() => win.removeEventListener('pagehide', finalize));

    if (doc) {
      const onVisibility = (): void => {
        if (doc.visibilityState === 'hidden') finalize();
      };
      doc.addEventListener('visibilitychange', onVisibility);
      this.teardown.push(() => doc.removeEventListener('visibilitychange', onVisibility));
    }
  }

  private report(metric: PerformanceMetric, value: number): void {
    if (this.reported.has(metric)) return;
    this.reportMetric(metric, value);
  }

  private reportMetric(
    metric: PerformanceMetric,
    value: number,
    extra: AnalyticsEventProperties = {}
  ): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.reported.add(metric);

    this.options.track(this.options.config.eventName, {
      metric_name: metric,
      metric_value: round(value),
      metric_unit: metric === 'cls' ? 'score' : 'millisecond',
      ...extra,
    });
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
