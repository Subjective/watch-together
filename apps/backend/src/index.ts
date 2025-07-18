/**
 * Cloudflare Worker entry point for Watch Together signaling server
 */

import { RoomState } from "./roomState";
import {
  generateTURNCredentials,
  isTURNServiceConfigured,
  getDefaultTTL,
  TURNServiceError,
} from "./turnService";
import type { TURNCredentialRequest } from "@repo/types";

export interface Env {
  ROOM_STATE: DurableObjectNamespace;

  // Cloudflare TURN service configuration
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
  TURN_API_ENDPOINT?: string;
  TURN_CREDENTIAL_TTL?: string;
  TURN_REFRESH_THRESHOLD?: string;
}

export { RoomState };

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Add CORS headers for cross-origin requests from browser extension
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol",
      };

      // Handle preflight requests
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // Handle WebSocket upgrade requests
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader === "websocket" || url.pathname === "/ws") {
        // For initial connections without a room ID, create a temporary connection
        // that will be upgraded when a room is created or joined
        return handleWebSocketUpgrade(request, env, corsHeaders);
      }

      // Handle HTTP requests
      if (url.pathname === "/") {
        return new Response("Watch Together Signaling Server", {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({ status: "healthy", timestamp: Date.now() }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Handle TURN credentials endpoint
      if (url.pathname === "/api/turn/credentials") {
        return handleTURNCredentials(request, env, corsHeaders);
      }

      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "text/plain",
        },
      });
    }
  },
};

/**
 * Handle TURN credentials generation requests
 */
async function handleTURNCredentials(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if TURN service is configured
    if (!isTURNServiceConfigured(env)) {
      return new Response(
        JSON.stringify({
          error: "TURN service not configured",
          fallback: true,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    let requestData: TURNCredentialRequest;
    try {
      requestData = (await request.json()) as TURNCredentialRequest;
    } catch {
      // If no body provided, use default TTL
      requestData = { ttl: getDefaultTTL(env) };
    }

    // Validate TTL
    if (!requestData.ttl || requestData.ttl <= 0) {
      requestData.ttl = getDefaultTTL(env);
    }

    // Generate TURN credentials
    const credentials = await generateTURNCredentials(env, requestData);

    // Return the credentials
    return new Response(JSON.stringify(credentials), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[TURN Credentials] Error:", error);

    // Handle TURNServiceError with appropriate status codes
    if (error instanceof TURNServiceError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          fallback: true,
        }),
        {
          status: error.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle unexpected errors
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        fallback: true,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle WebSocket upgrade requests and route to appropriate Durable Object
 */
async function handleWebSocketUpgrade(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");

    // If no roomId is provided, return an error
    // The client should provide a roomId when connecting
    if (!roomId) {
      return new Response("Missing roomId parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate roomId format (basic validation)
    if (!/^[a-zA-Z0-9-_]{6,50}$/.test(roomId)) {
      return new Response("Invalid roomId format", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get Durable Object instance for this room
    const roomObjectId = env.ROOM_STATE.idFromName(roomId);
    const roomObject = env.ROOM_STATE.get(roomObjectId);

    // Forward the WebSocket upgrade request to the Durable Object
    return await roomObject.fetch(request);
  } catch (error) {
    console.error("WebSocket upgrade error:", error);
    return new Response("WebSocket upgrade failed", {
      status: 500,
      headers: corsHeaders,
    });
  }
}
