/**
 * Unit tests for TURN credentials generation
 * Tests HMAC-based credential generation following RFC 5766
 */

import { describe, it, expect } from "vitest";
import { generateTurnCredentials } from "../turnCredentials";

describe("generateTurnCredentials", () => {
  it("creates credentials with correct structure", () => {
    const creds = generateTurnCredentials(
      "testsecret",
      ["turn:example.com"],
      "user1",
      600,
    );

    expect(creds.username).toMatch(/^[0-9]+:user1$/);
    expect(creds.credential).toBeDefined();
    expect(creds.iceServers).toHaveLength(1);
    expect(creds.iceServers[0]).toEqual({
      urls: "turn:example.com",
      username: creds.username,
      credential: creds.credential,
    });
    expect(creds.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("generates different credentials for different users", () => {
    const secret = "testsecret";
    const urls = ["turn:example.com"];
    const ttl = 600;

    const creds1 = generateTurnCredentials(secret, urls, "user1", ttl);
    const creds2 = generateTurnCredentials(secret, urls, "user2", ttl);

    expect(creds1.username).not.toBe(creds2.username);
    expect(creds1.credential).not.toBe(creds2.credential);
  });

  it("generates credentials with correct expiration time", () => {
    const ttl = 3600; // 1 hour
    const beforeTime = Math.floor(Date.now() / 1000);
    
    const creds = generateTurnCredentials(
      "testsecret",
      ["turn:example.com"],
      "user1",
      ttl,
    );
    
    const afterTime = Math.floor(Date.now() / 1000);
    
    expect(creds.expiresAt).toBeGreaterThanOrEqual(beforeTime + ttl);
    expect(creds.expiresAt).toBeLessThanOrEqual(afterTime + ttl);
  });

  it("handles multiple TURN server URLs", () => {
    const urls = [
      "turn:server1.example.com:3478",
      "turns:server2.example.com:443",
      "turn:server3.example.com:3478?transport=tcp",
    ];

    const creds = generateTurnCredentials("testsecret", urls, "user1", 600);

    expect(creds.iceServers).toHaveLength(3);
    expect(creds.iceServers[0].urls).toBe(urls[0]);
    expect(creds.iceServers[1].urls).toBe(urls[1]);
    expect(creds.iceServers[2].urls).toBe(urls[2]);

    // All servers should use the same username and credential
    const { username, credential } = creds;
    creds.iceServers.forEach((server) => {
      expect(server.username).toBe(username);
      expect(server.credential).toBe(credential);
    });
  });

  it("uses default TTL when not specified", () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    
    const creds = generateTurnCredentials(
      "testsecret",
      ["turn:example.com"],
      "user1",
    );
    
    const afterTime = Math.floor(Date.now() / 1000);
    
    // Default TTL is 3600 seconds (1 hour)
    expect(creds.expiresAt).toBeGreaterThanOrEqual(beforeTime + 3600);
    expect(creds.expiresAt).toBeLessThanOrEqual(afterTime + 3600);
  });

  it("generates HMAC-SHA1 based credentials", () => {
    const creds = generateTurnCredentials(
      "testsecret",
      ["turn:example.com"],
      "user1",
      600,
    );

    // Base64 encoded SHA1 hash should be 28 characters long
    expect(creds.credential).toMatch(/^[A-Za-z0-9+/=]{28}$/);
  });

  it("generates consistent credentials for same inputs", () => {
    const secret = "testsecret";
    const urls = ["turn:example.com"];
    const userId = "user1";
    const ttl = 600;

    // Mock Date.now to ensure consistent timestamps
    const mockTime = 1700000000000; // Fixed timestamp
    const originalNow = Date.now;
    Date.now = () => mockTime;

    try {
      const creds1 = generateTurnCredentials(secret, urls, userId, ttl);
      const creds2 = generateTurnCredentials(secret, urls, userId, ttl);

      expect(creds1.username).toBe(creds2.username);
      expect(creds1.credential).toBe(creds2.credential);
      expect(creds1.expiresAt).toBe(creds2.expiresAt);
    } finally {
      Date.now = originalNow;
    }
  });
});