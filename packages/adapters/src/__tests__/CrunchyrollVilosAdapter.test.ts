import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CrunchyrollVilosAdapter } from "../CrunchyrollVilosAdapter";

// Mock video element
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
    tagName: "VIDEO",
    id: "player0",
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

// Mock DOM environment
const setupVilosIframeMock = () => {
  // Mock window.location for Vilos iframe
  Object.defineProperty(window, "location", {
    value: {
      href: "https://static.crunchyroll.com/vilos-v2/web/vilos/player.html",
      hostname: "static.crunchyroll.com",
    },
    writable: true,
  });

  // Mock window hierarchy to simulate iframe
  Object.defineProperty(window, "top", {
    value: {
      /* different window object */
    },
    writable: true,
  });

  // Mock document.getElementById for player0
  const mockVideo = createMockVideoElement();
  vi.spyOn(document, "getElementById").mockImplementation((id) => {
    if (id === "player0") {
      return mockVideo;
    }
    return null;
  });

  return mockVideo;
};

describe("CrunchyrollVilosAdapter", () => {
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVideo = setupVilosIframeMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("iframe detection", () => {
    it("should detect Vilos iframe environment", () => {
      expect(CrunchyrollVilosAdapter.isVilosIframe()).toBe(true);
    });

    it("should not detect when not in iframe", () => {
      // Mock as main window
      Object.defineProperty(window, "top", {
        value: window,
        writable: true,
      });

      expect(CrunchyrollVilosAdapter.isVilosIframe()).toBe(false);
    });

    it("should not detect on wrong domain", () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "https://example.com/player.html",
          hostname: "example.com",
        },
        writable: true,
      });

      expect(CrunchyrollVilosAdapter.isVilosIframe()).toBe(false);
    });
  });

  describe("player0 element detection", () => {
    it("should find player0 video element", () => {
      const found = CrunchyrollVilosAdapter.findPlayer0Element();
      expect(found).toBe(mockVideo);
      expect(document.getElementById).toHaveBeenCalledWith("player0");
    });

    it("should return null when player0 not found", () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      const found = CrunchyrollVilosAdapter.findPlayer0Element();
      expect(found).toBeNull();
    });

    it("should return null when player0 is not a video element", () => {
      const mockDiv = document.createElement("div");
      mockDiv.id = "player0";
      vi.spyOn(document, "getElementById").mockReturnValue(mockDiv);

      const found = CrunchyrollVilosAdapter.findPlayer0Element();
      expect(found).toBeNull();
    });
  });

  describe("adapter detection", () => {
    it("should detect successfully in Vilos iframe with player0", () => {
      const result = CrunchyrollVilosAdapter.detect();
      expect(result.supported).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.tier).toBe("HTML5");
    });

    it("should not detect when not in Vilos iframe", () => {
      Object.defineProperty(window, "top", {
        value: window,
        writable: true,
      });

      const result = CrunchyrollVilosAdapter.detect();
      expect(result.supported).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should not detect when player0 not found", () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      const result = CrunchyrollVilosAdapter.detect();
      expect(result.supported).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe("adapter creation", () => {
    it("should create adapter successfully", () => {
      const adapter = CrunchyrollVilosAdapter.create();
      expect(adapter).toBeInstanceOf(CrunchyrollVilosAdapter);
    });

    it("should throw error when player0 not found", () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      expect(() => CrunchyrollVilosAdapter.create()).toThrow(
        "Cannot create CrunchyrollVilosAdapter: player0 element not found",
      );
    });
  });

  describe("wait for player0", () => {
    it("should return player0 immediately if available", async () => {
      const result = await CrunchyrollVilosAdapter.waitForPlayer0(5, 100);
      expect(result).toBe(mockVideo);
    });

    it("should wait and retry if player0 not initially available", async () => {
      let callCount = 0;
      vi.spyOn(document, "getElementById").mockImplementation((id) => {
        if (id === "player0") {
          callCount++;
          return callCount >= 3 ? mockVideo : null;
        }
        return null;
      });

      const result = await CrunchyrollVilosAdapter.waitForPlayer0(5, 50);
      expect(result).toBe(mockVideo);
      expect(callCount).toBe(3);
    });

    it("should return null after max attempts", async () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      const result = await CrunchyrollVilosAdapter.waitForPlayer0(2, 10);
      expect(result).toBeNull();
    });
  });

  describe("createWhenReady", () => {
    it("should create adapter when player0 becomes available", async () => {
      const adapter = await CrunchyrollVilosAdapter.createWhenReady();
      expect(adapter).toBeInstanceOf(CrunchyrollVilosAdapter);
    });

    it("should return null if player0 never becomes available", async () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      // Override waitForPlayer0 to use shorter timeout for testing
      const originalWaitForPlayer0 = CrunchyrollVilosAdapter.waitForPlayer0;
      CrunchyrollVilosAdapter.waitForPlayer0 = vi.fn().mockResolvedValue(null);

      const adapter = await CrunchyrollVilosAdapter.createWhenReady();
      expect(adapter).toBeNull();

      // Restore original method
      CrunchyrollVilosAdapter.waitForPlayer0 = originalWaitForPlayer0;
    });
  });

  describe("inheritance from GenericHTML5Adapter", () => {
    it("should have correct static properties", () => {
      expect(CrunchyrollVilosAdapter.tier).toBe("HTML5");
      expect(CrunchyrollVilosAdapter.domains).toEqual([
        "static.crunchyroll.com",
      ]);
    });

    it("should inherit video control methods", async () => {
      const adapter = CrunchyrollVilosAdapter.create();

      await adapter.play();
      expect(mockVideo.play).toHaveBeenCalled();

      await adapter.pause();
      expect(mockVideo.pause).toHaveBeenCalled();

      await adapter.seek(30);
      expect(mockVideo.currentTime).toBe(30);
    });
  });
});
