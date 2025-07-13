import { IframePlayerBase } from "./utils/IframePlayerBase";
import type { AdapterDetection, AdapterTier } from "@repo/types";

/**
 * Adapter for Crunchyroll's Vilos player using postMessage communication
 */
export class CrunchyrollAdapter extends IframePlayerBase {
  protected readonly allowedOrigins = ["https://static.crunchyroll.com"];
  protected readonly messageTimeout = 5000; // 5 seconds
  protected readonly maxRetries = 2;

  static readonly tier: AdapterTier = "IFRAME_API";
  static readonly domains = ["crunchyroll.com"];

  /**
   * Detect if this adapter can be used on the current page
   */
  static detect(): AdapterDetection {
    const hostname = window.location.hostname;

    if (!hostname.includes("crunchyroll.com")) {
      return { supported: false, confidence: 0, tier: "IFRAME_API" };
    }

    const iframe = CrunchyrollAdapter.findVilosIframe();
    if (!iframe) {
      return { supported: false, confidence: 0, tier: "IFRAME_API" };
    }

    return {
      supported: true,
      confidence: 0.9,
      tier: "IFRAME_API",
    };
  }

  /**
   * Find the Vilos player iframe on the page
   */
  static findVilosIframe(): HTMLIFrameElement | null {
    // Look for iframe with Vilos player URL
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[src*="vilos-v2/web/vilos/player.html"], iframe[src*="vilos/player.html"]',
    );

    if (iframe) {
      return iframe;
    }

    // Fallback: look for iframe with video player class
    const playerIframe = document.querySelector<HTMLIFrameElement>(
      'iframe.video-player, iframe[class*="player"]',
    );

    if (playerIframe && playerIframe.src.includes("crunchyroll.com")) {
      return playerIframe;
    }

    return null;
  }

  /**
   * Create adapter instance for the current page
   */
  static create(): CrunchyrollAdapter {
    const iframe = CrunchyrollAdapter.findVilosIframe();
    return new CrunchyrollAdapter(iframe || undefined);
  }

  async play(): Promise<void> {
    await this.sendCommand({ type: "play" });
  }

  async pause(): Promise<void> {
    await this.sendCommand({ type: "pause" });
  }

  async seek(time: number): Promise<void> {
    if (time < 0) {
      throw new Error(`Invalid seek time: ${time}`);
    }

    await this.sendCommand({ type: "seek", time });
  }

  async setPlaybackRate(rate: number): Promise<void> {
    if (rate <= 0 || rate > 16) {
      throw new Error(`Invalid playback rate: ${rate}`);
    }

    await this.sendCommand({ type: "setPlaybackRate", rate });
  }

  async getCurrentTime(): Promise<number> {
    const response = await this.sendCommand({ type: "getState" }, true);
    return response.currentTime ?? 0;
  }

  async getDuration(): Promise<number> {
    const response = await this.sendCommand({ type: "getState" }, true);
    return response.duration ?? 0;
  }

  async isPaused(): Promise<boolean> {
    const response = await this.sendCommand({ type: "getState" }, true);
    return response.paused ?? true;
  }

  /**
   * Handle player events from the Vilos iframe
   */
  protected handlePlayerEvent(data: any): void {
    if (!this.isPlayerEvent(data)) {
      return;
    }

    switch (data.type) {
      case "play":
        this.emit("play");
        break;
      case "pause":
        this.emit("pause");
        break;
      case "seeking":
        this.emit("seeking", { currentTime: data.currentTime });
        break;
      case "seeked":
        this.emit("seeked", { currentTime: data.currentTime });
        break;
      case "timeupdate":
        this.emit("timeupdate", { currentTime: data.currentTime });
        break;
      case "stateResponse":
        // This is handled by the pending request system
        break;
      default:
        // Unknown event type, ignore
        break;
    }
  }

  /**
   * Check if a message is a player-related event
   */
  private isPlayerEvent(data: any): boolean {
    if (!data || typeof data !== "object" || !data.type) {
      return false;
    }

    const playerEvents = [
      "play",
      "pause",
      "seeking",
      "seeked",
      "timeupdate",
      "stateResponse",
      "error",
    ];

    return playerEvents.includes(data.type);
  }
}
