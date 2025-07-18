/**
 * Tests for TURN credentials manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TURNCredentialsManager } from "../turnCredentials";
import type { CloudflareTURNResponse } from "@repo/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock setTimeout and clearTimeout
const mockSetTimeout = vi.fn().mockReturnValue(123);
const mockClearTimeout = vi.fn();
global.setTimeout = mockSetTimeout as any;
global.clearTimeout = mockClearTimeout as any;

describe("TURNCredentialsManager", () => {
  let manager: TURNCredentialsManager;
  const backendUrl = "https://example.com";
  const mockResponse: CloudflareTURNResponse = {
    iceServers: [
      {
        urls: ["stun:stun.cloudflare.com:3478"],
      },
      {
        urls: ["turn:turn.cloudflare.com:3478"],
        username: "test-username",
        credential: "test-credential",
      },
    ],
  };

  beforeEach(() => {
    manager = new TURNCredentialsManager(backendUrl);
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.clear();
  });

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      expect(manager).toBeDefined();
      expect(manager.getCurrentCredentials()).toBeNull();
    });

    it("should handle backend URL with trailing slash", () => {
      const managerWithSlash = new TURNCredentialsManager(
        "https://example.com/",
      );
      expect(managerWithSlash).toBeDefined();
    });

    it("should accept custom configuration", () => {
      const customConfig = {
        credentialTtl: 3600,
        refreshThreshold: 600,
        maxRetries: 5,
      };
      const customManager = new TURNCredentialsManager(
        backendUrl,
        customConfig,
      );
      expect(customManager).toBeDefined();
    });
  });

  describe("getCredentials", () => {
    it("should fetch new credentials when none exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeDefined();
      expect(credentials?.username).toBe("test-username");
      expect(credentials?.credential).toBe("test-credential");
      expect(credentials?.urls).toEqual(["turn:turn.cloudflare.com:3478"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/api/turn/credentials",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ttl: 86400 }),
        }),
      );
    });

    it("should return existing valid credentials", async () => {
      // First call to fetch credentials
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials1 = await manager.getCredentials();

      // Second call should return cached credentials without fetching
      mockFetch.mockClear();
      const credentials2 = await manager.getCredentials();

      expect(credentials1).toBe(credentials2);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should refresh expired credentials", async () => {
      // Mock Date.now to simulate credential expiration
      const mockNow = vi.spyOn(Date, "now");
      mockNow.mockReturnValue(1000000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();

      // Simulate time passing (credentials should be within refresh threshold)
      mockNow.mockReturnValue(1000000 + 85000000); // 85000 seconds later

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockNow.mockRestore();
    });

    it("should handle fetch errors and return null for fallback", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "Service unavailable", fallback: true }),
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeNull();
      expect(manager.getCurrentCredentials()).toBeNull();
    });

    it("should return null after retries for non-fallback failures", async () => {
      // Mock all retry attempts to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Max retries
    });

    it("should handle network errors with fallback", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const credentials = await manager.getCredentials();

      expect(credentials).toBeNull();
    });
  });

  describe("refreshCredentials", () => {
    it("should force refresh credentials", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.refreshCredentials();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(manager.getCurrentCredentials()).toBeDefined();
    });
  });

  describe("credential validation", () => {
    it("should validate credentials are not expired", async () => {
      const mockNow = vi.spyOn(Date, "now");
      mockNow.mockReturnValue(1000000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeDefined();
      expect(credentials?.expiresAt).toBeGreaterThan(Date.now());

      mockNow.mockRestore();
    });

    it("should handle credentials within refresh threshold", async () => {
      const mockNow = vi.spyOn(Date, "now");
      mockNow.mockReturnValue(1000000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();

      // Simulate time passing to within refresh threshold
      mockNow.mockReturnValue(1000000 + 83000000); // 83000 seconds later (within 1 hour refresh threshold)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockNow.mockRestore();
    });
  });

  describe("retry logic", () => {
    it("should retry on temporary failures", async () => {
      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal server error" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should give up after max retries", async () => {
      // All calls fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Default maxRetries
    });

    it("should use exponential backoff", async () => {
      const mockSetTimeoutPromise = vi
        .fn()
        .mockImplementation((callback) => {
          // Immediately call the callback for test purposes
          callback();
          return 123;
        });
      global.setTimeout = mockSetTimeoutPromise as any;

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      const credentials = await manager.getCredentials();

      expect(credentials).toBeNull();
      expect(mockSetTimeoutPromise).toHaveBeenCalled();
    });
  });

  describe("automatic refresh scheduling", () => {
    it("should schedule automatic refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();

      expect(mockSetTimeout).toHaveBeenCalled();
    });

    it("should clear previous refresh timeout", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();
      await manager.refreshCredentials();

      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear credentials and cancel refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();
      expect(manager.getCurrentCredentials()).toBeDefined();

      manager.clear();
      expect(manager.getCurrentCredentials()).toBeNull();
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle invalid response format", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });

    it("should handle response with no TURN servers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
        }),
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });

    it("should handle JSON parsing errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });
  });
});
