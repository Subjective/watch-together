/**
 * Tests for TURN credentials endpoint
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import worker from "../index";
import type { Env } from "../index";

// Mock the turn service
vi.mock("../turnService", () => ({
  generateTURNCredentials: vi.fn(),
  isTURNServiceConfigured: vi.fn(),
  getDefaultTTL: vi.fn(() => 86400),
  TURNServiceError: class TURNServiceError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
    ) {
      super(message);
      this.name = "TURNServiceError";
    }
  },
}));

import {
  generateTURNCredentials,
  isTURNServiceConfigured,
  TURNServiceError,
} from "../turnService";

describe("TURN Credentials Endpoint", () => {
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

  describe("POST /api/turn/credentials", () => {
    it("should return TURN credentials on successful request", async () => {
      const mockCredentials = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockResolvedValue(mockCredentials);

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

      const data = await response.json();
      expect(data).toEqual(mockCredentials);
    });

    it("should handle empty request body with default TTL", async () => {
      const mockCredentials = {
        iceServers: [
          {
            urls: ["turn:turn.cloudflare.com:3478"],
            username: "test-username",
            credential: "test-credential",
          },
        ],
      };

      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockResolvedValue(mockCredentials);

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(vi.mocked(generateTURNCredentials)).toHaveBeenCalledWith(mockEnv, {
        ttl: 86400,
      });
    });

    it("should return 405 for non-POST requests", async () => {
      const request = new Request("https://example.com/api/turn/credentials", {
        method: "GET",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data).toEqual({ error: "Method not allowed" });
    });

    it("should return 503 when TURN service is not configured", async () => {
      vi.mocked(isTURNServiceConfigured).mockReturnValue(false);

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data).toEqual({
        error: "TURN service not configured",
        fallback: true,
      });
    });

    it("should handle TURNServiceError appropriately", async () => {
      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockRejectedValue(
        new TURNServiceError("API rate limit exceeded", 429),
      );

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data).toEqual({
        error: "API rate limit exceeded",
        fallback: true,
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toEqual({
        error: "Internal server error",
        fallback: true,
      });
    });

    it("should handle invalid JSON in request body", async () => {
      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockResolvedValue({
        iceServers: [],
      });

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(vi.mocked(generateTURNCredentials)).toHaveBeenCalledWith(mockEnv, {
        ttl: 86400,
      });
    });

    it("should sanitize invalid TTL values", async () => {
      vi.mocked(isTURNServiceConfigured).mockReturnValue(true);
      vi.mocked(generateTURNCredentials).mockResolvedValue({
        iceServers: [],
      });

      const request = new Request("https://example.com/api/turn/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: -1 }),
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(vi.mocked(generateTURNCredentials)).toHaveBeenCalledWith(mockEnv, {
        ttl: 86400,
      });
    });
  });

  describe("OPTIONS /api/turn/credentials", () => {
    it("should handle preflight requests", async () => {
      const request = new Request("https://example.com/api/turn/credentials", {
        method: "OPTIONS",
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS",
      );
    });
  });
});
