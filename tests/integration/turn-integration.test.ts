/**
 * Integration tests for TURN server functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TURNCredentialsManager,
  TURNCredentialError,
} from "../../apps/extension/src/utils/turnCredentials";
import {
  generateTURNCredentials,
  isTURNServiceConfigured,
} from "../../apps/backend/src/turnService";
import type { Env } from "../../apps/backend/src/index";
import type { CloudflareTURNResponse } from "@repo/types";

// Mock fetch for backend testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TURN Integration Tests", () => {
  let mockEnv: Env;
  let manager: TURNCredentialsManager;

  beforeEach(() => {
    mockEnv = {
      ROOM_STATE: {} as any,
      TURN_KEY_ID: "test-key-id",
      TURN_API_TOKEN: "test-api-token",
      TURN_API_ENDPOINT: "https://rtc.live.cloudflare.com/v1/turn",
      TURN_CREDENTIAL_TTL: "86400",
      TURN_REFRESH_THRESHOLD: "3600",
    };

    manager = new TURNCredentialsManager("https://test-backend.com");
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.clear();
  });

  describe("End-to-End TURN Credential Flow", () => {
    it("should complete full credential generation and caching flow", async () => {
      // Mock Cloudflare API response
      const cloudflareResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["stun:stun.cloudflare.com:3478"],
          },
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "1234567890:test-user",
            credential: "test-credential-hash",
          },
        ],
      };

      // Mock backend fetch (simulating backend calling Cloudflare)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => cloudflareResponse,
      });

      // Step 1: Backend generates credentials
      const backendCredentials = await generateTURNCredentials(mockEnv, {
        ttl: 86400,
      });
      expect(backendCredentials).toEqual(cloudflareResponse);

      // Step 2: Frontend requests credentials from backend
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => cloudflareResponse,
      });

      const frontendCredentials = await manager.getCredentials();

      // Step 3: Verify credentials are properly formatted
      expect(frontendCredentials).toBeDefined();
      expect(frontendCredentials?.username).toBe("1234567890:test-user");
      expect(frontendCredentials?.credential).toBe("test-credential-hash");
      expect(frontendCredentials?.urls).toEqual([
        "turn:turn.cloudflare.com:3478",
      ]);
      expect(frontendCredentials?.ttl).toBe(86400);
      expect(frontendCredentials?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should handle backend configuration errors gracefully", async () => {
      // Test unconfigured backend
      const unconfiguredEnv = { ...mockEnv };
      delete unconfiguredEnv.TURN_KEY_ID;

      expect(isTURNServiceConfigured(unconfiguredEnv)).toBe(false);

      // Frontend should handle this gracefully
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: "TURN service not configured",
          fallback: true,
        }),
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });

    it("should handle Cloudflare API failures with fallback", async () => {
      // Mock Cloudflare API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      // Backend should handle this and return appropriate error
      await expect(
        generateTURNCredentials(mockEnv, { ttl: 86400 }),
      ).rejects.toThrow("Failed to generate TURN credentials: 429");

      // Frontend should handle backend error gracefully
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "Rate limit exceeded",
          fallback: true,
        }),
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });

    it("should handle network connectivity issues", async () => {
      // Simulate network failure
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();
    });
  });

  describe("WebRTC Integration Scenarios", () => {
    it("should provide valid ICE server configuration", async () => {
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
          {
            urls: ["turns:turn.cloudflare.com:5349"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      // Should extract TURN server URLs correctly
      expect(credentials?.urls).toEqual(["turn:turn.cloudflare.com:3478"]);
      expect(credentials?.username).toBe("test-username");
      expect(credentials?.credential).toBe("test-credential");

      // Should be compatible with RTCIceServer format
      const iceServer = {
        urls: credentials?.urls,
        username: credentials?.username,
        credential: credentials?.credential,
      };

      expect(iceServer.urls).toBeDefined();
      expect(iceServer.username).toBeDefined();
      expect(iceServer.credential).toBeDefined();
    });

    it("should handle multiple TURN servers", async () => {
      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
          {
            urls: ["turns:turn.cloudflare.com:5349"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials = await manager.getCredentials();

      // Should use the first TURN server
      expect(credentials?.urls).toEqual(["turn:turn.cloudflare.com:3478"]);
    });

    it("should handle STUN-only responses", async () => {
      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["stun:stun.cloudflare.com:3478"],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Should throw error when no TURN servers are available
      await expect(manager.getCredentials()).rejects.toThrow(
        TURNCredentialError,
      );
    });
  });

  describe("Credential Refresh Scenarios", () => {
    it("should refresh credentials before expiration", async () => {
      const mockNow = vi.spyOn(Date, "now");
      mockNow.mockReturnValue(1000000);

      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      // Initial credential fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials1 = await manager.getCredentials();
      expect(credentials1).toBeDefined();

      // Simulate time passing (within refresh threshold)
      mockNow.mockReturnValue(1000000 + 83000000); // 83000 seconds later

      // Should trigger refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockResponse,
          iceServers: [
            {
              urls: ["turn:turn.cloudflare.com:3478"],
              username: "new-username",
              credential: "new-credential",
            },
          ],
        }),
      });

      const credentials2 = await manager.getCredentials();
      expect(credentials2?.username).toBe("new-username");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockNow.mockRestore();
    });

    it("should handle refresh failures gracefully", async () => {
      const mockNow = vi.spyOn(Date, "now");
      mockNow.mockReturnValue(1000000);

      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      // Initial credential fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await manager.getCredentials();

      // Simulate time passing (within refresh threshold)
      mockNow.mockReturnValue(1000000 + 83000000);

      // Refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: "Service temporarily unavailable",
          fallback: true,
        }),
      });

      const credentials = await manager.getCredentials();
      expect(credentials).toBeNull();

      mockNow.mockRestore();
    });
  });

  describe("Error Recovery Scenarios", () => {
    it("should recover from temporary network issues", async () => {
      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      const credentials1 = await manager.getCredentials();
      expect(credentials1).toBeNull();

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const credentials2 = await manager.getCredentials();
      expect(credentials2).toBeDefined();
      expect(credentials2?.username).toBe("test-username");
    });

    it("should handle concurrent credential requests", async () => {
      const mockResponse: CloudflareTURNResponse = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Make multiple concurrent requests
      const promises = [
        manager.getCredentials(),
        manager.getCredentials(),
        manager.getCredentials(),
      ];

      const results = await Promise.all(promises);

      // Should all return the same credentials
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);

      // Should only make one fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
