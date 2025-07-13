import { GenericHTML5Adapter } from "./GenericHTML5Adapter";
import type { AdapterDetection, AdapterTier } from "@repo/types";

/**
 * Adapter for Crunchyroll's Vilos player that runs inside the iframe
 * Uses the direct HTML5 video element (player0) inside the static.crunchyroll.com iframe
 */
export class CrunchyrollVilosAdapter extends GenericHTML5Adapter {
  static readonly tier: AdapterTier = "HTML5";
  static readonly domains = ["static.crunchyroll.com"];

  /**
   * Detect if this adapter can be used in the current environment
   * Must be running inside the Vilos iframe with the player0 element
   */
  static detect(): AdapterDetection {
    // Must be running inside the Vilos iframe
    if (!CrunchyrollVilosAdapter.isVilosIframe()) {
      return { supported: false, confidence: 0, tier: "HTML5" };
    }

    // Look for the player0 video element
    const player0 = CrunchyrollVilosAdapter.findPlayer0Element();
    if (!player0) {
      return { supported: false, confidence: 0, tier: "HTML5" };
    }

    return {
      supported: true,
      confidence: 0.95, // High confidence since we're specifically in Vilos iframe
      tier: "HTML5",
    };
  }

  /**
   * Check if we're running inside the Vilos player iframe
   */
  static isVilosIframe(): boolean {
    // Check if we're in an iframe
    if (window === window.top) {
      return false;
    }

    // Check the current URL
    const url = window.location.href;
    return (
      url.includes("static.crunchyroll.com") &&
      (url.includes("vilos/player.html") ||
        url.includes("vilos-v2/web/vilos/player.html"))
    );
  }

  /**
   * Find the player0 video element specifically
   */
  static findPlayer0Element(): HTMLVideoElement | null {
    const player0 = document.getElementById("player0") as HTMLVideoElement;

    if (player0 && player0.tagName === "VIDEO") {
      return player0;
    }

    return null;
  }

  /**
   * Create adapter instance for the Vilos iframe
   */
  static create(): CrunchyrollVilosAdapter {
    const player0 = CrunchyrollVilosAdapter.findPlayer0Element();
    if (!player0) {
      throw new Error(
        "Cannot create CrunchyrollVilosAdapter: player0 element not found",
      );
    }

    return new CrunchyrollVilosAdapter(player0);
  }

  /**
   * Wait for player0 element to be available with retry mechanism
   */
  static async waitForPlayer0(
    maxAttempts = 20,
    intervalMs = 500,
  ): Promise<HTMLVideoElement | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const player0 = CrunchyrollVilosAdapter.findPlayer0Element();
      if (player0) {
        return player0;
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return null;
  }

  /**
   * Enhanced creation method that waits for player0 to be available
   */
  static async createWhenReady(): Promise<CrunchyrollVilosAdapter | null> {
    const player0 = await CrunchyrollVilosAdapter.waitForPlayer0();
    if (!player0) {
      return null;
    }

    return new CrunchyrollVilosAdapter(player0);
  }
}
