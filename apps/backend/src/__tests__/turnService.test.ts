/**
 * Tests for TURN service integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateTURNCredentials,
  isTURNServiceConfigured,
  getDefaultTTL,
  getRefreshThreshold,
  TURNServiceError,
} from "../turnService";
import type { Env } from "../index";
import type {
  TURNCredentialRequest,
  CloudflareTURNResponse,
} from "@repo/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TURN Service", () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      ROOM_STATE: {} as DurableObjectNamespace,
      TURN_KEY_ID: "test-key-id",
      TURN_API_TOKEN: "test-api-token",
      TURN_API_ENDPOINT: "https://rtc.live.cloudflare.com/v1/turn",
      TURN_CREDENTIAL_TTL: "86400",
      TURN_REFRESH_THRESHOLD: "3600",
    };

    vi.clearAllMocks();
  });

  describe("isTURNServiceConfigured", () => {
    it("should return true when all required environment variables are set", () => {
      expect(isTURNServiceConfigured(mockEnv)).toBe(true);
    });

    it("should return false when TURN_KEY_ID is missing", () => {
      delete mockEnv.TURN_KEY_ID;
      expect(isTURNServiceConfigured(mockEnv)).toBe(false);
    });

    it("should return false when TURN_API_TOKEN is missing", () => {
      delete mockEnv.TURN_API_TOKEN;
      expect(isTURNServiceConfigured(mockEnv)).toBe(false);
    });

    it("should return false when TURN_API_ENDPOINT is missing", () => {
      delete mockEnv.TURN_API_ENDPOINT;
      expect(isTURNServiceConfigured(mockEnv)).toBe(false);
    });
  });

  describe("getDefaultTTL", () => {
    it("should return the configured TTL", () => {
      expect(getDefaultTTL(mockEnv)).toBe(86400);
    });

    it("should return default TTL when not configured", () => {
      delete mockEnv.TURN_CREDENTIAL_TTL;
      expect(getDefaultTTL(mockEnv)).toBe(86400);
    });

    it("should parse TTL from string", () => {
      mockEnv.TURN_CREDENTIAL_TTL = "3600";
      expect(getDefaultTTL(mockEnv)).toBe(3600);
    });
  });

  describe("getRefreshThreshold", () => {
    it("should return the configured refresh threshold", () => {
      expect(getRefreshThreshold(mockEnv)).toBe(3600);
    });

    it("should return default refresh threshold when not configured", () => {
      delete mockEnv.TURN_REFRESH_THRESHOLD;
      expect(getRefreshThreshold(mockEnv)).toBe(3600);
    });

    it("should parse refresh threshold from string", () => {
      mockEnv.TURN_REFRESH_THRESHOLD = "1800";
      expect(getRefreshThreshold(mockEnv)).toBe(1800);
    });
  });

  describe("generateTURNCredentials", () => {
    const mockRequest: TURNCredentialRequest = {
      ttl: 86400,
    };

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

    it("should successfully generate TURN credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateTURNCredentials(mockEnv, mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://rtc.live.cloudflare.com/v1/turn/keys/test-key-id/credentials/generate-ice-servers",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: 86400 }),
        },
      );
    });

    it("should throw TURNServiceError when environment variables are missing", async () => {
      delete mockEnv.TURN_KEY_ID;

      await expect(
        generateTURNCredentials(mockEnv, mockRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should throw TURNServiceError when TTL is invalid", async () => {
      const invalidRequest = { ttl: 0 };

      await expect(
        generateTURNCredentials(mockEnv, invalidRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should throw TURNServiceError when API request fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        generateTURNCredentials(mockEnv, mockRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should throw TURNServiceError when response format is invalid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      await expect(
        generateTURNCredentials(mockEnv, mockRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should throw TURNServiceError when fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        generateTURNCredentials(mockEnv, mockRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should validate response contains iceServers array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ iceServers: null }),
      });

      await expect(
        generateTURNCredentials(mockEnv, mockRequest),
      ).rejects.toThrow(TURNServiceError);
    });

    it("should handle different TTL values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const customRequest = { ttl: 3600 };
      await generateTURNCredentials(mockEnv, customRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ ttl: 3600 }),
        }),
      );
    });
  });
});
