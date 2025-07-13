/**
 * WebSocket connection management for Watch Together extension
 * Handles connection to Cloudflare Workers backend with automatic reconnection
 */

import type {
  SignalingMessage,
  ResponseMessage,
  ConnectionStatus,
} from "@repo/types";

export interface WebSocketConfig {
  url: string;
  maxRetries: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  heartbeatInterval: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private connectionStatus: ConnectionStatus = "DISCONNECTED";
  private retryCount = 0;
  private retryTimeoutId: number | null = null;
  private heartbeatIntervalId: number | null = null;
  private pongTimeoutId: number | null = null;
  private readonly PONG_TIMEOUT = 10000; // 10 seconds
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (
      this.connectionStatus === "CONNECTED" ||
      this.connectionStatus === "CONNECTING"
    ) {
      return;
    }

    this.setConnectionStatus("CONNECTING");

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupWebSocketEventHandlers();

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error("WebSocket initialization failed"));
          return;
        }

        const onOpen = () => {
          this.ws?.removeEventListener("open", onOpen);
          this.ws?.removeEventListener("error", onError);
          resolve();
        };

        const onError = (error: Event) => {
          this.ws?.removeEventListener("open", onOpen);
          this.ws?.removeEventListener("error", onError);
          reject(error);
        };

        this.ws.addEventListener("open", onOpen);
        this.ws.addEventListener("error", onError);
      });

      this.setConnectionStatus("CONNECTED");
      this.retryCount = 0;
      this.startHeartbeat();

      console.log("WebSocket connected successfully");
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      this.setConnectionStatus("ERROR");
      this.scheduleReconnection();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.clearReconnectionTimer();
    this.stopHeartbeat();

    if (this.ws) {
      // Close WebSocket immediately without waiting for close event
      // This prevents hanging when server is down
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.setConnectionStatus("DISCONNECTED");
  }

  /**
   * Send message to WebSocket server
   */
  async send(message: SignalingMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log("WebSocket message sent:", message.type);
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      throw error;
    }
  }

  /**
   * Add event listener for specific message types
   */
  on(messageType: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(messageType)) {
      this.eventListeners.set(messageType, []);
    }
    this.eventListeners.get(messageType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(messageType: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(messageType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return (
      this.connectionStatus === "CONNECTED" &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  private setupWebSocketEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("WebSocket opened");
    };

    this.ws.onmessage = (event) => {
      try {
        const message: ResponseMessage = JSON.parse(event.data);
        console.log("WebSocket message received:", message.type);

        // Handle PONG response
        if (message.type === "PONG") {
          this.handlePongReceived();
          return;
        }

        // Emit to registered listeners
        const listeners = this.eventListeners.get(message.type);
        if (listeners) {
          listeners.forEach((callback) => callback(message));
        }

        // Emit to generic listeners
        const genericListeners = this.eventListeners.get("*");
        if (genericListeners) {
          genericListeners.forEach((callback) => callback(message));
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.setConnectionStatus("ERROR");
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      this.stopHeartbeat();

      if (event.code !== 1000) {
        // Not a normal closure
        this.setConnectionStatus("DISCONNECTED");
        this.scheduleReconnection();
      }
    };
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;

      // Emit status change event
      const listeners = this.eventListeners.get("CONNECTION_STATUS_CHANGE");
      if (listeners) {
        listeners.forEach((callback) => callback({ status }));
      }
    }
  }

  private scheduleReconnection(): void {
    if (this.retryCount >= this.config.maxRetries) {
      console.error("Max reconnection attempts reached");
      this.setConnectionStatus("ERROR");
      return;
    }

    // Don't set status to CONNECTING here - let connect() handle it
    // This prevents the connection guard from blocking retries

    // Exponential backoff with jitter
    const delay = Math.min(
      this.config.baseRetryDelay * Math.pow(2, this.retryCount),
      this.config.maxRetryDelay,
    );
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = delay + jitter;

    console.log(
      `Scheduling reconnection in ${finalDelay}ms (attempt ${this.retryCount + 1})`,
    );

    this.clearReconnectionTimer();
    this.retryTimeoutId = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, finalDelay) as unknown as number;
  }

  private clearReconnectionTimer(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.isConnected()) {
        // Send ping message and set timeout for PONG response
        try {
          this.ws?.send(
            JSON.stringify({ type: "PING", timestamp: Date.now() }),
          );
          console.log("PING sent to server");

          // Set timeout for PONG response
          this.clearPongTimeout();
          this.pongTimeoutId = setTimeout(() => {
            console.log("PONG timeout - server not responding");
            this.setConnectionStatus("ERROR");
            this.scheduleReconnection();
          }, this.PONG_TIMEOUT) as unknown as number;
        } catch (error) {
          console.error("Failed to send heartbeat:", error);
          this.setConnectionStatus("ERROR");
          this.scheduleReconnection();
        }
      }
    }, this.config.heartbeatInterval) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    this.clearPongTimeout();
  }

  /**
   * Handle PONG response from server
   */
  private handlePongReceived(): void {
    console.log("PONG received from server");
    this.clearPongTimeout();
  }

  /**
   * Clear PONG timeout timer
   */
  private clearPongTimeout(): void {
    if (this.pongTimeoutId) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }
}

/**
 * Default WebSocket configuration
 */
export const defaultWebSocketConfig: WebSocketConfig = {
  // For local testing, use a mock WebSocket server or disable connection
  // In production, this should be your Cloudflare Workers URL
  url: "ws://localhost:8787/ws", // Local development server
  maxRetries: 5,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  heartbeatInterval: 30000, // 15 seconds for server failure detection
};
