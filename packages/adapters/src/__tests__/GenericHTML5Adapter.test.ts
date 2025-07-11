import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GenericHTML5Adapter } from "../GenericHTML5Adapter";

// Mock HTMLVideoElement
const createMockVideoElement = () => {
  const mockVideo = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    _currentTime: 0,
    duration: 120,
    paused: true,
    playbackRate: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
    })),
  };

  // Mock properties with getters/setters
  Object.defineProperty(mockVideo, "currentTime", {
    get: () => mockVideo._currentTime,
    set: (value) => {
      mockVideo._currentTime = value;
    },
    configurable: true,
  });

  return mockVideo as unknown as HTMLVideoElement;
};

describe("GenericHTML5Adapter", () => {
  let adapter: GenericHTML5Adapter;
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    mockVideo = createMockVideoElement();
    adapter = new GenericHTML5Adapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("interface implementation", () => {
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
  });

  describe("attachment", () => {
    it("should attach to video element in constructor", () => {
      new GenericHTML5Adapter(mockVideo);
      expect(mockVideo.addEventListener).toHaveBeenCalledTimes(5);
    });

    it("should attach to video element after construction", () => {
      adapter.attach(mockVideo);
      expect(mockVideo.addEventListener).toHaveBeenCalledTimes(5);
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        "play",
        expect.any(Function),
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        "pause",
        expect.any(Function),
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        "seeking",
        expect.any(Function),
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        "seeked",
        expect.any(Function),
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        "timeupdate",
        expect.any(Function),
      );
    });

    it("should detach from previous video when attaching to new one", () => {
      const video1 = createMockVideoElement();
      const video2 = createMockVideoElement();

      adapter.attach(video1);
      adapter.attach(video2);

      expect(video1.removeEventListener).toHaveBeenCalledTimes(5);
      expect(video2.addEventListener).toHaveBeenCalledTimes(5);
    });
  });

  describe("playback control", () => {
    beforeEach(() => {
      adapter.attach(mockVideo);
    });

    it("should play video", async () => {
      await adapter.play();
      expect(mockVideo.play).toHaveBeenCalled();
    });

    it("should handle autoplay errors", async () => {
      const error = new DOMException("", "NotAllowedError");
      (mockVideo.play as any).mockRejectedValueOnce(error);

      await expect(adapter.play()).rejects.toThrow(
        "Playback blocked by browser autoplay policy",
      );
    });

    it("should pause video", async () => {
      await adapter.pause();
      expect(mockVideo.pause).toHaveBeenCalled();
    });

    it("should seek to time", async () => {
      await adapter.seek(30);
      expect(mockVideo.currentTime).toBe(30);
    });

    it("should throw error for invalid seek time", async () => {
      await expect(adapter.seek(-1)).rejects.toThrow("Invalid seek time: -1");
      await expect(adapter.seek(150)).rejects.toThrow("Invalid seek time: 150");
    });

    it("should set playback rate", async () => {
      await adapter.setPlaybackRate(1.5);
      expect(mockVideo.playbackRate).toBe(1.5);
    });

    it("should throw error for invalid playback rate", async () => {
      await expect(adapter.setPlaybackRate(0)).rejects.toThrow(
        "Invalid playback rate: 0",
      );
      await expect(adapter.setPlaybackRate(17)).rejects.toThrow(
        "Invalid playback rate: 17",
      );
    });
  });

  describe("state methods", () => {
    beforeEach(() => {
      adapter.attach(mockVideo);
    });

    it("should get current time", async () => {
      mockVideo.currentTime = 45;
      const time = await adapter.getCurrentTime();
      expect(time).toBe(45);
    });

    it("should get duration", async () => {
      const duration = await adapter.getDuration();
      expect(duration).toBe(120);
    });

    it("should get paused state", async () => {
      const paused = await adapter.isPaused();
      expect(paused).toBe(true);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      adapter.attach(mockVideo);
    });

    it("should register and emit events", () => {
      const playCallback = vi.fn();
      const pauseCallback = vi.fn();

      adapter.on("play", playCallback);
      adapter.on("pause", pauseCallback);

      // Simulate DOM events
      const playHandler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "play",
      )[1];
      const pauseHandler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "pause",
      )[1];

      playHandler();
      pauseHandler();

      expect(playCallback).toHaveBeenCalled();
      expect(pauseCallback).toHaveBeenCalled();
    });

    it("should emit timeupdate with current time", () => {
      const timeupdateCallback = vi.fn();
      adapter.on("timeupdate", timeupdateCallback);

      mockVideo.currentTime = 60;

      const handler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "timeupdate",
      )[1];

      handler();

      expect(timeupdateCallback).toHaveBeenCalledWith({ currentTime: 60 });
    });

    it("should emit seeking with seek time", () => {
      const seekingCallback = vi.fn();
      adapter.on("seeking", seekingCallback);

      mockVideo.currentTime = 90;

      const handler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "seeking",
      )[1];

      handler();

      expect(seekingCallback).toHaveBeenCalledWith({ currentTime: 90 });
    });

    it("should unregister events", () => {
      const callback = vi.fn();
      adapter.on("play", callback);
      adapter.off("play", callback);

      const handler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "play",
      )[1];

      handler();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle errors in event callbacks", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      adapter.on("play", errorCallback);

      const handler = (mockVideo.addEventListener as any).mock.calls.find(
        (call: any[]) => call[0] === "play",
      )[1];

      handler();

      expect(consoleError).toHaveBeenCalledWith(
        "Error in adapter event listener for play:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should throw error when no video element attached", async () => {
      await expect(adapter.play()).rejects.toThrow(
        "No video element attached to adapter",
      );
      await expect(adapter.pause()).rejects.toThrow(
        "No video element attached to adapter",
      );
      await expect(adapter.seek(30)).rejects.toThrow(
        "No video element attached to adapter",
      );
      await expect(adapter.getCurrentTime()).rejects.toThrow(
        "No video element attached to adapter",
      );
    });
  });

  describe("cleanup", () => {
    it("should clean up on destroy", () => {
      adapter.attach(mockVideo);
      const callback = vi.fn();
      adapter.on("play", callback);

      adapter.destroy();

      expect(mockVideo.removeEventListener).toHaveBeenCalledTimes(5);

      // Try to use adapter after destroy
      expect(() => adapter.on("play", callback)).not.toThrow();
      // But callbacks should not be called
      expect(callback).not.toHaveBeenCalled();
    });

    it("should detach video element", () => {
      adapter.attach(mockVideo);
      adapter.detach();

      expect(mockVideo.removeEventListener).toHaveBeenCalledTimes(5);
    });
  });

  describe("static methods", () => {
    it("should find video elements", () => {
      const videos = [createMockVideoElement(), createMockVideoElement()];
      vi.spyOn(document, "querySelectorAll").mockReturnValue(videos as any);

      const found = GenericHTML5Adapter.findVideoElements();
      expect(found).toHaveLength(2);
    });

    it("should find primary video element", () => {
      const smallVideo = createMockVideoElement();
      (smallVideo.getBoundingClientRect as any).mockReturnValue({
        width: 640,
        height: 360,
        top: 0,
        left: 0,
      });

      const largeVideo = createMockVideoElement();
      (largeVideo.getBoundingClientRect as any).mockReturnValue({
        width: 1920,
        height: 1080,
        top: 0,
        left: 0,
      });

      const hiddenVideo = createMockVideoElement();
      (hiddenVideo.getBoundingClientRect as any).mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
      });

      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        smallVideo,
        largeVideo,
        hiddenVideo,
      ] as any);

      const primary = GenericHTML5Adapter.findPrimaryVideoElement();
      expect(primary).toBe(largeVideo);
    });

    it("should return null when no videos found", () => {
      vi.spyOn(document, "querySelectorAll").mockReturnValue([] as any);

      const primary = GenericHTML5Adapter.findPrimaryVideoElement();
      expect(primary).toBeNull();
    });

    it("should return single video when only one exists", () => {
      const video = createMockVideoElement();
      vi.spyOn(document, "querySelectorAll").mockReturnValue([video] as any);

      const primary = GenericHTML5Adapter.findPrimaryVideoElement();
      expect(primary).toBe(video);
    });
  });
});
