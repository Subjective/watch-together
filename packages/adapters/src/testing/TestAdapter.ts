/**
 * Test adapter for development and testing purposes
 */
import type { IPlayerAdapter, VideoIdentity } from "@repo/types";

export interface TestAdapterState {
  currentTime: number;
  duration: number;
  isPaused: boolean;
  playbackRate: number;
}

export class TestAdapter implements IPlayerAdapter {
  private state: TestAdapterState = {
    currentTime: 0,
    duration: 100,
    isPaused: true,
    playbackRate: 1,
  };

  private eventListeners: Map<string, Set<(payload?: unknown) => void>> =
    new Map();
  private playbackInterval: ReturnType<typeof setInterval> | null = null;

  constructor(initialState?: Partial<TestAdapterState>) {
    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }
  }

  /**
   * Update test adapter state
   */
  setState(state: Partial<TestAdapterState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Get current state
   */
  getState(): TestAdapterState {
    return { ...this.state };
  }

  async play(): Promise<void> {
    if (!this.state.isPaused) return;

    this.state.isPaused = false;
    this.emit("play");

    // Start playback simulation
    this.startPlaybackSimulation();
  }

  async pause(): Promise<void> {
    if (this.state.isPaused) return;

    this.state.isPaused = true;
    this.emit("pause");

    // Stop playback simulation
    this.stopPlaybackSimulation();
  }

  async seek(time: number): Promise<void> {
    if (time < 0 || time > this.state.duration) {
      throw new Error(`Invalid seek time: ${time}`);
    }

    this.emit("seeking", { currentTime: time });
    this.state.currentTime = time;
    // Simulate seek completion after a brief delay
    setTimeout(() => {
      this.emit("seeked", { currentTime: this.state.currentTime });
    }, 50);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    if (rate <= 0 || rate > 16) {
      throw new Error(`Invalid playback rate: ${rate}`);
    }

    this.state.playbackRate = rate;
  }

  async getCurrentTime(): Promise<number> {
    return this.state.currentTime;
  }

  async getDuration(): Promise<number> {
    return this.state.duration;
  }

  async isPaused(): Promise<boolean> {
    return this.state.isPaused;
  }

  async getVideoIdentity(): Promise<VideoIdentity | null> {
    // For test adapter, create a deterministic identity
    return {
      id: `test-video-${this.state.duration}`,
      platform: "test",
      duration: this.state.duration,
      title: "Test Video",
      source: "test://video",
      confidence: 1.0,
    };
  }

  on(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: unknown) => void,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(
    event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
    callback: (payload?: unknown) => void,
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  destroy(): void {
    this.stopPlaybackSimulation();
    this.eventListeners.clear();
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, payload?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(
            `Error in test adapter event listener for ${event}:`,
            error,
          );
        }
      });
    }
  }

  /**
   * Start simulating playback
   */
  private startPlaybackSimulation(): void {
    if (this.playbackInterval) return;

    this.playbackInterval = setInterval(() => {
      if (this.state.currentTime < this.state.duration) {
        this.state.currentTime += 0.1 * this.state.playbackRate;
        this.emit("timeupdate", { currentTime: this.state.currentTime });
      } else {
        // End of video
        this.pause();
      }
    }, 100);
  }

  /**
   * Stop simulating playback
   */
  private stopPlaybackSimulation(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  /**
   * Simulate user interaction (for testing)
   */
  simulateUserPlay(): void {
    this.play();
  }

  simulateUserPause(): void {
    this.pause();
  }

  simulateUserSeek(time: number): void {
    this.seek(time);
  }
}
