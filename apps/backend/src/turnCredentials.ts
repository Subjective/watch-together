/**
 * Cloudflare TURN server credential generation
 * Implements RFC 5766 TURN authentication with HMAC-based credentials
 */

import { createHmac } from "crypto";

export interface IceServer {
  urls: string;
  username: string;
  credential: string;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  expiresAt: number;
  iceServers: IceServer[];
}

/**
 * Generate temporary Cloudflare TURN credentials using HMAC-SHA1.
 *
 * The username format follows RFC 5766: timestamp:userId
 * The credential is an HMAC-SHA1 hash of the username using the shared secret.
 *
 * @param secret - Secret used to sign the username (TURN_SECRET environment variable)
 * @param urls - Array of TURN server URLs (from TURN_URLS environment variable)
 * @param userId - Unique identifier for the user
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 * @returns Object containing username, credential, expiration time, and ICE servers
 */
export function generateTurnCredentials(
  secret: string,
  urls: string[],
  userId: string,
  ttlSeconds = 3600,
): TurnCredentials {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${userId}`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");

  const iceServers: IceServer[] = urls.map((url) => ({
    urls: url,
    username,
    credential,
  }));

  return {
    username,
    credential,
    expiresAt,
    iceServers,
  };
}
