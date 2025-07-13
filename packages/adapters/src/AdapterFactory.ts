/**
 * Factory for creating and managing video player adapters
 */
import type {
  IPlayerAdapter,
  AdapterDetection,
  AdapterTier,
} from "@repo/types";
import { GenericHTML5Adapter } from "./GenericHTML5Adapter";

export interface AdapterConfig {
  name: string;
  tier: AdapterTier;
  domains: string[];
  detect: () => AdapterDetection;
  create: () => IPlayerAdapter | null;
}

export class AdapterFactory {
  private static adapters: Map<string, AdapterConfig> = new Map();
  private static initialized = false;

  /**
   * Initialize the factory with default adapters
   */
  static initialize(): void {
    if (this.initialized) return;

    // Register default HTML5 adapter (lowest priority)
    this.register({
      name: "generic-html5",
      tier: "HTML5",
      domains: ["*"], // Matches all domains
      detect: () => {
        const video = GenericHTML5Adapter.findPrimaryVideoElement();
        return {
          supported: !!video,
          confidence: video ? 0.5 : 0, // Low confidence as it's generic
          tier: "HTML5",
        };
      },
      create: () => {
        const video = GenericHTML5Adapter.findPrimaryVideoElement();
        return video ? new GenericHTML5Adapter(video) : null;
      },
    });

    this.initialized = true;
  }

  /**
   * Register a new adapter configuration
   */
  static register(config: AdapterConfig): void {
    this.adapters.set(config.name, config);
  }

  /**
   * Unregister an adapter by name
   */
  static unregister(name: string): void {
    this.adapters.delete(name);
  }

  /**
   * Get adapter configuration by name
   */
  static getAdapter(name: string): AdapterConfig | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all registered adapters
   */
  static getAllAdapters(): AdapterConfig[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Detect which adapter to use for the current page
   */
  static detect(): {
    adapter: AdapterConfig;
    detection: AdapterDetection;
  } | null {
    // Initialize if not already done
    this.initialize();

    const currentDomain = window.location.hostname;
    const candidates: Array<{
      adapter: AdapterConfig;
      detection: AdapterDetection;
    }> = [];

    // Check each adapter
    for (const adapter of this.adapters.values()) {
      // Check domain match
      const domainMatch = adapter.domains.some((domain) => {
        if (domain === "*") return true;
        return currentDomain.includes(domain);
      });

      if (domainMatch) {
        const detection = adapter.detect();
        if (detection.supported) {
          candidates.push({ adapter, detection });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by tier priority and confidence
    candidates.sort((a, b) => {
      // Tier priority (higher tier = better)
      const tierOrder: Record<AdapterTier, number> = {
        PROPRIETARY: 4,
        IFRAME_API: 3,
        HTML5: 2,
        FALLBACK: 1,
      };
      const tierDiff =
        tierOrder[b.detection.tier] - tierOrder[a.detection.tier];
      if (tierDiff !== 0) return tierDiff;

      // Then by confidence
      return b.detection.confidence - a.detection.confidence;
    });

    return candidates[0];
  }

  /**
   * Create an adapter for the current page
   */
  static createAdapter(): IPlayerAdapter | null {
    const result = this.detect();
    if (!result) return null;

    try {
      const adapter = result.adapter.create();
      if (adapter) {
        console.log(
          `[AdapterFactory] Created ${result.adapter.name} adapter with confidence ${result.detection.confidence}`,
        );
      }
      return adapter;
    } catch (error) {
      console.error(
        `[AdapterFactory] Failed to create ${result.adapter.name} adapter:`,
        error,
      );
      return null;
    }
  }

  /**
   * Clear all registered adapters (useful for testing)
   */
  static clear(): void {
    this.adapters.clear();
    this.initialized = false;
  }
}
