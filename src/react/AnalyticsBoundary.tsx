import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AnalyticsContext } from './context';
import type { Analytics, AnalyticsEventMap } from '../core/types';

export interface AnalyticsBoundaryProps {
  children?: ReactNode;
  /** Rendered instead of the children after an error. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Component name attached to the reported error. */
  component?: string;
  /** Called in addition to the analytics event. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Instance to report to; defaults to the one from context. */
  analytics?: Analytics<AnalyticsEventMap>;
}

interface AnalyticsBoundaryState {
  error: Error | null;
}

/**
 * Error boundary that reports render errors as analytics events.
 *
 * Reporting is wrapped in its own try/catch: a failure inside analytics can
 * never turn into a second render error.
 *
 * @example
 * ```tsx
 * <AnalyticsBoundary component="Checkout" fallback={<CheckoutError />}>
 *   <Checkout />
 * </AnalyticsBoundary>
 * ```
 */
export class AnalyticsBoundary extends Component<AnalyticsBoundaryProps, AnalyticsBoundaryState> {
  static override contextType = AnalyticsContext;

  declare context: React.ContextType<typeof AnalyticsContext>;

  override state: AnalyticsBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AnalyticsBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const analytics = this.props.analytics ?? this.context;

    try {
      analytics?.trackError(error, {
        component: this.props.component,
        action: 'render',
        component_stack_available: Boolean(info.componentStack),
      });
    } catch {
      // Analytics must never escalate a render error.
    }

    try {
      this.props.onError?.(error, info);
    } catch {
      /* ignore */
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(error, this.reset);
    return fallback ?? null;
  }
}
