import type { AnalyticsErrorInfo, Logger } from '../core/types';
import type { Plugin, PluginContext, PluginPayload } from './types';

/**
 * Registry and safe invoker for plugins.
 *
 * Every hook call is wrapped: plugin failures are reported through the error
 * handler and never propagate into application code.
 */
export class PluginManager {
  private readonly plugins = new Map<string, Plugin>();
  private readonly initialized = new Set<string>();

  constructor(
    private readonly logger: Logger,
    private readonly onError: (info: AnalyticsErrorInfo) => void
  ) {}

  register(plugin: Plugin): void {
    if (!plugin?.name) {
      this.logger.warn('Ignoring plugin without a name');
      return;
    }
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin "${plugin.name}" is already registered; replacing it`);
      this.initialized.delete(plugin.name);
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.debug(`Registered plugin "${plugin.name}"`);
  }

  async remove(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) return;
    this.plugins.delete(name);
    this.initialized.delete(name);
    await this.safeCall(plugin, 'destroy', () => plugin.destroy?.());
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  list(): readonly Plugin[] {
    return [...this.plugins.values()];
  }

  /** Initialises any plugin that has not been initialised yet. */
  async initializeAll(context: PluginContext): Promise<void> {
    await Promise.all(
      [...this.plugins.values()].map(async (plugin) => {
        if (this.initialized.has(plugin.name)) return;
        this.initialized.add(plugin.name);
        await this.safeCall(plugin, 'initialize', () => plugin.initialize?.(context));
      })
    );
  }

  /**
   * Runs `beforeSend` across all plugins.
   * Returns the (possibly rewritten) payload, or `null` if a plugin vetoed it.
   */
  applyBeforeSend(payload: PluginPayload): PluginPayload | null {
    let current = payload;
    for (const plugin of this.plugins.values()) {
      if (!plugin.beforeSend) continue;
      try {
        const result = plugin.beforeSend(current);
        if (result === false) {
          this.logger.debug(`Plugin "${plugin.name}" dropped ${current.type} call`);
          return null;
        }
        if (result) current = result;
      } catch (error) {
        this.report(plugin.name, 'beforeSend', error);
      }
    }
    return current;
  }

  /** Fans a lifecycle hook out to every plugin that implements it. */
  async notify(payload: PluginPayload): Promise<void> {
    const calls: Array<Promise<void>> = [];

    for (const plugin of this.plugins.values()) {
      switch (payload.type) {
        case 'track':
          if (plugin.track) {
            calls.push(
              this.safeCall(plugin, 'track', () =>
                plugin.track?.(payload.name ?? '', payload.properties, payload.context)
              )
            );
          }
          break;
        case 'page':
          if (plugin.page) {
            calls.push(
              this.safeCall(plugin, 'page', () =>
                plugin.page?.(payload.name, payload.properties, payload.context)
              )
            );
          }
          break;
        case 'identify':
          if (plugin.identify) {
            calls.push(
              this.safeCall(plugin, 'identify', () =>
                plugin.identify?.(payload.name ?? '', payload.properties, payload.context)
              )
            );
          }
          break;
        case 'group':
          if (plugin.group) {
            calls.push(
              this.safeCall(plugin, 'group', () =>
                plugin.group?.(payload.name ?? '', payload.properties, payload.context)
              )
            );
          }
          break;
        case 'reset':
          if (plugin.reset) {
            calls.push(this.safeCall(plugin, 'reset', () => plugin.reset?.()));
          }
          break;
      }
    }

    await Promise.all(calls);
  }

  async destroyAll(): Promise<void> {
    const plugins = [...this.plugins.values()];
    this.plugins.clear();
    this.initialized.clear();
    await Promise.all(
      plugins.map((plugin) => this.safeCall(plugin, 'destroy', () => plugin.destroy?.()))
    );
  }

  private async safeCall(
    plugin: Plugin,
    operation: string,
    call: () => void | Promise<void>
  ): Promise<void> {
    try {
      await call();
    } catch (error) {
      this.report(plugin.name, operation, error);
    }
  }

  private report(source: string, operation: string, error: unknown): void {
    this.logger.error(`Plugin "${source}" failed during ${operation}`, error);
    this.onError({ error, source: `plugin:${source}`, operation });
  }
}
