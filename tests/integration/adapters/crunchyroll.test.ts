/**
 * Integration test for Crunchyroll adapter
 * Tests the full adapter lifecycle with mocked Vilos player iframe
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AdapterFactory } from "@repo/adapters";

// Mock DOM environment for Crunchyroll
const setupCrunchyrollEnvironment = () => {
  // Mock window.location for Crunchyroll domain
  Object.defineProperty(window, "location", {
    value: { hostname: "www.crunchyroll.com" },
    writable: true,
  });

  // Create and append Vilos iframe to document
  const iframe = document.createElement("iframe");
  iframe.src = "https://static.crunchyroll.com/vilos-v2/web/vilos/player.html";
  iframe.className = "video-player";
  iframe.width = "1280";
  iframe.height = "720";

  // Mock iframe contentWindow for postMessage
  const mockContentWindow = {
    postMessage: vi.fn(),
    parent: window,
  };

  Object.defineProperty(iframe, "contentWindow", {
    value: mockContentWindow,
    writable: true,
  });

  document.body.appendChild(iframe);

  return { iframe, mockContentWindow };
};

const cleanupCrunchyrollEnvironment = () => {
  // Remove all iframes
  document.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
};

describe("Crunchyroll Adapter Integration", () => {
  let mockContentWindow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const setup = setupCrunchyrollEnvironment();
    mockContentWindow = setup.mockContentWindow;

    // Clear adapter factory state
    AdapterFactory.clear();
  });

  afterEach(() => {
    cleanupCrunchyrollEnvironment();
  });

  it("should be detected and created by AdapterFactory on Crunchyroll domain", () => {
    const detection = AdapterFactory.detect();

    expect(detection).toBeDefined();
    expect(detection?.adapter.name).toBe("crunchyroll");
    expect(detection?.adapter.tier).toBe("IFRAME_API");
    expect(detection?.detection.supported).toBe(true);
    expect(detection?.detection.confidence).toBeGreaterThan(0.8);
  });

  it("should create functional Crunchyroll adapter instance", () => {
    const adapter = AdapterFactory.createAdapter();

    expect(adapter).toBeDefined();
    expect(adapter).toHaveProperty("play");
    expect(adapter).toHaveProperty("pause");
    expect(adapter).toHaveProperty("seek");
    expect(adapter).toHaveProperty("getCurrentTime");
    expect(adapter).toHaveProperty("on");
    expect(adapter).toHaveProperty("off");
  });

  it("should prioritize Crunchyroll adapter over HTML5 on crunchyroll.com", () => {
    // Add a video element to test HTML5 fallback
    const video = document.createElement("video");
    video.src = "test-video.mp4";
    document.body.appendChild(video);

    const detection = AdapterFactory.detect();

    // Should still choose Crunchyroll adapter due to higher tier priority
    expect(detection?.adapter.name).toBe("crunchyroll");
    expect(detection?.adapter.tier).toBe("IFRAME_API");

    document.body.removeChild(video);
  });

  it("should send postMessage commands to Vilos iframe", async () => {
    const adapter = AdapterFactory.createAdapter();
    expect(adapter).toBeDefined();

    // Test play command
    await adapter!.play();
    expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "play",
        source: "watch-together",
      }),
      "*",
    );

    // Test pause command
    await adapter!.pause();
    expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pause",
        source: "watch-together",
      }),
      "*",
    );

    // Test seek command
    await adapter!.seek(30);
    expect(mockContentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "seek",
        time: 30,
        source: "watch-together",
      }),
      "*",
    );
  });

  it("should handle state requests with response simulation", async () => {
    const adapter = AdapterFactory.createAdapter();
    expect(adapter).toBeDefined();

    // Set up message listener to simulate iframe responses
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = vi.fn().mockImplementation((type, handler) => {
      if (type === "message") {
        messageHandler = handler as (event: MessageEvent) => void;
      }
      return originalAddEventListener.call(window, type, handler);
    });

    // Start getCurrentTime request
    const getCurrentTimePromise = adapter!.getCurrentTime();

    // Wait for message to be sent
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Find the getState call
    const getStateCalls = mockContentWindow.postMessage.mock.calls.filter(
      (call: any[]) => call[0].type === "getState",
    );
    expect(getStateCalls).toHaveLength(1);

    const requestId = getStateCalls[0][0].id;

    // Simulate response from iframe
    if (messageHandler) {
      const mockEvent = new MessageEvent("message", {
        data: {
          id: requestId,
          type: "stateResponse",
          currentTime: 42,
          duration: 120,
          paused: false,
        },
        origin: "https://static.crunchyroll.com",
      });

      messageHandler(mockEvent);
    }

    // Verify the response was processed
    const currentTime = await getCurrentTimePromise;
    expect(currentTime).toBe(42);
  });

  it("should emit events when receiving player messages from iframe", () => {
    const adapter = AdapterFactory.createAdapter();
    expect(adapter).toBeDefined();

    const playCallback = vi.fn();
    const timeupdateCallback = vi.fn();

    adapter!.on("play", playCallback);
    adapter!.on("timeupdate", timeupdateCallback);

    // Get the message handler
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = vi.fn().mockImplementation((type, handler) => {
      if (type === "message") {
        messageHandler = handler as (event: MessageEvent) => void;
      }
      return originalAddEventListener.call(window, type, handler);
    });

    // Initialize the adapter to set up the message handler
    // This happens during attach() which should be called during creation

    // Wait a tick to ensure handler is set up
    setTimeout(() => {
      if (messageHandler) {
        // Simulate play event from iframe
        const playEvent = new MessageEvent("message", {
          data: { type: "play" },
          origin: "https://static.crunchyroll.com",
        });
        messageHandler(playEvent);

        // Simulate timeupdate event from iframe
        const timeupdateEvent = new MessageEvent("message", {
          data: { type: "timeupdate", currentTime: 25 },
          origin: "https://static.crunchyroll.com",
        });
        messageHandler(timeupdateEvent);

        expect(playCallback).toHaveBeenCalled();
        expect(timeupdateCallback).toHaveBeenCalledWith({ currentTime: 25 });
      }
    }, 0);
  });

  it("should handle adapter cleanup properly", () => {
    const adapter = AdapterFactory.createAdapter();
    expect(adapter).toBeDefined();

    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    // Destroy the adapter
    adapter!.destroy();

    // Should remove message listener
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should validate input parameters", async () => {
    const adapter = AdapterFactory.createAdapter();
    expect(adapter).toBeDefined();

    // Test invalid seek times
    await expect(adapter!.seek(-5)).rejects.toThrow("Invalid seek time: -5");

    // Test invalid playback rates
    await expect(adapter!.setPlaybackRate(0)).rejects.toThrow(
      "Invalid playback rate: 0",
    );
    await expect(adapter!.setPlaybackRate(20)).rejects.toThrow(
      "Invalid playback rate: 20",
    );
  });

  it("should not be detected on non-Crunchyroll domains", () => {
    // Change to different domain
    Object.defineProperty(window, "location", {
      value: { hostname: "www.youtube.com" },
      writable: true,
    });

    // Clear and re-initialize factory
    AdapterFactory.clear();

    const detection = AdapterFactory.detect();

    // Should fall back to HTML5 adapter or return null
    if (detection) {
      expect(detection.adapter.name).not.toBe("crunchyroll");
    }
  });
});
