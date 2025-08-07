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
  
  // Message queue for offline buffering
  private messageQueue: SignalingMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 50;
  
  // Connection state tracking
  private isIntentionalDisconnect = false;
  private lastConnectedAt: number | null = null;
  private reconnectAttempts = 0;

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
    this.isIntentionalDisconnect = false;

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
      this.reconnectAttempts = 0;
      this.lastConnectedAt = Date.now();
      this.startHeartbeat();

      console.log("WebSocket connected successfully");
      
      // Flush any queued messages after successful connection
      await this.flushMessageQueue();
      
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      this.setConnectionStatus("ERROR");
      
      if (!this.isIntentionalDisconnect) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.isIntentionalDisconnect = true;
    this.clearReconnectionTimer();
    this.stopHeartbeat();

    if (this.ws) {
      // Close WebSocket immediately without waiting for close event
      // This prevents hanging when server is down
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    // Reset retry count to prevent future reconnection attempts
    this.retryCount = 0;
    this.reconnectAttempts = 0;
    
    // Clear message queue on intentional disconnect
    this.messageQueue = [];

    this.setConnectionStatus("DISCONNECTED");
  }

  /**
   * Send message to WebSocket server
   */
  async send(message: SignalingMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected (unless it's a time-sensitive message)
      if (this.shouldQueueMessage(message)) {
        this.queueMessage(message);
        console.log(`WebSocket not connected, queued message: ${message.type}`);
        return;
      } else {
        throw new Error("WebSocket is not connected");
      }
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log("WebSocket message sent:", message.type);
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      
      // Try to queue the message for retry
      if (this.shouldQueueMessage(message)) {
        this.queueMessage(message);
      }
      
      throw error;
    }
  }

  /**
   * Queue a message for later sending
   */
  private queueMessage(message: SignalingMessage): void {
    // Remove oldest messages if queue is full
    while (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      const removed = this.messageQueue.shift();
      console.warn(`Message queue full, dropping oldest message: ${removed?.type}`);
    }
    
    this.messageQueue.push(message);
    console.log(`Queued message ${message.type}, queue size: ${this.messageQueue.length}`);
  }

  /**
   * Determine if a message should be queued
   */
  private shouldQueueMessage(message: SignalingMessage): boolean {
    // Don't queue time-sensitive messages like PING/PONG
    const nonQueueableTypes = ["PING", "PONG"];
    
    // Don't queue room creation/join messages as they need immediate response
    const criticalTypes = ["CREATE_ROOM", "JOIN_ROOM"];
    
    if (nonQueueableTypes.includes(message.type)) {
      return false;
    }
    
    if (criticalTypes.includes(message.type)) {
      return false;
    }
    
    // Queue other messages like ICE candidates, offers, answers, etc.
    return true;
  }

  /**
   * Flush queued messages after reconnection
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) {
      return;
    }
    
    console.log(`Flushing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of messages) {
      try {
        // Add a small delay between messages to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.send(message);
      } catch (error) {
        console.error(`Failed to send queued message ${message.type}:`, error);
      }
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

      // Don't reconnect for:
      // - 1000: Normal closure
      // - 4001: Room ID mismatch
      // - 4002: User already in room
      // - 4004: Room not found
      // These are permanent errors that won't be resolved by reconnecting
      const permanentErrorCodes = [1000, 4001, 4002, 4004];

      if (!permanentErrorCodes.includes(event.code)) {
        // Temporary error - attempt reconnection
        this.setConnectionStatus("DISCONNECTED");
        this.scheduleReconnection();
      } else {
        // Permanent error or normal closure - don't reconnect
        this.setConnectionStatus("DISCONNECTED");
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
    // Don't reconnect if it was an intentional disconnect
    if (this.isIntentionalDisconnect) {
      console.log("Skipping reconnection - disconnect was intentional");
      return;
    }
    
    if (this.retryCount >= this.config.maxRetries) {
      console.error("Max reconnection attempts reached");
      this.setConnectionStatus("ERROR");
      
      // Emit event for higher-level handling
      const listeners = this.eventListeners.get("MAX_RETRIES_REACHED");
      if (listeners) {
        listeners.forEach((callback) => callback({ 
          attempts: this.retryCount,
          lastConnectedAt: this.lastConnectedAt 
        }));
      }
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
      `Scheduling reconnection in ${finalDelay}ms (attempt ${this.retryCount + 1}/${this.config.maxRetries})`,
    );

    this.clearReconnectionTimer();
    this.retryTimeoutId = setTimeout(() => {
      this.retryCount++;
      this.reconnectAttempts++;
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

  /**
   * Update WebSocket URL for new room connections
   */
  updateUrl(newUrl: string): void {
    this.config.url = newUrl;
  }

  /**
   * Reset WebSocket manager state for fresh initialization
   */
  reset(): void {
    // Close existing connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear all timers
    this.clearPongTimeout();
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    // Reset state
    this.connectionStatus = "DISCONNECTED";
    this.retryCount = 0;
    this.reconnectAttempts = 0;
    this.isIntentionalDisconnect = false;
    this.lastConnectedAt = null;
    this.messageQueue = [];

    console.log("WebSocket manager reset");
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    status: ConnectionStatus;
    reconnectAttempts: number;
    queuedMessages: number;
    lastConnectedAt: number | null;
    isReconnecting: boolean;
  } {
    return {
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      lastConnectedAt: this.lastConnectedAt,
      isReconnecting: this.retryCount > 0 && !this.isIntentionalDisconnect,
    };
  }

  /**
   * Clear message queue
   */
  clearMessageQueue(): void {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    console.log(`Cleared ${count} messages from queue`);
  }
}

/**
 * Default WebSocket configuration
 */
export const defaultWebSocketConfig: WebSocketConfig = {
  // Read from Vite environment variable. During development this comes from
  // `.env.development`, and production builds use `.env.production`.
  // Fallback to localhost if the variable is undefined (useful for tests).
  url: import.meta.env.VITE_WS_URL || "ws://localhost:8787/ws",
  maxRetries: 5,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  heartbeatInterval: 30000, // 15 seconds for server failure detection
};
