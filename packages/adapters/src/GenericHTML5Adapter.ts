/**
 * Generic HTML5 video adapter implementation
 */
import type { IPlayerAdapter } from "@repo/types";

export class GenericHTML5Adapter implements IPlayerAdapter {
  private videoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<string, Set<(payload?: unknown) => void>> =
    new Map();
  private domListeners: Array<{ event: string; handler: EventListener }> = [];

  constructor(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      this.attach(videoElement);
    }
  }

  /**
   * Attach adapter to a video element
   */
  attach(videoElement: HTMLVideoElement): void {
    this.detach();
    this.videoElement = videoElement;
    this.setupDOMListeners();
  }

  /**
   * Detach adapter from current video element
   */
  detach(): void {
    this.removeDOMListeners();
    this.videoElement = null;
  }

  /**
   * Setup DOM event listeners on the video element
   */
  private setupDOMListeners(): void {
    if (!this.videoElement) return;

    const events = [
      { domEvent: "play", adapterEvent: "play" },
      { domEvent: "pause", adapterEvent: "pause" },
      { domEvent: "seeking", adapterEvent: "seeking" },
      { domEvent: "seeked", adapterEvent: "seeked" },
      { domEvent: "timeupdate", adapterEvent: "timeupdate" },
      { domEvent: "loadedmetadata", adapterEvent: "loadedmetadata" },
      { domEvent: "durationchange", adapterEvent: "durationchange" },
    ] as const;

    events.forEach(({ domEvent, adapterEvent }) => {
      const handler = () => {
        const currentTime = this.videoElement?.currentTime || 0;
        const duration = this.videoElement?.duration || 0;

        // Include duration in all event payloads to ensure it's always available
        const payload = {
          currentTime,
          duration: !isNaN(duration) && isFinite(duration) ? duration : 0,
        };

        this.emit(adapterEvent, payload);
      };

      this.videoElement!.addEventListener(domEvent, handler);
      this.domListeners.push({ event: domEvent, handler });
    });
  }

  /**
   * Remove DOM event listeners
   */
  private removeDOMListeners(): void {
    if (!this.videoElement) return;

    this.domListeners.forEach(({ event, handler }) => {
      this.videoElement!.removeEventListener(event, handler);
    });
    this.domListeners = [];
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(event: string, payload?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in adapter event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Ensure video element is available
   */
  private ensureVideoElement(): HTMLVideoElement {
    if (!this.videoElement) {
      throw new Error("No video element attached to adapter");
    }
    return this.videoElement;
  }

  // IPlayerAdapter implementation

  async play(): Promise<void> {
    const video = this.ensureVideoElement();
    try {
      await video.play();
    } catch (error) {
      // Handle browser autoplay policies
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        console.warn("Autoplay blocked by browser policy");
        throw new Error("Playback blocked by browser autoplay policy");
      }
      throw error;
    }
  }

  async pause(): Promise<void> {
    const video = this.ensureVideoElement();
    video.pause();
  }

  async seek(time: number): Promise<void> {
    const video = this.ensureVideoElement();
    if (time < 0 || time > video.duration) {
      throw new Error(`Invalid seek time: ${time}`);
    }
    video.currentTime = time;
  }

  async setPlaybackRate(rate: number): Promise<void> {
    const video = this.ensureVideoElement();
    if (rate <= 0 || rate > 16) {
      throw new Error(`Invalid playback rate: ${rate}`);
    }
    video.playbackRate = rate;
  }

  async getCurrentTime(): Promise<number> {
    const video = this.ensureVideoElement();
    return video.currentTime;
  }

  async getDuration(): Promise<number> {
    const video = this.ensureVideoElement();
    return video.duration;
  }

  async isPaused(): Promise<boolean> {
    const video = this.ensureVideoElement();
    return video.paused;
  }

  on(
    event:
      | "play"
      | "pause"
      | "seeking"
      | "seeked"
      | "timeupdate"
      | "loadedmetadata"
      | "durationchange",
    callback: (payload?: unknown) => void,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(
    event:
      | "play"
      | "pause"
      | "seeking"
      | "seeked"
      | "timeupdate"
      | "loadedmetadata"
      | "durationchange",
    callback: (payload?: unknown) => void,
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  destroy(): void {
    this.detach();
    this.eventListeners.clear();
  }

  /**
   * Get current video state including duration
   */
  async getVideoState(): Promise<{
    currentTime: number;
    duration: number;
    isPaused: boolean;
    playbackRate: number;
  }> {
    const video = this.ensureVideoElement();
    return {
      currentTime: video.currentTime,
      duration:
        !isNaN(video.duration) && isFinite(video.duration) ? video.duration : 0,
      isPaused: video.paused,
      playbackRate: video.playbackRate,
    };
  }

  /**
   * Static method to find video elements on the page
   */
  static findVideoElements(): HTMLVideoElement[] {
    return Array.from(document.querySelectorAll("video"));
  }

  /**
   * Static method to find the most likely primary video element
   */
  static findPrimaryVideoElement(): HTMLVideoElement | null {
    const videos = GenericHTML5Adapter.findVideoElements();

    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Find the largest visible video element
    return videos.reduce((primary, video) => {
      const primaryRect = primary.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();

      const primaryArea = primaryRect.width * primaryRect.height;
      const videoArea = videoRect.width * videoRect.height;

      // Check if video is visible
      const isVisible = videoRect.width > 0 && videoRect.height > 0;

      if (!isVisible) return primary;

      return videoArea > primaryArea ? video : primary;
    });
  }
}
