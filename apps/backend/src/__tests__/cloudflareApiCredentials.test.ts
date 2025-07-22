/**
 * Unit tests for Cloudflare API credentials integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCloudflareCredentials,
  revokeCloudflareCredentials,
  type CloudflareTurnResponse,
  type CloudflareApiError,
} from "../cloudflareApiCredentials";

// Mock fetch globally
global.fetch = vi.fn();

describe("cloudflareApiCredentials", () => {
  const mockTurnKeyId = "test-turn-key-id";
  const mockApiToken = "test-api-token";
  const mockTtl = 3600;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCloudflareCredentials", () => {
    it("should successfully generate credentials with valid API response", async () => {
      const mockResponse: CloudflareTurnResponse = {
        iceServers: [
          {
            urls: "turns:turn.cloudflare.com:443?transport=tcp",
            username: "1234567890:test-user",
            credential: "test-credential-1",
          },
          {
            urls: "turn:turn.cloudflare.com:3478?transport=udp",
            username: "1234567890:test-user",
            credential: "test-credential-2",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await generateCloudflareCredentials(
        mockTurnKeyId,
        mockApiToken,
        mockTtl,
      );

      expect(fetch).toHaveBeenCalledWith(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${mockTurnKeyId}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: mockTtl }),
        },
      );

      expect(result).toEqual({
        iceServers: mockResponse.iceServers,
        expiresAt: expect.any(Number),
        ttl: mockTtl,
      });

      // Verify expiresAt is approximately correct (within 5 seconds)
      const expectedExpiresAt = Math.floor(Date.now() / 1000) + mockTtl;
      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiresAt - 5);
      expect(result.expiresAt).toBeLessThanOrEqual(expectedExpiresAt + 5);
    });

    it("should use default TTL of 3600 seconds when not specified", async () => {
      const mockResponse: CloudflareTurnResponse = {
        iceServers: [
          {
            urls: "turns:turn.cloudflare.com:443?transport=tcp",
            username: "1234567890:test-user",
            credential: "test-credential",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await generateCloudflareCredentials(
        mockTurnKeyId,
        mockApiToken,
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ ttl: 3600 }),
        }),
      );

      expect(result.ttl).toBe(3600);
    });

    it("should handle HTTP error responses with JSON error details", async () => {
      const mockError: CloudflareApiError = {
        code: 1001,
        message: "Invalid TURN key ID",
        details: { keyId: mockTurnKeyId },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve(mockError),
      } as Response);

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow("Cloudflare TURN API error: Invalid TURN key ID");
    });

    it("should handle HTTP error responses without JSON error details", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.reject(new Error("Not JSON")),
      } as unknown as Response);

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow("Cloudflare TURN API error: HTTP 401: Unauthorized");
    });

    it("should handle invalid response format - missing iceServers", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow("Invalid response format: missing iceServers array");
    });

    it("should handle invalid ICE server format - missing urls field", async () => {
      const invalidResponse = {
        iceServers: [
          {
            // missing urls field - this is truly invalid
            username: "test-user",
            credential: "test-credential",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidResponse),
      } as Response);

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow("Invalid ICE server format: missing urls field");
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new Error("Network connection failed"),
      );

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow(
        "Failed to generate Cloudflare TURN credentials: Network connection failed",
      );
    });

    it("should handle unknown errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce("Unknown error type");

      await expect(
        generateCloudflareCredentials(mockTurnKeyId, mockApiToken),
      ).rejects.toThrow(
        "Failed to generate Cloudflare TURN credentials: Unknown error",
      );
    });
  });

  describe("revokeCloudflareCredentials", () => {
    const mockUsername = "1234567890:test-user";

    it("should successfully revoke credentials", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      await expect(
        revokeCloudflareCredentials(mockTurnKeyId, mockApiToken, mockUsername),
      ).resolves.toBeUndefined();

      expect(fetch).toHaveBeenCalledWith(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${mockTurnKeyId}/credentials/${mockUsername}/revoke`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
          },
        },
      );
    });

    it("should handle HTTP error responses with JSON error details", async () => {
      const mockError: CloudflareApiError = {
        code: 1002,
        message: "Credential not found",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve(mockError),
      } as Response);

      await expect(
        revokeCloudflareCredentials(mockTurnKeyId, mockApiToken, mockUsername),
      ).rejects.toThrow("Failed to revoke credentials: Credential not found");
    });

    it("should handle HTTP error responses without JSON error details", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.reject(new Error("Not JSON")),
      } as unknown as Response);

      await expect(
        revokeCloudflareCredentials(mockTurnKeyId, mockApiToken, mockUsername),
      ).rejects.toThrow("Failed to revoke credentials: HTTP 401: Unauthorized");
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new Error("Network connection failed"),
      );

      await expect(
        revokeCloudflareCredentials(mockTurnKeyId, mockApiToken, mockUsername),
      ).rejects.toThrow(
        "Failed to revoke Cloudflare TURN credentials: Network connection failed",
      );
    });

    it("should handle unknown errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce("Unknown error type");

      await expect(
        revokeCloudflareCredentials(mockTurnKeyId, mockApiToken, mockUsername),
      ).rejects.toThrow(
        "Failed to revoke Cloudflare TURN credentials: Unknown error",
      );
    });
  });
});
