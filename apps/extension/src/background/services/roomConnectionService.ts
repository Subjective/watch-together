/**
 * Room Connection Service
 * 
 * Encapsulates the high-level logic for creating, joining, and leaving rooms.
 * Coordinates WebSocket and WebRTC managers to establish full room connections.
 * Handles reconnection, recovery, and auto-rejoin logic.
 */

import type {
  RoomState,
  User,
  CreateRoomMessage,
  JoinRoomMessage,
  ConnectionStatus,
} from "@repo/types";

import { defaultWebRTCConfig } from "@repo/types";
import { WebSocketManager, type WebSocketConfig } from "../websocket";
import { WebRTCManager } from "../webrtcBridge";
import { StorageManager } from "../storage";
import type { RoomStateManager } from "../state/roomStateManager";

export interface RoomConnectionConfig {
  websocketConfig: WebSocketConfig;
  webrtcConfig: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize: number;
  };
  stateManager: RoomStateManager;
}

export interface ConnectionResult {
  room: RoomState;
  user: User;
}

export class RoomConnectionService {
  private websocket: WebSocketManager;
  private webrtc: WebRTCManager;
  private stateManager: RoomStateManager;
  private config: RoomConnectionConfig;
  
  // Connection state
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private isReconnecting: boolean = false;
  private offscreenDocumentReady: boolean = false;
  
  // Event listeners
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(config: RoomConnectionConfig) {
    this.config = config;
    this.stateManager = config.stateManager;
    
    // Initialize WebSocket manager
    this.websocket = new WebSocketManager(config.websocketConfig);
    
    // Initialize WebRTC manager
    this.webrtc = new WebRTCManager({
      iceServers: config.webrtcConfig.iceServers,
      iceCandidatePoolSize: config.webrtcConfig.iceCandidatePoolSize,
      dataChannelOptions: {
        ordered: true,
        maxRetransmits: 3,
      },
    });
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the service and ensure offscreen document is ready
   */
  async initialize(): Promise<void> {
    console.log("[RoomConnectionService] Initializing...");
    
    // Ensure offscreen document is created proactively
    await this.ensureOffscreenDocument();
    
    // Set up WebSocket reconnection handler
    this.websocket.on("CONNECTION_STATUS_CHANGE", this.handleConnectionStatusChange.bind(this));
    
    console.log("[RoomConnectionService] Initialized successfully");
  }

  /**
   * Unified method to connect to a room (create or join)
   */
  async connectToRoom(
    roomId: string,
    userName: string,
    asHost: boolean = false,
    roomName?: string
  ): Promise<ConnectionResult> {
    try {
      console.log(`[RoomConnectionService] Connecting to room ${roomId} as ${asHost ? 'host' : 'participant'}`);
      
      // Ensure offscreen document is ready
      await this.ensureOffscreenDocument();
      
      // Generate user ID
      const userId = this.generateUserId();
      this.currentUserId = userId;
      this.currentRoomId = roomId;
      
      // Disconnect any existing connection
      await this.disconnectFromRoom();
      
      // Update WebSocket URL with room ID
      const baseUrl = this.config.websocketConfig.url;
      this.websocket.updateUrl(`${baseUrl}?roomId=${roomId}`);
      
      // Connect WebSocket
      await this.websocket.connect();
      
      if (!this.websocket.isConnected()) {
        throw new Error("Failed to establish WebSocket connection");
      }
      
      // Fetch TURN credentials
      const turnServers = await this.fetchTurnCredentials(userId);
      if (turnServers.length > defaultWebRTCConfig.iceServers.length) {
        this.webrtc.setIceServers(turnServers);
      }
      
      // Initialize WebRTC before room operations
      await this.webrtc.initialize(userId, asHost);
      
      // Send appropriate room message
      let result: ConnectionResult;
      if (asHost && roomName) {
        result = await this.createRoom(roomId, userId, userName, roomName);
      } else {
        result = await this.joinRoom(roomId, userId, userName);
      }
      
      // Update state manager
      await this.stateManager.setRoom(result.room);
      await this.stateManager.setUser(result.user);
      await this.stateManager.setConnectionStatus("CONNECTED");
      
      // Store room in history
      StorageManager.addRoomToHistory(result.room);
      
      console.log(`[RoomConnectionService] Successfully connected to room ${roomId}`);
      this.emit("ROOM_CONNECTED", result);
      
      return result;
    } catch (error) {
      console.error("[RoomConnectionService] Failed to connect to room:", error);
      
      // Clean up on error
      await this.cleanup();
      
      throw error;
    }
  }

  /**
   * Disconnect from current room
   */
  async disconnectFromRoom(): Promise<void> {
    console.log(`[RoomConnectionService] Disconnecting from room ${this.currentRoomId || "none"}`);
    
    // Close WebRTC connections
    this.webrtc.closeAllConnections();
    
    // Disconnect WebSocket
    await this.websocket.disconnect();
    
    // Clear state
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isReconnecting = false;
    
    // Update state manager
    await this.stateManager.resetState();
    
    this.emit("ROOM_DISCONNECTED", {});
  }

  /**
   * Handle WebSocket connection status changes for auto-rejoin
   */
  private async handleConnectionStatusChange(data: { status: ConnectionStatus }): Promise<void> {
    console.log(`[RoomConnectionService] Connection status changed to: ${data.status}`);
    
    // Forward status change
    this.emit("CONNECTION_STATUS_CHANGE", data);
    
    // Handle auto-rejoin on reconnection
    if (data.status === "CONNECTED" && this.isReconnecting && this.currentRoomId && this.currentUserId) {
      await this.performAutoRejoin();
    } else if (data.status === "DISCONNECTED" && this.currentRoomId) {
      // Mark as reconnecting for auto-rejoin
      this.isReconnecting = true;
    }
  }

  /**
   * Perform auto-rejoin after reconnection
   */
  private async performAutoRejoin(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) {
      return;
    }
    
    const currentRoom = this.stateManager.getCurrentRoom();
    const currentUser = this.stateManager.getCurrentUser();
    
    if (!currentRoom || !currentUser) {
      console.warn("[RoomConnectionService] Cannot auto-rejoin: missing room or user state");
      return;
    }
    
    try {
      console.log(`[RoomConnectionService] Auto-rejoining room ${this.currentRoomId}`);
      
      // Close existing WebRTC connections
      this.webrtc.closeAllConnections();
      
      // Fetch fresh TURN credentials
      const turnServers = await this.fetchTurnCredentials(currentUser.id);
      if (turnServers.length > defaultWebRTCConfig.iceServers.length) {
        this.webrtc.setIceServers(turnServers);
      }
      
      // Reinitialize WebRTC
      await this.webrtc.initialize(currentUser.id, currentUser.isHost);
      
      // Send rejoin message
      const result = await this.joinRoom(
        currentRoom.id,
        currentUser.id,
        currentUser.name
      );
      
      // Update state
      await this.stateManager.setRoom(result.room);
      await this.stateManager.setUser(result.user);
      await this.stateManager.setConnectionStatus("CONNECTED");
      
      this.isReconnecting = false;
      
      console.log("[RoomConnectionService] Auto-rejoin successful");
      this.emit("ROOM_REJOINED", result);
      
      // Trigger WebRTC reconnection
      this.emit("TRIGGER_WEBRTC_RECONNECT", {
        room: result.room,
        user: result.user
      });
      
    } catch (error) {
      console.error("[RoomConnectionService] Auto-rejoin failed:", error);
      this.isReconnecting = false;
      this.emit("AUTO_REJOIN_FAILED", { error });
    }
  }

  /**
   * Create a new room (private method)
   */
  private async createRoom(
    roomId: string,
    userId: string,
    userName: string,
    roomName: string
  ): Promise<ConnectionResult> {
    const message: CreateRoomMessage = {
      type: "CREATE_ROOM",
      roomId,
      userId,
      userName,
      roomName,
      timestamp: Date.now(),
    };
    
    await this.websocket.send(message);
    
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.websocket.off("ROOM_CREATED", onRoomCreated);
        this.websocket.off("ERROR", onError);
      };
      
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Room creation timeout"));
      }, 10000);
      
      const onRoomCreated = (response: any) => {
        if (response.type === "ROOM_CREATED" && response.roomId === roomId) {
          clearTimeout(timeout);
          cleanup();
          
          const roomState = response.roomState;
          const user = roomState.users.find((u: User) => u.id === userId) || null;
          
          if (!user) {
            reject(new Error("User not found in room after creation"));
            return;
          }
          
          // Set host status in WebRTC
          if (user.isHost) {
            this.webrtc.setHostStatus(true);
          }
          
          resolve({ room: roomState, user });
        }
      };
      
      const onError = (response: any) => {
        if (response.type === "ERROR") {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(response.error));
        }
      };
      
      this.websocket.on("ROOM_CREATED", onRoomCreated);
      this.websocket.on("ERROR", onError);
    });
  }

  /**
   * Join an existing room (private method)
   */
  private async joinRoom(
    roomId: string,
    userId: string,
    userName: string
  ): Promise<ConnectionResult> {
    const message: JoinRoomMessage = {
      type: "JOIN_ROOM",
      roomId,
      userId,
      userName,
      timestamp: Date.now(),
    };
    
    await this.websocket.send(message);
    
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.websocket.off("ROOM_JOINED", onRoomJoined);
        this.websocket.off("ERROR", onError);
      };
      
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Room join timeout"));
      }, 10000);
      
      const onRoomJoined = (response: any) => {
        if (response.type === "ROOM_JOINED" && response.roomId === roomId) {
          clearTimeout(timeout);
          cleanup();
          
          const roomState = response.roomState;
          const user = roomState.users.find((u: User) => u.id === userId) || null;
          
          if (!user) {
            reject(new Error("User not found in room after joining"));
            return;
          }
          
          // Set host status in WebRTC
          if (user.isHost) {
            this.webrtc.setHostStatus(true);
          }
          
          resolve({ room: roomState, user });
        }
      };
      
      const onError = (response: any) => {
        if (response.type === "ERROR") {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(response.error));
        }
      };
      
      this.websocket.on("ROOM_JOINED", onRoomJoined);
      this.websocket.on("ERROR", onError);
    });
  }

  /**
   * Ensure offscreen document is created and ready
   */
  private async ensureOffscreenDocument(): Promise<void> {
    if (this.offscreenDocumentReady) {
      return;
    }
    
    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
      });
      
      if (existingContexts.length > 0) {
        this.offscreenDocumentReady = true;
        console.log("[RoomConnectionService] Offscreen document already exists");
        return;
      }
      
      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA" as chrome.offscreen.Reason],
        justification: "WebRTC is not available in service workers",
      });
      
      this.offscreenDocumentReady = true;
      console.log("[RoomConnectionService] Offscreen document created successfully");
      
      // Give it a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error("[RoomConnectionService] Failed to create offscreen document:", error);
      throw new Error("Failed to initialize WebRTC support");
    }
  }

  /**
   * Fetch TURN credentials from server
   */
  private async fetchTurnCredentials(userId: string): Promise<RTCIceServer[]> {
    try {
      const wsUrl = new URL(this.config.websocketConfig.url);
      wsUrl.protocol = wsUrl.protocol.startsWith("wss") ? "https:" : "http:";
      wsUrl.pathname = "/turn-credentials";
      wsUrl.searchParams.set("userId", userId);
      
      const res = await fetch(wsUrl.toString());
      if (!res.ok) throw new Error("Failed to fetch TURN credentials");
      
      const data = await res.json();
      return [
        ...defaultWebRTCConfig.iceServers,
        ...(data.iceServers as RTCIceServer[]),
      ];
    } catch (err) {
      console.error("[RoomConnectionService] Failed to fetch TURN credentials", err);
      return defaultWebRTCConfig.iceServers;
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    this.webrtc.closeAllConnections();
    await this.websocket.disconnect();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isReconnecting = false;
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket events will be handled as needed
  }

  /**
   * Add event listener
   */
  on(eventType: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Get WebSocket manager (for RoomManager compatibility)
   */
  getWebSocketManager(): WebSocketManager {
    return this.websocket;
  }

  /**
   * Get WebRTC manager (for RoomManager compatibility)
   */
  getWebRTCManager(): WebRTCManager {
    return this.webrtc;
  }
}