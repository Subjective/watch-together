/**
 * Generic HTML5 video adapter implementation
 */
import type { IPlayerAdapter } from "@repo/types";

export class GenericHTML5Adapter implements IPlayerAdapter {
  async play(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async pause(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async seek(_time: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async setPlaybackRate(_rate: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getCurrentTime(): Promise<number> {
    throw new Error("Method not implemented.");
  }

  async getDuration(): Promise<number> {
    throw new Error("Method not implemented.");
  }

  async isPaused(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  on(
    _event: "play" | "pause" | "seeking" | "timeupdate",
    _callback: (payload?: any) => void,
  ): void {
    throw new Error("Method not implemented.");
  }

  off(
    _event: "play" | "pause" | "seeking" | "timeupdate",
    _callback: (payload?: any) => void,
  ): void {
    throw new Error("Method not implemented.");
  }

  destroy(): void {
    throw new Error("Method not implemented.");
  }
}
