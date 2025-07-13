import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CrunchyrollAdapter } from "../CrunchyrollAdapter";

// Mock iframe element for Vilos player
const createMockIframe = () => {
  const mockIframe = {
    src: "https://static.crunchyroll.com/vilos-v2/web/vilos/player.html",
    className: "video-player",
    contentWindow: {
      postMessage: vi.fn(),
      parent: window,
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
    })),
  };

  return mockIframe as unknown as HTMLIFrameElement;
};

// Mock window.postMessage for testing
const createMockWindow = () => {
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    restore: () => {
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
    },
  };
};

describe("CrunchyrollAdapter", () => {
  let adapter: CrunchyrollAdapter;
  let mockIframe: HTMLIFrameElement;
  let mockWindow: ReturnType<typeof createMockWindow>;

  beforeEach(() => {
    mockIframe = createMockIframe();
    mockWindow = createMockWindow();

    // Mock global window methods
    window.addEventListener = mockWindow.addEventListener;
    window.removeEventListener = mockWindow.removeEventListener;

    adapter = new CrunchyrollAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockWindow.restore();
  });

  describe("interface implementation", () => {
    it("should implement IPlayerAdapter interface", () => {
      expect(adapter).toBeInstanceOf(CrunchyrollAdapter);
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

  describe("iframe detection", () => {
    it("should detect Vilos player iframe", () => {
      const iframe = document.createElement("iframe");
      iframe.src =
        "https://static.crunchyroll.com/vilos-v2/web/vilos/player.html";
      iframe.className = "video-player";
      document.body.appendChild(iframe);

      vi.spyOn(document, "querySelector").mockReturnValue(iframe);

      const found = CrunchyrollAdapter.findVilosIframe();
      expect(found).toBe(iframe);

      document.body.removeChild(iframe);
    });

    it("should return null when no Vilos iframe found", () => {
      vi.spyOn(document, "querySelector").mockReturnValue(null);

      const found = CrunchyrollAdapter.findVilosIframe();
      expect(found).toBeNull();
    });
  });

  describe("iframe attachment", () => {
    it("should attach to iframe in constructor", () => {
      new CrunchyrollAdapter(mockIframe);
      expect(window.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should attach to iframe after construction", () => {
      adapter.attach(mockIframe);
      expect(window.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should detach from previous iframe when attaching to new one", () => {
      const iframe1 = createMockIframe();
      const iframe2 = createMockIframe();

      adapter.attach(iframe1);
      adapter.attach(iframe2);

      // Should remove old listener and add new one
      expect(window.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });
  });

  describe("postMessage communication", () => {
    beforeEach(() => {
      adapter.attach(mockIframe);
    });

    it("should send play command via postMessage", async () => {
      await adapter.play();
      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        { type: "play", source: "watch-together" },
        "*",
      );
    });

    it("should send pause command via postMessage", async () => {
      await adapter.pause();
      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        { type: "pause", source: "watch-together" },
        "*",
      );
    });

    it("should send seek command via postMessage", async () => {
      await adapter.seek(30);
      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        { type: "seek", time: 30, source: "watch-together" },
        "*",
      );
    });

    it("should send playback rate command via postMessage", async () => {
      await adapter.setPlaybackRate(1.5);
      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        { type: "setPlaybackRate", rate: 1.5, source: "watch-together" },
        "*",
      );
    });

    it("should request current state via postMessage", async () => {
      const getCurrentTimePromise = adapter.getCurrentTime();

      // Wait a tick for the message to be sent
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "getState",
          source: "watch-together",
          id: expect.any(String),
        }),
        "*",
      );

      // Get the request ID from the call
      const call = (mockIframe.contentWindow!.postMessage as any).mock.calls[0];
      const requestId = call[0].id;

      // Simulate response from iframe
      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      const mockEvent = new MessageEvent("message", {
        data: {
          id: requestId,
          type: "stateResponse",
          currentTime: 45,
          duration: 120,
          paused: false,
        },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(mockEvent);

      const currentTime = await getCurrentTimePromise;
      expect(currentTime).toBe(45);
    });
  });

  describe("error handling", () => {
    it("should throw error when no iframe attached", async () => {
      await expect(adapter.play()).rejects.toThrow(
        "No iframe attached to adapter",
      );
      await expect(adapter.pause()).rejects.toThrow(
        "No iframe attached to adapter",
      );
      await expect(adapter.seek(30)).rejects.toThrow(
        "No iframe attached to adapter",
      );
      await expect(adapter.getCurrentTime()).rejects.toThrow(
        "No iframe attached to adapter",
      );
    });

    it("should handle postMessage timeout", async () => {
      adapter.attach(mockIframe);

      // Override timeout for faster testing
      (adapter as any).messageTimeout = 100;

      // Don't simulate a response - should timeout
      await expect(adapter.getCurrentTime()).rejects.toThrow(
        "Timeout waiting for player response",
      );
    }, 1000);

    it("should validate seek time bounds", async () => {
      adapter.attach(mockIframe);

      await expect(adapter.seek(-1)).rejects.toThrow("Invalid seek time: -1");
      // Note: Upper bound check requires knowing duration
    });

    it("should validate playback rate bounds", async () => {
      adapter.attach(mockIframe);

      await expect(adapter.setPlaybackRate(0)).rejects.toThrow(
        "Invalid playback rate: 0",
      );
      await expect(adapter.setPlaybackRate(17)).rejects.toThrow(
        "Invalid playback rate: 17",
      );
    });

    it("should handle iframe without contentWindow", async () => {
      const iframeWithoutWindow = { ...mockIframe, contentWindow: null };

      // Override waitForIframeReady to fail immediately for this test
      (adapter as any).waitForIframeReady = vi
        .fn()
        .mockRejectedValue(new Error("Iframe failed to become ready"));

      adapter.attach(iframeWithoutWindow as HTMLIFrameElement);

      await expect(adapter.play()).rejects.toThrow(
        "Iframe failed to become ready",
      );
    });
  });

  describe("message filtering", () => {
    beforeEach(() => {
      adapter.attach(mockIframe);
    });

    it("should only handle messages from Crunchyroll origin", () => {
      const callback = vi.fn();
      adapter.on("play", callback);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      // Message from wrong origin should be ignored
      const wrongOriginEvent = new MessageEvent("message", {
        data: { type: "play" },
        origin: "https://malicious-site.com",
      });

      messageHandler(wrongOriginEvent);
      expect(callback).not.toHaveBeenCalled();

      // Message from correct origin should be handled
      const correctOriginEvent = new MessageEvent("message", {
        data: { type: "play" },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(correctOriginEvent);
      expect(callback).toHaveBeenCalled();
    });

    it("should filter player-related messages", () => {
      const callback = vi.fn();
      adapter.on("play", callback);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      // Non-player message should be ignored
      const nonPlayerEvent = new MessageEvent("message", {
        data: { type: "analytics", event: "click" },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(nonPlayerEvent);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      adapter.attach(mockIframe);
    });

    it("should emit play event when received from iframe", () => {
      const playCallback = vi.fn();
      adapter.on("play", playCallback);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      const playEvent = new MessageEvent("message", {
        data: { type: "play" },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(playEvent);
      expect(playCallback).toHaveBeenCalled();
    });

    it("should emit timeupdate with current time", () => {
      const timeupdateCallback = vi.fn();
      adapter.on("timeupdate", timeupdateCallback);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      const timeupdateEvent = new MessageEvent("message", {
        data: { type: "timeupdate", currentTime: 60 },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(timeupdateEvent);
      expect(timeupdateCallback).toHaveBeenCalledWith({ currentTime: 60 });
    });

    it("should unregister event callbacks", () => {
      const callback = vi.fn();
      adapter.on("play", callback);
      adapter.off("play", callback);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "message",
      )?.[1] as EventListener;

      const playEvent = new MessageEvent("message", {
        data: { type: "play" },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(playEvent);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should clean up on destroy", () => {
      adapter.attach(mockIframe);
      const callback = vi.fn();
      adapter.on("play", callback);

      adapter.destroy();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });

    it("should detach iframe", () => {
      adapter.attach(mockIframe);
      adapter.detach();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
    });
  });

  describe("static methods", () => {
    it("should detect Crunchyroll domain", () => {
      // Mock window.location.hostname
      Object.defineProperty(window, "location", {
        value: { hostname: "www.crunchyroll.com" },
        writable: true,
      });

      // Mock document.querySelector to return a Vilos iframe
      const mockIframe = document.createElement("iframe");
      mockIframe.src =
        "https://static.crunchyroll.com/vilos-v2/web/vilos/player.html";
      vi.spyOn(document, "querySelector").mockReturnValue(mockIframe);

      const result = CrunchyrollAdapter.detect();
      expect(result.supported).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.tier).toBe("IFRAME_API");
    });

    it("should have IFRAME_API tier", () => {
      expect(CrunchyrollAdapter.tier).toBe("IFRAME_API");
    });

    it("should match crunchyroll.com domain", () => {
      expect(CrunchyrollAdapter.domains).toContain("crunchyroll.com");
    });
  });

  describe("retry mechanism", () => {
    beforeEach(() => {
      adapter.attach(mockIframe);
    });

    it("should retry failed postMessage commands", async () => {
      // Mock contentWindow.postMessage to fail first time
      let callCount = 0;
      mockIframe.contentWindow!.postMessage = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("postMessage failed");
        }
      });

      await adapter.play();

      // Should have been called twice (initial + retry)
      expect(mockIframe.contentWindow!.postMessage).toHaveBeenCalledTimes(2);
    });

    it("should give up after max retries", async () => {
      // Mock contentWindow.postMessage to always fail
      mockIframe.contentWindow!.postMessage = vi.fn(() => {
        throw new Error("postMessage always fails");
      });

      await expect(adapter.play()).rejects.toThrow(
        "Failed to send message after retries",
      );
    });
  });

  describe("iframe readiness", () => {
    it("should wait for iframe to be ready before sending commands", async () => {
      // Create iframe without contentWindow initially
      const notReadyIframe = {
        ...mockIframe,
        contentWindow: null as Window | null,
      };

      // Override the waitForIframeReady to simulate quick readiness
      const originalWaitForIframeReady = (adapter as any).waitForIframeReady;
      (adapter as any).waitForIframeReady = vi
        .fn()
        .mockImplementation(async () => {
          // Simulate iframe becoming ready immediately
          (notReadyIframe as any).contentWindow = mockIframe.contentWindow;
        });

      adapter.attach(notReadyIframe as HTMLIFrameElement);

      // Start a play command
      await adapter.play();

      // Should have sent the message after iframe became ready
      expect(mockIframe.contentWindow?.postMessage).toHaveBeenCalledWith(
        { type: "play", source: "watch-together" },
        "*",
      );

      // Restore original method
      (adapter as any).waitForIframeReady = originalWaitForIframeReady;
    });
  });
});
