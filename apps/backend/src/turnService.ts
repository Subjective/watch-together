/**
 * Cloudflare TURN service integration
 *
 * Provides utilities for generating and managing TURN server credentials
 * using Cloudflare's TURN service API.
 */

import type {
  TURNCredentialRequest,
  CloudflareTURNResponse,
} from "@repo/types";
import type { Env } from "./index";

/**
 * Error class for TURN service related errors
 */
export class TURNServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TURNServiceError";
  }
}

/**
 * Generate TURN server credentials using Cloudflare's API
 *
 * @param env - Cloudflare Worker environment variables
 * @param request - TURN credential request parameters
 * @returns Promise resolving to TURN credential response
 * @throws TURNServiceError if credential generation fails
 */
export async function generateTURNCredentials(
  env: Env,
  request: TURNCredentialRequest,
): Promise<CloudflareTURNResponse> {
  const { TURN_KEY_ID, TURN_API_TOKEN, TURN_API_ENDPOINT } = env;

  // Validate required environment variables
  if (!TURN_KEY_ID || !TURN_API_TOKEN || !TURN_API_ENDPOINT) {
    throw new TURNServiceError(
      "TURN service not configured. Missing required environment variables.",
      500,
    );
  }

  // Validate request parameters
  if (!request.ttl || request.ttl <= 0) {
    throw new TURNServiceError("Invalid TTL. Must be a positive number.", 400);
  }

  // Construct the API endpoint URL
  const apiUrl = `${TURN_API_ENDPOINT}/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`;

  try {
    console.log(
      `[TURN Service] Generating credentials with TTL: ${request.ttl}s`,
    );

    // Make the API request to Cloudflare's TURN service
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl: request.ttl,
      }),
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TURN Service] API error: ${response.status} - ${errorText}`,
      );
      throw new TURNServiceError(
        `Failed to generate TURN credentials: ${response.status}`,
        response.status,
      );
    }

    // Parse the response
    const data = (await response.json()) as CloudflareTURNResponse;

    // Validate the response structure
    if (!data.iceServers || !Array.isArray(data.iceServers)) {
      throw new TURNServiceError(
        "Invalid response format from TURN service",
        502,
      );
    }

    console.log(
      `[TURN Service] Successfully generated credentials for ${data.iceServers.length} ICE servers`,
    );
    return data;
  } catch (error) {
    // Re-throw TURNServiceError as-is
    if (error instanceof TURNServiceError) {
      throw error;
    }

    // Handle fetch errors and other unexpected errors
    console.error("[TURN Service] Unexpected error:", error);
    throw new TURNServiceError(
      "Unexpected error while generating TURN credentials",
      500,
    );
  }
}

/**
 * Validate TURN service configuration
 *
 * @param env - Cloudflare Worker environment variables
 * @returns boolean indicating if TURN service is properly configured
 */
export function isTURNServiceConfigured(env: Env): boolean {
  const { TURN_KEY_ID, TURN_API_TOKEN, TURN_API_ENDPOINT } = env;
  return !!(TURN_KEY_ID && TURN_API_TOKEN && TURN_API_ENDPOINT);
}

/**
 * Get default TTL for TURN credentials
 *
 * @param env - Cloudflare Worker environment variables
 * @returns TTL in seconds, defaults to 86400 (24 hours)
 */
export function getDefaultTTL(env: Env): number {
  const ttl = env.TURN_CREDENTIAL_TTL;
  return ttl ? parseInt(ttl, 10) : 86400; // Default to 24 hours
}

/**
 * Get refresh threshold for TURN credentials
 *
 * @param env - Cloudflare Worker environment variables
 * @returns Refresh threshold in seconds, defaults to 3600 (1 hour)
 */
export function getRefreshThreshold(env: Env): number {
  const threshold = env.TURN_REFRESH_THRESHOLD;
  return threshold ? parseInt(threshold, 10) : 3600; // Default to 1 hour
}
