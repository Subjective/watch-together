/**
 * Room management for Watch Together extension
 * Handles room state, user management, and coordination between WebSocket and WebRTC
 */

import type {
  RoomState,
  User,
  ExtensionState,
  ControlMode,
  FollowMode,
  ConnectionState,
  CreateRoomMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  WebRTCOfferMessage,
  WebRTCAnswerMessage,
  WebRTCIceCandidateMessage,
} from "@repo/types";

import { WebSocketManager, defaultWebSocketConfig } from "./websocket";
import { WebRTCManager } from "./webrtc";
import { StorageManager } from "./storage";

export interface RoomManagerConfig {
  websocketUrl: string;
  webrtcConfig: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize: number;
  };
}

export class RoomManager {
  private websocket: WebSocketManager;
  private webrtc: WebRTCManager;
  private currentRoom: RoomState | null = null;
  private currentUser: User | null = null;
  private extensionState: ExtensionState;
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  private pendingRestoreState: { room: RoomState; user: User } | null = null;

  constructor(config: RoomManagerConfig) {
    // Initialize WebSocket manager
    this.websocket = new WebSocketManager({
      url: config.websocketUrl,
      maxRetries: 5,
      baseRetryDelay: 1000,
      maxRetryDelay: 30000,
      heartbeatInterval: 30000,
    });

    // Initialize WebRTC manager
    this.webrtc = new WebRTCManager({
      iceServers: config.webrtcConfig.iceServers,
      iceCandidatePoolSize: config.webrtcConfig.iceCandidatePoolSize,
      dataChannelOptions: {
        ordered: true,
        maxRetransmits: 3,
      },
    });

    // Initialize extension state
    this.extensionState = {
      isConnected: false,
      currentRoom: null,
      connectionStatus: "DISCONNECTED",
      currentUser: null,
      followMode: "AUTO_FOLLOW",
      hasFollowNotification: false,
      followNotificationUrl: null,
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize room manager and restore state from storage
   */
  async initialize(): Promise<void> {
    try {
      // Restore extension state from storage
      this.extensionState = await StorageManager.getExtensionState();

      // Check if we have an existing connection to restore
      const connectionState = await StorageManager.getConnectionState();
      if (connectionState) {
        console.log(
          "Found existing connection state, attempting to restore...",
        );
        await this.restoreConnection(connectionState);
      } else {
        console.log(
          "No existing connection state found (WebSocket will connect when room is created/joined)",
        );
      }

      console.log("Room manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize room manager:", error);
      throw error;
    }
  }

  /**
   * Restore connection from persisted state
   */
  private async restoreConnection(
    connectionState: ConnectionState,
  ): Promise<void> {
    try {
      // Validate connection state age (don't restore very old states)
      const maxStateAge = 24 * 60 * 60 * 1000; // 24 hours
      const stateAge = Date.now() - connectionState.lastActivity;
      if (stateAge > maxStateAge) {
        console.log(
          "Connection state too old, clearing:",
          Math.round(stateAge / 3600000),
          "hours",
        );
        await StorageManager.clearConnectionState();
        return;
      }

      // Validate connection state structure
      if (!this.validateConnectionState(connectionState)) {
        console.error("Invalid connection state structure");
        await StorageManager.clearConnectionState();
        return;
      }

      // Update WebSocket URL with room ID
      const baseUrl = defaultWebSocketConfig.url;
      this.websocket["config"].url =
        `${baseUrl}?roomId=${connectionState.roomId}`;

      // Store pending restore state (don't apply until validated)
      const restoredUser = connectionState.roomState.users.find(
        (u) => u.id === connectionState.userId,
      );

      if (!restoredUser) {
        console.error("Could not find user in restored room state");
        await StorageManager.clearConnectionState();
        return;
      }

      this.pendingRestoreState = {
        room: connectionState.roomState,
        user: restoredUser,
      };

      // Update extension state to show reconnecting without room details
      this.updateExtensionState({
        isConnected: false,
        currentRoom: null, // Don't show room until validated
        currentUser: null, // Don't show user until validated
        connectionStatus: "RECONNECTING",
      });

      // Attempt to reconnect WebSocket
      await this.websocket.connect();

      // Initialize WebRTC
      this.webrtc.initialize(connectionState.userId, connectionState.isHost);

      // Validate connection with server by sending a PING
      await this.validateServerConnection();

      // Validation succeeded - apply the pending restore state
      if (this.pendingRestoreState) {
        this.currentRoom = this.pendingRestoreState.room;
        this.currentUser = this.pendingRestoreState.user;
        this.pendingRestoreState = null;

        // Update extension state with restored room and user
        this.updateExtensionState({
          isConnected: true,
          currentRoom: this.currentRoom,
          currentUser: this.currentUser,
          connectionStatus: "CONNECTED",
        });
      }

      console.log("Connection restored successfully");
    } catch (error) {
      console.error("Failed to restore connection:", error);

      // Clear invalid connection state
      await StorageManager.clearConnectionState();

      // Clear pending restore state
      this.pendingRestoreState = null;

      // Reset to disconnected state
      this.currentRoom = null;
      this.currentUser = null;
      this.updateExtensionState({
        isConnected: false,
        currentRoom: null,
        currentUser: null,
        connectionStatus: "DISCONNECTED",
      });
    }
  }

  /**
   * Validate connection state structure
   */
  private validateConnectionState(state: ConnectionState): boolean {
    try {
      // Check required fields
      if (
        !state.roomId ||
        !state.userId ||
        !state.userName ||
        !state.websocketUrl
      ) {
        console.error("Missing required connection state fields");
        return false;
      }

      // Validate room state structure
      if (!state.roomState || !state.roomState.id || !state.roomState.users) {
        console.error("Invalid room state structure");
        return false;
      }

      // Check if user exists in room state
      const userExists = state.roomState.users.some(
        (u) => u.id === state.userId,
      );
      if (!userExists) {
        console.error("User not found in room state");
        return false;
      }

      // Check timestamps are reasonable
      const now = Date.now();
      if (state.connectedAt > now || state.lastActivity > now) {
        console.error("Invalid timestamps in connection state");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating connection state:", error);
      return false;
    }
  }

  /**
   * Validate connection with server
   */
  private async validateServerConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server validation timeout"));
      }, 5000); // 5 second timeout

      // Listen for PONG response
      const pongHandler = (data: any) => {
        if (data.type === "PONG") {
          clearTimeout(timeout);
          this.websocket.off("message", pongHandler);
          resolve();
        }
      };

      this.websocket.on("message", pongHandler);

      // Send PING to validate connection
      this.websocket.send({
        type: "PING",
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Create a new room
   */
  async createRoom(_roomName: string, userName: string): Promise<RoomState> {
    try {
      const userId = this.generateUserId();
      const roomId = this.generateRoomId();

      // Update WebSocket URL with roomId
      const baseUrl = defaultWebSocketConfig.url;
      this.websocket["config"].url = `${baseUrl}?roomId=${roomId}`;

      // Connect WebSocket with the roomId
      await this.websocket.connect();

      const message: CreateRoomMessage = {
        type: "CREATE_ROOM",
        roomId,
        userId,
        userName,
        timestamp: Date.now(),
      };

      await this.websocket.send(message);

      // Wait for room creation response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Room creation timeout"));
        }, 10000);

        const onRoomCreated = (response: any) => {
          if (response.type === "ROOM_CREATED" && response.roomId === roomId) {
            clearTimeout(timeout);
            this.websocket.off("ROOM_CREATED", onRoomCreated);

            this.currentRoom = response.roomState;
            this.currentUser =
              response.roomState.users.find((u: User) => u.id === userId) ||
              null;

            // Initialize WebRTC as host
            this.webrtc.initialize(userId, true);

            this.updateExtensionState({
              isConnected: true,
              currentRoom: this.currentRoom,
              currentUser: this.currentUser,
              connectionStatus: "CONNECTED",
            });

            // Save connection state for persistence
            this.saveConnectionState(roomId, userId, userName, true);

            resolve(this.currentRoom!);
          }
        };

        const onError = (response: any) => {
          if (response.type === "ERROR") {
            clearTimeout(timeout);
            this.websocket.off("ERROR", onError);
            reject(new Error(response.error));
          }
        };

        this.websocket.on("ROOM_CREATED", onRoomCreated);
        this.websocket.on("ERROR", onError);
      });
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, userName: string): Promise<RoomState> {
    try {
      // Update WebSocket URL with roomId
      const baseUrl = defaultWebSocketConfig.url;
      this.websocket["config"].url = `${baseUrl}?roomId=${roomId}`;

      // Connect WebSocket with the roomId
      await this.websocket.connect();

      const userId = this.generateUserId();

      const message: JoinRoomMessage = {
        type: "JOIN_ROOM",
        roomId,
        userId,
        userName,
        timestamp: Date.now(),
      };

      await this.websocket.send(message);

      // Wait for room join response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Room join timeout"));
        }, 10000);

        const onRoomJoined = (response: any) => {
          if (response.type === "ROOM_JOINED" && response.roomId === roomId) {
            clearTimeout(timeout);
            this.websocket.off("ROOM_JOINED", onRoomJoined);

            this.currentRoom = response.roomState;
            this.currentUser =
              response.roomState.users.find((u: User) => u.id === userId) ||
              null;

            // Initialize WebRTC as client
            this.webrtc.initialize(userId, false);

            this.updateExtensionState({
              isConnected: true,
              currentRoom: this.currentRoom,
              currentUser: this.currentUser,
              connectionStatus: "CONNECTED",
            });

            // Store room in history
            if (this.currentRoom) {
              StorageManager.addRoomToHistory(this.currentRoom);
            }

            // Save connection state for persistence
            this.saveConnectionState(roomId, userId, userName, false);

            resolve(this.currentRoom!);
          }
        };

        const onError = (response: any) => {
          if (response.type === "ERROR") {
            clearTimeout(timeout);
            this.websocket.off("ERROR", onError);
            reject(new Error(response.error));
          }
        };

        this.websocket.on("ROOM_JOINED", onRoomJoined);
        this.websocket.on("ERROR", onError);
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    try {
      if (!this.currentRoom || !this.currentUser) {
        return;
      }

      const message: LeaveRoomMessage = {
        type: "LEAVE_ROOM",
        roomId: this.currentRoom.id,
        userId: this.currentUser.id,
        timestamp: Date.now(),
      };

      await this.websocket.send(message);

      // Close WebRTC connections
      this.webrtc.closeAllConnections();

      // Clear persisted connection state
      await StorageManager.clearConnectionState();

      // Reset state
      this.currentRoom = null;
      this.currentUser = null;

      this.updateExtensionState({
        isConnected: false,
        currentRoom: null,
        currentUser: null,
        connectionStatus: "DISCONNECTED",
        hasFollowNotification: false,
        followNotificationUrl: null,
      });

      console.log("Left room successfully");
    } catch (error) {
      console.error("Failed to leave room:", error);
      throw error;
    }
  }

  /**
   * Toggle control mode (host only)
   */
  async toggleControlMode(): Promise<void> {
    if (!this.currentRoom || !this.currentUser?.isHost) {
      throw new Error("Only host can toggle control mode");
    }

    const newMode: ControlMode =
      this.currentRoom.controlMode === "HOST_ONLY"
        ? "FREE_FOR_ALL"
        : "HOST_ONLY";

    // Update local state
    this.currentRoom.controlMode = newMode;
    this.webrtc.setControlMode(newMode);

    // Broadcast to peers
    await this.webrtc.broadcastControlModeChange(newMode);

    // Update storage
    this.updateExtensionState({
      currentRoom: this.currentRoom,
    });

    console.log("Control mode changed to:", newMode);
  }

  /**
   * Set follow mode
   */
  async setFollowMode(mode: FollowMode): Promise<void> {
    this.extensionState.followMode = mode;

    // Update user preferences
    await StorageManager.updateUserPreferences({ followMode: mode });

    this.updateExtensionState({
      followMode: mode,
    });

    console.log("Follow mode set to:", mode);
  }

  /**
   * Send video control command
   */
  async sendVideoControl(
    action: "PLAY" | "PAUSE" | "SEEK",
    seekTime?: number,
  ): Promise<void> {
    if (!this.currentRoom || !this.currentUser) {
      throw new Error("Not in a room");
    }

    if (this.currentRoom.controlMode === "HOST_ONLY") {
      if (this.currentUser.isHost) {
        // Host broadcasts state update
        await this.webrtc.broadcastHostState(
          action === "PLAY" ? "PLAYING" : "PAUSED",
          seekTime || 0,
        );
      } else {
        // Client sends request to host
        await this.webrtc.sendClientRequest(action, seekTime);
      }
    } else {
      // FREE_FOR_ALL mode - send direct command
      await this.webrtc.sendDirectCommand(action, seekTime);
    }
  }

  /**
   * Get current extension state
   */
  getExtensionState(): ExtensionState {
    return { ...this.extensionState };
  }

  /**
   * Get current room state
   */
  getCurrentRoom(): RoomState | null {
    return this.currentRoom ? { ...this.currentRoom } : null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser ? { ...this.currentUser } : null;
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
   * Cleanup resources
   */
  cleanup(): void {
    this.webrtc.closeAllConnections();
    this.websocket.disconnect();
    this.eventListeners.clear();
  }

  /**
   * Save connection state for persistence across Service Worker restarts
   */
  private async saveConnectionState(
    roomId: string,
    userId: string,
    userName: string,
    isHost: boolean,
  ): Promise<void> {
    if (!this.currentRoom) return;

    const connectionState: ConnectionState = {
      roomId,
      userId,
      userName,
      isHost,
      websocketUrl: this.websocket["config"].url,
      roomState: this.currentRoom,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    try {
      await StorageManager.setConnectionState(connectionState);
      console.log("Connection state saved for persistence");
    } catch (error) {
      console.error("Failed to save connection state:", error);
    }
  }

  private setupEventHandlers(): void {
    // WebSocket event handlers
    this.websocket.on("CONNECTION_STATUS_CHANGE", (data) => {
      this.updateExtensionState({
        connectionStatus: data.status,
        isConnected: data.status === "CONNECTED",
      });
    });

    this.websocket.on("USER_JOINED", this.handleUserJoined.bind(this));
    this.websocket.on("USER_LEFT", this.handleUserLeft.bind(this));
    this.websocket.on("WEBRTC_OFFER", this.handleWebRTCOffer.bind(this));
    this.websocket.on("WEBRTC_ANSWER", this.handleWebRTCAnswer.bind(this));
    this.websocket.on(
      "WEBRTC_ICE_CANDIDATE",
      this.handleWebRTCIceCandidate.bind(this),
    );

    // WebRTC event handlers
    this.webrtc.on("ICE_CANDIDATE", this.handleLocalIceCandidate.bind(this));
    this.webrtc.on("HOST_STATE_UPDATE", this.handleHostStateUpdate.bind(this));
    this.webrtc.on("CLIENT_REQUEST_PLAY", this.handleClientRequest.bind(this));
    this.webrtc.on("CLIENT_REQUEST_PAUSE", this.handleClientRequest.bind(this));
    this.webrtc.on("CLIENT_REQUEST_SEEK", this.handleClientRequest.bind(this));
    this.webrtc.on("DIRECT_PLAY", this.handleDirectCommand.bind(this));
    this.webrtc.on("DIRECT_PAUSE", this.handleDirectCommand.bind(this));
    this.webrtc.on("DIRECT_SEEK", this.handleDirectCommand.bind(this));
    this.webrtc.on(
      "CONTROL_MODE_CHANGE",
      this.handleControlModeChange.bind(this),
    );
    this.webrtc.on("HOST_NAVIGATE", this.handleHostNavigate.bind(this));
  }

  private async handleUserJoined(response: any): Promise<void> {
    if (this.currentRoom && response.roomId === this.currentRoom.id) {
      this.currentRoom = response.roomState;

      this.updateExtensionState({
        currentRoom: this.currentRoom,
      });

      // If we're the host, initiate WebRTC connection to new user
      if (
        this.currentUser?.isHost &&
        response.joinedUser.id !== this.currentUser.id
      ) {
        try {
          const offer = await this.webrtc.createOffer(response.joinedUser.id);

          const offerMessage: WebRTCOfferMessage = {
            type: "WEBRTC_OFFER",
            roomId: this.currentRoom!.id,
            userId: this.currentUser!.id,
            targetUserId: response.joinedUser.id,
            offer,
            timestamp: Date.now(),
          };

          await this.websocket.send(offerMessage);
        } catch (error) {
          console.error("Failed to create offer for new user:", error);
        }
      }

      console.log("User joined room:", response.joinedUser.name);
    }
  }

  private handleUserLeft(response: any): void {
    if (this.currentRoom && response.roomId === this.currentRoom.id) {
      this.currentRoom = response.roomState;

      // Close WebRTC connection to departed user
      this.webrtc.closePeerConnection(response.leftUserId);

      this.updateExtensionState({
        currentRoom: this.currentRoom,
      });

      console.log("User left room:", response.leftUserId);
    }
  }

  private async handleWebRTCOffer(message: any): Promise<void> {
    if (message.targetUserId === this.currentUser?.id) {
      try {
        const answer = await this.webrtc.createAnswer(
          message.userId,
          message.offer,
        );

        const answerMessage: WebRTCAnswerMessage = {
          type: "WEBRTC_ANSWER",
          roomId: message.roomId,
          userId: this.currentUser!.id,
          targetUserId: message.userId,
          answer,
          timestamp: Date.now(),
        };

        await this.websocket.send(answerMessage);
      } catch (error) {
        console.error("Failed to handle WebRTC offer:", error);
      }
    }
  }

  private async handleWebRTCAnswer(message: any): Promise<void> {
    if (message.targetUserId === this.currentUser?.id) {
      try {
        await this.webrtc.handleAnswer(message.userId, message.answer);
      } catch (error) {
        console.error("Failed to handle WebRTC answer:", error);
      }
    }
  }

  private async handleWebRTCIceCandidate(message: any): Promise<void> {
    if (message.targetUserId === this.currentUser?.id) {
      try {
        await this.webrtc.addIceCandidate(message.userId, message.candidate);
      } catch (error) {
        console.error("Failed to handle ICE candidate:", error);
      }
    }
  }

  private async handleLocalIceCandidate(data: any): Promise<void> {
    if (this.currentRoom && this.currentUser) {
      const candidateMessage: WebRTCIceCandidateMessage = {
        type: "WEBRTC_ICE_CANDIDATE",
        roomId: this.currentRoom.id,
        userId: this.currentUser.id,
        targetUserId: data.targetUserId,
        candidate: data.candidate,
        timestamp: Date.now(),
      };

      try {
        await this.websocket.send(candidateMessage);
      } catch (error) {
        console.error("Failed to send ICE candidate:", error);
      }
    }
  }

  private handleHostStateUpdate(message: any): void {
    // Forward to content script for video control
    this.emit("VIDEO_CONTROL", {
      action: message.state === "PLAYING" ? "PLAY" : "PAUSE",
      time: message.time,
      timestamp: message.timestamp,
    });
  }

  private handleClientRequest(message: any): void {
    // Host should handle client requests
    if (this.currentUser?.isHost) {
      this.emit("CLIENT_REQUEST", {
        action: message.type.replace("CLIENT_REQUEST_", ""),
        time: message.time,
        fromUserId: message.fromUserId,
      });
    }
  }

  private handleDirectCommand(message: any): void {
    // Forward direct commands to content script
    this.emit("VIDEO_CONTROL", {
      action: message.type.replace("DIRECT_", ""),
      time: message.time,
      timestamp: message.timestamp,
      fromUserId: message.fromUserId,
    });
  }

  private handleControlModeChange(message: any): void {
    if (this.currentRoom) {
      this.currentRoom.controlMode = message.mode;
      this.webrtc.setControlMode(message.mode);

      this.updateExtensionState({
        currentRoom: this.currentRoom,
      });

      this.emit("CONTROL_MODE_CHANGED", {
        mode: message.mode,
        fromUserId: message.fromUserId,
      });
    }
  }

  private handleHostNavigate(message: any): void {
    this.emit("HOST_NAVIGATE", {
      url: message.url,
      fromUserId: message.fromUserId,
    });
  }

  private async updateExtensionState(
    updates: Partial<ExtensionState>,
  ): Promise<void> {
    this.extensionState = { ...this.extensionState, ...updates };

    try {
      await StorageManager.setExtensionState(this.extensionState);
      this.emit("STATE_UPDATE", this.extensionState);
    } catch (error) {
      console.error("Failed to update extension state:", error);
    }
  }

  private emit(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRoomId(): string {
    return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
