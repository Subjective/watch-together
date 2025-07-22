/**
 * Cloudflare Worker entry point for Watch Together signaling server
 */

import { RoomState } from "./roomState";
import { generateCloudflareCredentials } from "./cloudflareApiCredentials";

export interface Env {
  ROOM_STATE: DurableObjectNamespace;
  TURN_KEY_ID: string;
  TURN_KEY_API_TOKEN: string;
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

      if (url.pathname === "/turn-credentials") {
        try {
          const ttl = parseInt(url.searchParams.get("ttl") || "3600", 10);

          // Validate TTL parameter
          if (ttl < 300 || ttl > 86400) {
            return new Response(
              JSON.stringify({
                error: "TTL must be between 300 and 86400 seconds",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const creds = await generateCloudflareCredentials(
            env.TURN_KEY_ID,
            env.TURN_KEY_API_TOKEN,
            ttl,
          );

          return new Response(JSON.stringify(creds), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("TURN credentials error:", error);

          return new Response(
            JSON.stringify({
              error: "Failed to generate TURN credentials",
              details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
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
