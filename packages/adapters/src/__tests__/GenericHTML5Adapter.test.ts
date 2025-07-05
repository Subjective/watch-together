import { describe, it, expect, beforeEach, vi } from "vitest";
import { GenericHTML5Adapter } from "../GenericHTML5Adapter";

// Mock HTMLVideoElement
const createMockVideoElement = () => {
  const mockVideo = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
    duration: 120,
    paused: true,
    playbackRate: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _currentTime: 0,
  };

  // Mock properties with getters/setters
  Object.defineProperty(mockVideo, "currentTime", {
    get: vi.fn(() => mockVideo._currentTime || 0),
    set: vi.fn((value) => {
      mockVideo._currentTime = value;
    }),
    configurable: true,
  });

  return mockVideo as unknown as HTMLVideoElement;
};

describe("GenericHTML5Adapter", () => {
  let adapter: GenericHTML5Adapter;
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    mockVideo = createMockVideoElement();

    // Mock document.querySelector to return our mock video
    vi.spyOn(document, "querySelector").mockReturnValue(mockVideo);

    adapter = new GenericHTML5Adapter();
  });

  it("should implement IPlayerAdapter interface", () => {
    expect(adapter).toBeInstanceOf(GenericHTML5Adapter);
    expect(typeof adapter.play).toBe("function");
    expect(typeof adapter.pause).toBe("function");
    expect(typeof adapter.seek).toBe("function");
    expect(typeof adapter.setPlaybackRate).toBe("function");
    expect(typeof adapter.getCurrentTime).toBe("function");
    expect(typeof adapter.getDuration).toBe("function");
    expect(typeof adapter.isPaused).toBe("function");
    expect(typeof adapter.on).toBe("function");
    expect(typeof adapter.off).toBe("function");
    expect(typeof adapter.destroy).toBe("function");
  });

  it("should throw not implemented errors for stub methods", async () => {
    await expect(adapter.play()).rejects.toThrow("Method not implemented.");
    await expect(adapter.pause()).rejects.toThrow("Method not implemented.");
    await expect(adapter.seek(60)).rejects.toThrow("Method not implemented.");
    await expect(adapter.setPlaybackRate(1.5)).rejects.toThrow(
      "Method not implemented.",
    );
    await expect(adapter.getCurrentTime()).rejects.toThrow(
      "Method not implemented.",
    );
    await expect(adapter.getDuration()).rejects.toThrow(
      "Method not implemented.",
    );
    await expect(adapter.isPaused()).rejects.toThrow("Method not implemented.");

    expect(() => adapter.on("play", vi.fn())).toThrow(
      "Method not implemented.",
    );
    expect(() => adapter.off("play", vi.fn())).toThrow(
      "Method not implemented.",
    );
    expect(() => adapter.destroy()).toThrow("Method not implemented.");
  });

  it("should be ready for future implementation", () => {
    // This test ensures the adapter exists and can be instantiated
    // Future implementation will replace the stub methods
    expect(adapter).toBeDefined();
    expect(document.querySelector).toBeDefined();
  });
});
