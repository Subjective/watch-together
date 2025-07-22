/**
 * Cloudflare Official TURN API Integration
 *
 * Uses Cloudflare's official REST API to generate TURN credentials
 * instead of custom HMAC implementation.
 *
 * API Documentation: https://developers.cloudflare.com/realtime/turn/generate-credentials/
 */

/**
 * ICE server configuration returned by Cloudflare API
 * Note: STUN servers may not have username/credential
 * Note: urls can be a string or array of strings
 */
export interface CloudflareIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Response from Cloudflare TURN credentials API
 */
export interface CloudflareTurnResponse {
  iceServers: CloudflareIceServer[];
}

/**
 * TURN credentials with metadata
 */
export interface TurnCredentials {
  iceServers: CloudflareIceServer[];
  expiresAt: number;
  ttl: number;
}

/**
 * Error response from Cloudflare API
 */
export interface CloudflareApiError {
  code: number;
  message: string;
  details?: unknown;
}

/**
 * Generate TURN credentials using Cloudflare's official API
 *
 * @param turnKeyId - Cloudflare TURN key ID
 * @param apiToken - Cloudflare API token with TURN permissions
 * @param ttlSeconds - Time-to-live for credentials in seconds (default: 3600)
 * @returns Promise resolving to TURN credentials
 */
export async function generateCloudflareCredentials(
  turnKeyId: string,
  apiToken: string,
  ttlSeconds = 3600,
): Promise<TurnCredentials> {
  const apiUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate-ice-servers`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl: ttlSeconds,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: unknown = undefined;

      try {
        const errorData = (await response.json()) as CloudflareApiError;
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData.details;
      } catch {
        // If error response is not JSON, use HTTP status as message
      }

      const error = new Error(`Cloudflare TURN API error: ${errorMessage}`);
      (error as any).cause = { status: response.status, details: errorDetails };
      throw error;
    }

    const data = (await response.json()) as CloudflareTurnResponse;

    if (!data.iceServers || !Array.isArray(data.iceServers)) {
      throw new Error("Invalid response format: missing iceServers array");
    }

    // Process ICE servers to match WebRTC RTCIceServer format
    // Note: Actual Cloudflare API returns separate objects for STUN/TURN
    // despite documentation showing combined format
    const processedServers: CloudflareIceServer[] = [];

    for (const server of data.iceServers) {
      if (!server.urls) {
        throw new Error("Invalid ICE server format: missing urls field");
      }

      // Handle both string and array formats for urls (normalize to array)
      const urlsArray = Array.isArray(server.urls)
        ? server.urls
        : [server.urls];

      // Create individual server entries for WebRTC compatibility
      // WebRTC expects each server to have a single URL string
      for (const url of urlsArray) {
        const processedServer: CloudflareIceServer = { urls: url };

        // Add credentials if present (for TURN servers)
        if (server.username && server.credential) {
          processedServer.username = server.username;
          processedServer.credential = server.credential;
        }

        processedServers.push(processedServer);
      }
    }

    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    return {
      iceServers: processedServers,
      expiresAt,
      ttl: ttlSeconds,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with additional context
      const wrappedError = new Error(
        `Failed to generate Cloudflare TURN credentials: ${error.message}`,
      );
      (wrappedError as any).cause = error;
      throw wrappedError;
    }

    throw new Error(
      "Failed to generate Cloudflare TURN credentials: Unknown error",
    );
  }
}

/**
 * Revoke TURN credentials using Cloudflare API
 *
 * @param turnKeyId - Cloudflare TURN key ID
 * @param apiToken - Cloudflare API token with TURN permissions
 * @param username - Username from credentials to revoke
 * @returns Promise resolving when credentials are revoked
 */
export async function revokeCloudflareCredentials(
  turnKeyId: string,
  apiToken: string,
  username: string,
): Promise<void> {
  const apiUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/${username}/revoke`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = (await response.json()) as CloudflareApiError;
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If error response is not JSON, use HTTP status as message
      }

      throw new Error(`Failed to revoke credentials: ${errorMessage}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      const wrappedError = new Error(
        `Failed to revoke Cloudflare TURN credentials: ${error.message}`,
      );
      (wrappedError as any).cause = error;
      throw wrappedError;
    }

    throw new Error(
      "Failed to revoke Cloudflare TURN credentials: Unknown error",
    );
  }
}
