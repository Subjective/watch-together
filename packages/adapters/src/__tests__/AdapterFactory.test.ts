import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AdapterFactory, type AdapterConfig } from "../AdapterFactory";
import { GenericHTML5Adapter } from "../GenericHTML5Adapter";

// Mock window.location
const mockLocation = {
  hostname: "example.com",
};

Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("AdapterFactory", () => {
  beforeEach(() => {
    AdapterFactory.clear();
    mockLocation.hostname = "example.com";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with default adapters", () => {
      AdapterFactory.initialize();
      const adapters = AdapterFactory.getAllAdapters();
      expect(adapters).toHaveLength(1);

      // Should have HTML5 adapter (fallback)
      const html5Adapter = adapters.find((a) => a.name === "generic-html5");
      expect(html5Adapter).toBeDefined();
      expect(html5Adapter?.tier).toBe("HTML5");
    });

    it("should not re-initialize if already initialized", () => {
      AdapterFactory.initialize();
      const initialCount = AdapterFactory.getAllAdapters().length;

      AdapterFactory.initialize();
      expect(AdapterFactory.getAllAdapters().length).toBe(initialCount);
    });
  });

  describe("adapter registration", () => {
    it("should register new adapter", () => {
      const testAdapter: AdapterConfig = {
        name: "test-adapter",
        tier: "PROPRIETARY",
        domains: ["test.com"],
        detect: () => ({ supported: true, confidence: 1, tier: "PROPRIETARY" }),
        create: () => null,
      };

      AdapterFactory.register(testAdapter);
      const registered = AdapterFactory.getAdapter("test-adapter");
      expect(registered).toEqual(testAdapter);
    });

    it("should unregister adapter", () => {
      const testAdapter: AdapterConfig = {
        name: "test-adapter",
        tier: "PROPRIETARY",
        domains: ["test.com"],
        detect: () => ({ supported: true, confidence: 1, tier: "PROPRIETARY" }),
        create: () => null,
      };

      AdapterFactory.register(testAdapter);
      AdapterFactory.unregister("test-adapter");
      expect(AdapterFactory.getAdapter("test-adapter")).toBeUndefined();
    });
  });

  describe("adapter detection", () => {
    it("should detect HTML5 adapter when video element exists", () => {
      const mockVideo = document.createElement("video");
      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);

      const result = AdapterFactory.detect();
      expect(result).toBeTruthy();
      expect(result?.adapter.name).toBe("generic-html5");
      expect(result?.detection.tier).toBe("HTML5");
    });

    it("should return null when no adapters match", () => {
      vi.spyOn(document, "querySelectorAll").mockReturnValue([] as any);

      const result = AdapterFactory.detect();
      expect(result).toBeNull();
    });

    it("should prioritize higher tier adapters", () => {
      const mockVideo = document.createElement("video");
      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);

      // Register a proprietary adapter
      const proprietaryAdapter: AdapterConfig = {
        name: "proprietary",
        tier: "PROPRIETARY",
        domains: ["*"],
        detect: () => ({
          supported: true,
          confidence: 0.8,
          tier: "PROPRIETARY",
        }),
        create: () => null,
      };

      AdapterFactory.register(proprietaryAdapter);

      const result = AdapterFactory.detect();
      expect(result?.adapter.name).toBe("proprietary");
    });

    it("should prioritize by confidence when tiers are equal", () => {
      const mockVideo = document.createElement("video");
      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);

      const adapter1: AdapterConfig = {
        name: "adapter1",
        tier: "HTML5",
        domains: ["*"],
        detect: () => ({ supported: true, confidence: 0.7, tier: "HTML5" }),
        create: () => null,
      };

      const adapter2: AdapterConfig = {
        name: "adapter2",
        tier: "HTML5",
        domains: ["*"],
        detect: () => ({ supported: true, confidence: 0.9, tier: "HTML5" }),
        create: () => null,
      };

      AdapterFactory.register(adapter1);
      AdapterFactory.register(adapter2);

      const result = AdapterFactory.detect();
      expect(result?.adapter.name).toBe("adapter2");
    });

    it("should check domain matching", () => {
      mockLocation.hostname = "youtube.com";

      const youtubeAdapter: AdapterConfig = {
        name: "youtube",
        tier: "IFRAME_API",
        domains: ["youtube.com", "youtu.be"],
        detect: () => ({ supported: true, confidence: 1, tier: "IFRAME_API" }),
        create: () => null,
      };

      const netflixAdapter: AdapterConfig = {
        name: "netflix",
        tier: "PROPRIETARY",
        domains: ["netflix.com"],
        detect: () => ({ supported: true, confidence: 1, tier: "PROPRIETARY" }),
        create: () => null,
      };

      AdapterFactory.register(youtubeAdapter);
      AdapterFactory.register(netflixAdapter);

      const result = AdapterFactory.detect();
      expect(result?.adapter.name).toBe("youtube");
    });
  });

  describe("adapter creation", () => {
    it("should create adapter successfully", () => {
      const mockVideo = document.createElement("video");

      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);
      vi.spyOn(GenericHTML5Adapter, "findPrimaryVideoElement").mockReturnValue(
        mockVideo,
      );

      const adapter = AdapterFactory.createAdapter();
      expect(adapter).toBeInstanceOf(GenericHTML5Adapter);
    });

    it("should return null when no adapter can be created", () => {
      vi.spyOn(document, "querySelectorAll").mockReturnValue([] as any);
      vi.spyOn(GenericHTML5Adapter, "findPrimaryVideoElement").mockReturnValue(
        null,
      );

      const adapter = AdapterFactory.createAdapter();
      expect(adapter).toBeNull();
    });

    it("should handle adapter creation errors", () => {
      const mockVideo = document.createElement("video");
      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);

      const errorAdapter: AdapterConfig = {
        name: "error-adapter",
        tier: "PROPRIETARY",
        domains: ["*"],
        detect: () => ({ supported: true, confidence: 1, tier: "PROPRIETARY" }),
        create: () => {
          throw new Error("Creation failed");
        },
      };

      AdapterFactory.register(errorAdapter);

      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const adapter = AdapterFactory.createAdapter();

      expect(adapter).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "[AdapterFactory] Failed to create error-adapter adapter:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });

    it("should log successful adapter creation", () => {
      const mockVideo = document.createElement("video");
      vi.spyOn(document, "querySelectorAll").mockReturnValue([
        mockVideo,
      ] as any);
      vi.spyOn(GenericHTML5Adapter, "findPrimaryVideoElement").mockReturnValue(
        mockVideo,
      );

      const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
      AdapterFactory.createAdapter();

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "[AdapterFactory] Created generic-html5 adapter",
        ),
      );

      consoleLog.mockRestore();
    });
  });

  describe("utility methods", () => {
    it("should get all adapters", () => {
      const adapter1: AdapterConfig = {
        name: "adapter1",
        tier: "HTML5",
        domains: ["*"],
        detect: () => ({ supported: true, confidence: 1, tier: "HTML5" }),
        create: () => null,
      };

      const adapter2: AdapterConfig = {
        name: "adapter2",
        tier: "PROPRIETARY",
        domains: ["*"],
        detect: () => ({ supported: true, confidence: 1, tier: "PROPRIETARY" }),
        create: () => null,
      };

      AdapterFactory.register(adapter1);
      AdapterFactory.register(adapter2);

      const adapters = AdapterFactory.getAllAdapters();
      expect(adapters).toHaveLength(2);
      expect(adapters.map((a) => a.name)).toContain("adapter1");
      expect(adapters.map((a) => a.name)).toContain("adapter2");
    });

    it("should clear all adapters", () => {
      AdapterFactory.initialize();
      expect(AdapterFactory.getAllAdapters().length).toBeGreaterThan(0);

      AdapterFactory.clear();
      expect(AdapterFactory.getAllAdapters()).toHaveLength(0);
    });
  });
});
