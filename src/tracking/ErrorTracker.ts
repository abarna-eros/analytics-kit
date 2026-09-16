import type { ErrorContext, Logger, ResolvedAnalyticsConfig } from '../core/types';
import { getWindow } from '../utils/browser';

export interface ErrorTrackerOptions {
  config: ResolvedAnalyticsConfig['errorTracking'];
  logger: Logger;
  report: (error: unknown, context?: ErrorContext) => void;
}

/**
 * Optional global error capture.
 *
 * Disabled by default. Only the error name and message are forwarded unless
 * `includeStackTrace` is explicitly enabled, and the number of events per page
 * load is capped so an error loop cannot flood a provider.
 */
export class ErrorTracker {
  private readonly teardown: Array<() => void> = [];
  private count = 0;
  private started = false;

  constructor(private readonly options: ErrorTrackerOptions) {}

  start(): void {
    if (this.started) return;
    const win = getWindow();
    if (!win) return;

    this.started = true;

    const onError = (event: ErrorEvent): void => {
      this.handle(event.error ?? new Error(event.message), {
        error_source: 'window.onerror',
      });
    };

    const onRejection = (event: PromiseRejectionEvent): void => {
      this.handle(event.reason, { error_source: 'unhandledrejection' });
    };

    win.addEventListener('error', onError);
    win.addEventListener('unhandledrejection', onRejection);

    this.teardown.push(() => win.removeEventListener('error', onError));
    this.teardown.push(() => win.removeEventListener('unhandledrejection', onRejection));

    this.options.logger.debug('Global error capture enabled');
  }

  stop(): void {
    for (const remove of this.teardown) remove();
    this.teardown.length = 0;
    this.started = false;
  }

  private handle(error: unknown, context: ErrorContext): void {
    if (this.count >= this.options.config.maxErrorsPerSession) return;
    this.count += 1;
    this.options.report(error, context);
  }
}
