import {
  AUTO_EVENTS,
  DEFAULT_CLICK_EVENT_ATTRIBUTE,
  DEFAULT_CLICK_PROPERTY_PREFIX,
  DEFAULT_CLICK_SELECTOR,
} from '../core/constants';
import type {
  AnalyticsEventProperties,
  AutoTrackClickConfig,
  Logger,
  ResolvedAnalyticsConfig,
} from '../core/types';
import { getDocument, getWindow, isOutboundUrl } from '../utils/browser';
import { onHistoryChange } from '../utils/history';

export interface AutoTrackerOptions {
  config: ResolvedAnalyticsConfig['autoTrack'];
  logger: Logger;
  track: (eventName: string, properties?: AnalyticsEventProperties) => void;
  page: (pageName?: string, properties?: AnalyticsEventProperties) => void;
}

const MAX_LINK_TEXT_LENGTH = 100;

/**
 * Optional automatic tracking.
 *
 * Everything here is opt-in and deliberately conservative: at most one click
 * listener is attached (shared by outbound-link and element click tracking),
 * and no form values, input contents or element text beyond a link label are
 * ever read.
 */
export class AutoTracker {
  private readonly teardown: Array<() => void> = [];
  private started = false;

  constructor(private readonly options: AutoTrackerOptions) {}

  start(): void {
    if (this.started) return;
    const win = getWindow();
    const doc = getDocument();
    if (!win || !doc) return;

    this.started = true;
    const { config } = this.options;

    if (config.pageViews) this.startPageViews();
    if (config.outboundLinks || config.clicks) this.startClickTracking(doc);
    if (config.visibilityChange) this.startVisibilityTracking(doc);

    this.options.logger.debug('Automatic tracking started', {
      pageViews: config.pageViews,
      outboundLinks: config.outboundLinks,
      clicks: Boolean(config.clicks),
      visibilityChange: config.visibilityChange,
    });
  }

  stop(): void {
    for (const remove of this.teardown) {
      try {
        remove();
      } catch {
        /* ignore */
      }
    }
    this.teardown.length = 0;
    this.started = false;
  }

  private startPageViews(): void {
    this.options.page();
    const unsubscribe = onHistoryChange(() => {
      this.options.page();
    });
    this.teardown.push(unsubscribe);
  }

  private startClickTracking(doc: Document): void {
    const { config } = this.options;
    const clickConfig: AutoTrackClickConfig =
      typeof config.clicks === 'object' ? config.clicks : {};
    const selector = clickConfig.selector ?? DEFAULT_CLICK_SELECTOR;
    const eventAttribute = clickConfig.eventAttribute ?? DEFAULT_CLICK_EVENT_ATTRIBUTE;
    const propertyPrefix = clickConfig.propertyPrefix ?? DEFAULT_CLICK_PROPERTY_PREFIX;

    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (config.clicks) {
        const element = target.closest(selector);
        if (element) this.trackElementClick(element, eventAttribute, propertyPrefix);
      }

      if (config.outboundLinks) {
        const anchor = target.closest('a[href]');
        if (anchor instanceof HTMLAnchorElement) this.trackOutboundLink(anchor);
      }
    };

    // Capture phase so the event is recorded even if a handler stops propagation.
    doc.addEventListener('click', onClick, { capture: true, passive: true });
    this.teardown.push(() => doc.removeEventListener('click', onClick, { capture: true }));
  }

  private trackElementClick(
    element: Element,
    eventAttribute: string,
    propertyPrefix: string
  ): void {
    const eventName = element.getAttribute(eventAttribute);
    if (!eventName) return;

    const properties: AnalyticsEventProperties = {};
    for (const attribute of Array.from(element.attributes)) {
      if (!attribute.name.startsWith(propertyPrefix)) continue;
      if (attribute.name === eventAttribute) continue;
      const key = attribute.name.slice(propertyPrefix.length).replace(/-/g, '_');
      if (key) properties[key] = attribute.value;
    }

    this.options.track(eventName, properties);
  }

  private trackOutboundLink(anchor: HTMLAnchorElement): void {
    const href = anchor.getAttribute('href');
    if (!href || !isOutboundUrl(href)) return;

    let url: URL;
    try {
      url = new URL(href, getWindow()?.location.href);
    } catch {
      return;
    }

    this.options.track(AUTO_EVENTS.OUTBOUND_LINK, {
      link_url: url.href,
      link_domain: url.hostname,
      link_text: (anchor.textContent ?? '').trim().slice(0, MAX_LINK_TEXT_LENGTH) || undefined,
    });
  }

  private startVisibilityTracking(doc: Document): void {
    const onVisibilityChange = (): void => {
      this.options.track(AUTO_EVENTS.VISIBILITY_CHANGE, {
        visibility_state: doc.visibilityState,
      });
    };
    doc.addEventListener('visibilitychange', onVisibilityChange);
    this.teardown.push(() => doc.removeEventListener('visibilitychange', onVisibilityChange));
  }
}
