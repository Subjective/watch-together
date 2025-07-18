/**
 * TURN credentials management utilities
 *
 * Handles fetching, caching, and refreshing TURN server credentials
 * from the Cloudflare Worker backend.
 */

import type {
  CloudflareTURNCredential,
  TURNCredentialRequest,
  CloudflareTURNResponse,
  TURNServiceConfig,
} from "@repo/types";
import { defaultTURNServiceConfig } from "@repo/types";

/**
 * Error class for TURN credential related errors
 */
export class TURNCredentialError extends Error {
  constructor(
    message: string,
    public readonly shouldFallback: boolean = false,
  ) {
    super(message);
    this.name = "TURNCredentialError";
  }
}

/**
 * TURN credentials manager
 */
export class TURNCredentialsManager {
  private credentials: CloudflareTURNCredential | null = null;
  private config: TURNServiceConfig;
  private backendUrl: string;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(backendUrl: string, config: Partial<TURNServiceConfig> = {}) {
    this.backendUrl = backendUrl.replace(/\/$/, ""); // Remove trailing slash

    // Fallback configuration in case defaultTURNServiceConfig is undefined
    const fallbackConfig: TURNServiceConfig = {
      apiEndpoint: "/api/turn/credentials",
      credentialTtl: 86400,
      refreshThreshold: 3600,
      maxRetries: 3,
      retryDelay: 1000,
    };

    this.config = {
      ...(defaultTURNServiceConfig || fallbackConfig),
      ...config,
    };
  }

  /**
   * Get current TURN credentials, fetching new ones if needed
   */
  async getCredentials(): Promise<CloudflareTURNCredential | null> {
    try {
      // Check if we have valid credentials
      if (this.credentials && this.isCredentialValid(this.credentials)) {
        return this.credentials;
      }

      // Fetch new credentials
      await this.fetchCredentials();
      return this.credentials;
    } catch (error) {
      console.error("[TURN Credentials] Failed to get credentials:", error);

      // Clear invalid credentials
      this.credentials = null;

      // Check if we should fallback
      if (error instanceof TURNCredentialError && error.shouldFallback) {
        return null; // Caller should fallback to STUN-only
      }

      throw error;
    }
  }

  /**
   * Force refresh of TURN credentials
   */
  async refreshCredentials(): Promise<void> {
    console.log("[TURN Credentials] Force refreshing credentials");
    await this.fetchCredentials();
  }

  /**
   * Check if credentials are valid and not expired
   */
  private isCredentialValid(credentials: CloudflareTURNCredential): boolean {
    const now = Date.now();
    const expiresAt = credentials.expiresAt;
    const refreshThreshold = this.config.refreshThreshold * 1000; // Convert to ms

    // Check if credentials expire within the refresh threshold
    const shouldRefresh = expiresAt - now <= refreshThreshold;

    if (shouldRefresh) {
      console.log("[TURN Credentials] Credentials need refresh");
      return false;
    }

    return true;
  }

  /**
   * Fetch new TURN credentials from backend
   */
  private async fetchCredentials(): Promise<void> {
    const url = `${this.backendUrl}${this.config.apiEndpoint}`;
    const requestData: TURNCredentialRequest = {
      ttl: this.config.credentialTtl,
    };

    let attempt = 0;
    const maxRetries = this.config.maxRetries;

    while (attempt < maxRetries) {
      try {
        console.log(
          `[TURN Credentials] Fetching credentials (attempt ${attempt + 1}/${maxRetries})`,
        );

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Check if backend indicates we should fallback
          if (errorData.fallback) {
            throw new TURNCredentialError(
              errorData.error || `HTTP ${response.status}`,
              true,
            );
          }

          throw new TURNCredentialError(
            `HTTP ${response.status}: ${errorData.error || response.statusText}`,
          );
        }

        const data = (await response.json()) as CloudflareTURNResponse;

        // Validate response
        if (!data.iceServers || !Array.isArray(data.iceServers)) {
          throw new TURNCredentialError("Invalid response format");
        }

        // Extract credentials from the first TURN server
        const turnServer = data.iceServers.find((server) => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          return urls.some((url: string) => url.includes("turn:"));
        });

        if (!turnServer || !turnServer.username || !turnServer.credential) {
          throw new TURNCredentialError("No TURN server found in response");
        }

        // Create credential object
        const now = Date.now();
        const expiresAt = now + this.config.credentialTtl * 1000;

        const urls = Array.isArray(turnServer.urls) ? turnServer.urls : [turnServer.urls];
        
        this.credentials = {
          username: turnServer.username,
          credential: turnServer.credential,
          urls: urls,
          ttl: this.config.credentialTtl,
          expiresAt,
        };

        console.log(
          `[TURN Credentials] Successfully fetched credentials, expires at: ${new Date(expiresAt).toISOString()}`,
        );

        // Schedule refresh
        this.scheduleRefresh();

        return;
      } catch (error) {
        attempt++;

        if (error instanceof TURNCredentialError) {
          // Don't retry on certain errors
          if (error.shouldFallback || attempt >= maxRetries) {
            throw error;
          }
        } else if (attempt >= maxRetries) {
          throw new TURNCredentialError(
            `Failed to fetch credentials after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`,
            true,
          );
        }

        // Wait before retrying
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[TURN Credentials] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Schedule automatic refresh of credentials
   */
  private scheduleRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (!this.credentials) return;

    const now = Date.now();
    const expiresAt = this.credentials.expiresAt;
    const refreshThreshold = this.config.refreshThreshold * 1000; // Convert to ms
    const refreshAt = expiresAt - refreshThreshold;
    const delay = Math.max(0, refreshAt - now);

    console.log(`[TURN Credentials] Scheduling refresh in ${delay}ms`);

    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.fetchCredentials();
      } catch (error) {
        console.error("[TURN Credentials] Auto-refresh failed:", error);
      }
    }, delay);
  }

  /**
   * Clear credentials and cancel refresh
   */
  clear(): void {
    this.credentials = null;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Get current credentials without fetching
   */
  getCurrentCredentials(): CloudflareTURNCredential | null {
    return this.credentials;
  }
}
