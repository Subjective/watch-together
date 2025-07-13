import type { IPlayerAdapter, VideoIdentity } from "@repo/types";

export class MockAdapter implements IPlayerAdapter {
  private _isPlaying = false;
  private _currentTime = 0;
  private _duration = 120; // 2 minutes default
  private _playbackRate = 1;
  private _eventCallbacks: Map<string, ((payload?: any) => void)[]> = new Map();

  // Control methods
  async play(): Promise<void> {
    this._isPlaying = true;
    this._emitEvent("play");
  }

  async pause(): Promise<void> {
    this._isPlaying = false;
    this._emitEvent("pause");
  }

  async seek(time: number): Promise<void> {
    this._currentTime = time;
    this._emitEvent("seeking", { time });
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this._playbackRate = rate;
  }

  // State methods
  async getCurrentTime(): Promise<number> {
    return this._currentTime;
  }

  async getDuration(): Promise<number> {
    return this._duration;
  }

  async isPaused(): Promise<boolean> {
    return !this._isPlaying;
  }

  async getVideoIdentity(): Promise<VideoIdentity | null> {
    // For mock adapter, create a deterministic identity
    return {
      id: `mock-video-${this._duration}`,
      platform: "mock",
      duration: this._duration,
      title: "Mock Video",
      source: "mock://video",
      confidence: 1.0,
    };
  }

  // Event subscription
  on(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: any) => void,
  ): void {
    if (!this._eventCallbacks.has(event)) {
      this._eventCallbacks.set(event, []);
    }
    this._eventCallbacks.get(event)!.push(callback);
  }

  off(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: any) => void,
  ): void {
    const callbacks = this._eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Cleanup
  destroy(): void {
    this._eventCallbacks.clear();
  }

  // Helper methods for testing
  isPlaying(): boolean {
    return this._isPlaying;
  }

  getPlaybackRate(): number {
    return this._playbackRate;
  }

  setCurrentTime(time: number): void {
    this._currentTime = time;
    this._emitEvent("timeupdate", { time });
  }

  setDuration(duration: number): void {
    this._duration = duration;
  }

  private _emitEvent(event: string, payload?: any): void {
    const callbacks = this._eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload));
    }
  }
}
