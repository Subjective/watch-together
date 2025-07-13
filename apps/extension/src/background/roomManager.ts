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
  CreateRoomMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  WebRTCOfferMessage,
  WebRTCAnswerMessage,
  WebRTCIceCandidateMessage,
} from "@repo/types";

import { WebSocketManager, defaultWebSocketConfig } from "./websocket";
import { WebRTCManager } from "./webrtcBridge";
import { StorageManager } from "./storage";
import {
  adapterEventTarget,
  type AdapterEventDetail,
  sendAdapterCommand,
  getActiveAdapters,
} from "./adapterHandler";

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
   * Initialize room manager
   */
  async initialize(): Promise<void> {
    try {
      // Restore extension state from storage
      this.extensionState = await StorageManager.getExtensionState();

      // Restore internal room manager state from persisted extension state
      if (this.extensionState.currentRoom && this.extensionState.currentUser) {
        this.currentRoom = this.extensionState.currentRoom;
        this.currentUser = this.extensionState.currentUser;
        console.log(
          `Restored room state: ${this.currentRoom.name} (${this.currentRoom.id})`,
        );

        // Update connection status to reflect actual state (likely disconnected on startup)
        this.updateExtensionState({
          isConnected: false,
          connectionStatus: "DISCONNECTED",
        });
      }

      console.log("Room manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize room manager:", error);
      throw error;
    }
  }

  /**
   * Create a new room
   */
  async createRoom(_roomName: string, userName: string): Promise<RoomState> {
    try {
      const userId = this.generateUserId();
      const roomId = this.generateRoomId();

      // Disconnect any existing WebSocket connection
      await this.websocket.disconnect();

      // Update WebSocket URL with roomId
      const baseUrl = defaultWebSocketConfig.url;
      this.websocket.updateUrl(`${baseUrl}?roomId=${roomId}`);

      // Connect WebSocket with the roomId
      await this.websocket.connect();

      // Only proceed if truly connected
      if (!this.websocket.isConnected()) {
        throw new Error("Failed to establish stable WebSocket connection");
      }

      // Initialize WebRTC BEFORE creating the room
      await this.webrtc.initialize(userId, true);

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

        const onRoomCreated = async (response: any) => {
          if (response.type === "ROOM_CREATED" && response.roomId === roomId) {
            clearTimeout(timeout);
            this.websocket.off("ROOM_CREATED", onRoomCreated);

            this.currentRoom = response.roomState;
            this.currentUser =
              response.roomState.users.find((u: User) => u.id === userId) ||
              null;

            // WebRTC already initialized before creating room
            // Ensure WebRTC bridge knows we're the host
            if (this.currentUser?.isHost) {
              this.webrtc.setHostStatus(true);
              console.log(
                "[RoomManager] Set WebRTC host status to true for room creator",
              );
            } else {
              console.log(
                "[RoomManager] User is not host when creating room:",
                this.currentUser,
              );
            }

            this.updateExtensionState({
              isConnected: true,
              currentRoom: this.currentRoom,
              currentUser: this.currentUser,
              connectionStatus: "CONNECTED",
            });

            // Store room in history for host
            if (this.currentRoom) {
              StorageManager.addRoomToHistory(this.currentRoom);
            }

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
      // Disconnect any existing WebSocket connection
      await this.websocket.disconnect();

      // Update WebSocket URL with roomId
      const baseUrl = defaultWebSocketConfig.url;
      this.websocket.updateUrl(`${baseUrl}?roomId=${roomId}`);

      // Connect WebSocket with the roomId
      await this.websocket.connect();

      // Only proceed if truly connected
      if (!this.websocket.isConnected()) {
        throw new Error("Failed to establish stable WebSocket connection");
      }

      const userId = this.generateUserId();

      // Initialize WebRTC BEFORE joining the room
      // This ensures offscreen document is ready when offers arrive
      await this.webrtc.initialize(userId, false);

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

        const onRoomJoined = async (response: any) => {
          if (response.type === "ROOM_JOINED" && response.roomId === roomId) {
            clearTimeout(timeout);
            this.websocket.off("ROOM_JOINED", onRoomJoined);

            this.currentRoom = response.roomState;
            this.currentUser =
              response.roomState.users.find((u: User) => u.id === userId) ||
              null;

            // WebRTC already initialized before joining
            // Ensure WebRTC bridge knows our host status
            console.log(
              "[RoomManager] Join response - current user:",
              this.currentUser,
            );
            console.log(
              "[RoomManager] Join response - all users:",
              response.roomState.users,
            );
            if (this.currentUser?.isHost) {
              this.webrtc.setHostStatus(true);
              console.log(
                "[RoomManager] Set WebRTC host status to true for room joiner",
              );
            } else {
              console.log(
                "[RoomManager] User is not host when joining room, isHost:",
                this.currentUser?.isHost,
              );
            }

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

      // Try to send LEAVE_ROOM message, but don't fail if WebSocket is disconnected
      try {
        const message: LeaveRoomMessage = {
          type: "LEAVE_ROOM",
          roomId: this.currentRoom.id,
          userId: this.currentUser.id,
          timestamp: Date.now(),
        };

        await this.websocket.send(message);
      } catch (sendError) {
        // WebSocket might be disconnected (server down, etc.)
        // Continue with cleanup anyway
        console.warn("Could not send LEAVE_ROOM message:", sendError);
      }

      // Always perform cleanup regardless of whether message was sent
      // Close WebRTC connections
      this.webrtc.closeAllConnections();

      // Disconnect WebSocket to clean up connection state
      await this.websocket.disconnect();

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
  async cleanup(): Promise<void> {
    this.webrtc.closeAllConnections();
    await this.websocket.disconnect();
    this.websocket.reset(); // Reset WebSocket state for fresh initialization
    this.eventListeners.clear();
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

    // Adapter event handlers
    adapterEventTarget.addEventListener("adapter:event", (event) => {
      const customEvent = event as CustomEvent<AdapterEventDetail>;
      this.handleAdapterEvent(customEvent.detail);
    });
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

  private async handleUserLeft(response: any): Promise<void> {
    if (this.currentRoom && response.roomId === this.currentRoom.id) {
      this.currentRoom = response.roomState;

      // Close WebRTC connection to departed user
      this.webrtc.closePeerConnection(response.leftUserId);

      // Handle host promotion
      if (
        response.newHostId === this.currentUser?.id &&
        this.currentUser &&
        this.currentRoom
      ) {
        this.currentUser.isHost = true;
        // Update WebRTC bridge host status to enable control mode changes
        this.webrtc.setHostStatus(true);

        // Establish connections to all users (following existing pattern)
        for (const user of this.currentRoom.users) {
          if (user.id !== this.currentUser.id) {
            try {
              const offer = await this.webrtc.createOffer(user.id);
              await this.websocket.send({
                type: "WEBRTC_OFFER",
                roomId: this.currentRoom.id,
                userId: this.currentUser.id,
                targetUserId: user.id,
                offer,
                timestamp: Date.now(),
              });
            } catch (error) {
              console.error(`Failed to connect to ${user.id}:`, error);
            }
          }
        }
      }

      this.updateExtensionState({
        currentRoom: this.currentRoom,
      });

      console.log("User left room:", response.leftUserId);
    }
  }

  private async handleWebRTCOffer(message: any): Promise<void> {
    if (message.targetUserId === this.currentUser?.id) {
      try {
        // Find if the offering user is the host
        const offeringUser = this.currentRoom?.users.find(
          (u) => u.id === message.userId,
        );

        console.log("Handling WebRTC offer from:", message.userId);

        const answer = await this.webrtc.createAnswer(
          message.userId,
          message.offer,
        );

        // Mark the peer as host if they are
        if (offeringUser?.isHost) {
          await this.webrtc.markPeerAsHost(message.userId);
        }

        const answerMessage: WebRTCAnswerMessage = {
          type: "WEBRTC_ANSWER",
          roomId: message.roomId,
          userId: this.currentUser!.id,
          targetUserId: message.userId,
          answer,
          timestamp: Date.now(),
        };

        await this.websocket.send(answerMessage);
        console.log("Sent WebRTC answer to:", message.userId);
      } catch (error) {
        console.error("Failed to handle WebRTC offer:", error);
        // If it's a port closed error, the offscreen might not be ready yet
        if (error && typeof error === "object" && "message" in error) {
          const errorMessage = (error as any).message;
          if (
            typeof errorMessage === "string" &&
            errorMessage.includes("port closed")
          ) {
            console.log(
              "Offscreen document not ready, will retry offer handling",
            );
            // Store the offer to retry later
            // In a real implementation, you'd want to queue this and retry
          }
        }
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
      // Validate WebSocket connection before sending ICE candidate
      if (!this.websocket.isConnected()) {
        console.warn("WebSocket not connected, deferring ICE candidate");
        // TODO: Queue ICE candidate for retry when connection is restored
        return;
      }

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
        // TODO: Queue ICE candidate for retry when connection is restored
      }
    }
  }

  private async handleHostStateUpdate(message: any): Promise<void> {
    console.log(`[RoomManager] Received host state update:`, message);

    // Client receives host state update
    if (!this.currentUser?.isHost) {
      console.log(`[RoomManager] Applying host state as client`);
      await this.applyVideoState(message);
    } else {
      console.log(`[RoomManager] Ignoring host state update - we are the host`);
    }
  }

  private async handleClientRequest(message: any): Promise<void> {
    // Host handles client requests
    if (this.currentUser?.isHost) {
      // Get the active adapter tab
      const activeTab = await this.getActiveAdapterTab();
      if (!activeTab) return;

      try {
        switch (message.type) {
          case "CLIENT_REQUEST_PLAY":
            await sendAdapterCommand(activeTab, "play");
            break;
          case "CLIENT_REQUEST_PAUSE":
            await sendAdapterCommand(activeTab, "pause");
            break;
          case "CLIENT_REQUEST_SEEK":
            await sendAdapterCommand(activeTab, "seek", { time: message.time });
            break;
        }
      } catch (error) {
        console.error("Failed to handle client request:", error);
      }
    }
  }

  private async handleDirectCommand(message: any): Promise<void> {
    // Only process direct commands in FREE_FOR_ALL mode
    if (!this.currentRoom || this.currentRoom.controlMode !== "FREE_FOR_ALL") {
      console.warn(
        `[RoomManager] Ignoring direct command in ${this.currentRoom?.controlMode || "unknown"} mode:`,
        message.type,
      );
      return;
    }

    // In free-for-all mode, apply commands directly
    await this.applyVideoState({
      state:
        message.type === "DIRECT_PLAY"
          ? "PLAYING"
          : message.type === "DIRECT_PAUSE"
            ? "PAUSED"
            : "SEEKING",
      time: message.time,
      timestamp: message.timestamp,
      fromUserId: message.fromUserId,
    });
  }

  private async applyVideoState(message: {
    state: string;
    time: number;
    timestamp: number;
    fromUserId?: string;
  }): Promise<void> {
    const activeTab = await this.getActiveAdapterTab();
    if (!activeTab) {
      console.warn(`[RoomManager] No active adapter tab found to apply state`);
      return;
    }

    console.log(`[RoomManager] Applying video state to tab ${activeTab}:`, {
      state: message.state,
      time: message.time,
      fromUser: message.fromUserId,
    });

    try {
      // Apply latency compensation
      const latency = this.calculateLatency(message.timestamp);
      const compensatedTime = message.time + latency / 1000; // Convert ms to seconds

      // Apply the state
      if (message.state === "PLAYING") {
        console.log(`[RoomManager] Sending play command to adapter`);
        await sendAdapterCommand(activeTab, "play");
      } else if (message.state === "PAUSED") {
        console.log(`[RoomManager] Sending pause command to adapter`);
        await sendAdapterCommand(activeTab, "pause");
      }

      // Only sync the time if there's a significant difference
      if (message.time !== undefined) {
        // Get current adapter state to check time difference
        const adapters = getActiveAdapters();
        const currentAdapter = adapters.find((a) => a.tabId === activeTab);

        if (currentAdapter) {
          const timeDiff = Math.abs(
            currentAdapter.state.currentTime - compensatedTime,
          );

          // Only seek if the difference is greater than tolerance
          if (timeDiff > this.seekTolerance) {
            console.log(
              `[RoomManager] Seeking to time: ${compensatedTime}s (diff: ${timeDiff}s)`,
            );
            await sendAdapterCommand(activeTab, "seek", {
              time: compensatedTime,
            });
          } else {
            console.log(
              `[RoomManager] Skipping seek, within tolerance (diff: ${timeDiff}s)`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to apply video state:", error);
    }
  }

  private async getActiveAdapterTab(): Promise<number | null> {
    const adapters = getActiveAdapters();
    if (adapters.length === 0) {
      console.warn("No active adapters found");
      return null;
    }

    // Try to find an adapter in the current active tab first
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = tabs[0]?.id;

    if (activeTabId) {
      const activeAdapter = adapters.find((a) => a.tabId === activeTabId);
      if (activeAdapter) {
        return activeAdapter.tabId;
      }
    }

    // Otherwise use the first connected adapter
    const connectedAdapter = adapters.find((a) => a.connected);
    if (connectedAdapter) {
      return connectedAdapter.tabId;
    }

    // Fallback to first adapter
    return adapters[0].tabId;
  }

  private calculateLatency(remoteTimestamp: number): number {
    const now = Date.now();
    const latency = Math.max(0, now - remoteTimestamp);
    // Cap latency compensation at 500ms to avoid over-correction
    return Math.min(latency, 500);
  }

  // Sync tolerance and throttling
  private lastTimeupdateSync = 0;
  private timeupdateThrottleMs = 1000; // Minimum time between timeupdate syncs (1s)
  private seekTolerance = 0.5; // Don't seek if within 0.5 seconds

  private handleControlModeChange(message: any): void {
    console.log("[RoomManager] Received control mode change:", message);
    if (this.currentRoom) {
      console.log(
        `[RoomManager] Updating control mode from ${this.currentRoom.controlMode} to ${message.mode}`,
      );
      this.currentRoom.controlMode = message.mode;
      this.webrtc.setControlMode(message.mode);

      this.updateExtensionState({
        currentRoom: this.currentRoom,
      });

      this.emit("CONTROL_MODE_CHANGED", {
        mode: message.mode,
        fromUserId: message.fromUserId,
      });
      console.log("[RoomManager] Control mode change processed successfully");
    } else {
      console.warn(
        "[RoomManager] Cannot process control mode change - no current room",
      );
    }
  }

  private handleHostNavigate(message: any): void {
    this.emit("HOST_NAVIGATE", {
      url: message.url,
      fromUserId: message.fromUserId,
    });
  }

  private async handleAdapterEvent(detail: AdapterEventDetail): Promise<void> {
    // Only process events if we're in a room and connected
    if (!this.currentRoom || !this.currentUser) {
      return;
    }

    // Handle different adapter events
    switch (detail.event) {
      case "play":
      case "pause":
      case "seeking":
      case "seeked":
        // For control events, broadcast based on control mode
        if (this.currentRoom.controlMode === "HOST_ONLY") {
          // In host-only mode, only the host can trigger control events
          if (this.currentUser.isHost) {
            await this.broadcastHostStateUpdate(detail);
          } else {
            // Block adapter events from non-host participants in HOST_ONLY mode
            console.warn(
              `[RoomManager] Ignoring video control event from non-host participant in HOST_ONLY mode:`,
              detail.event,
            );
            return;
          }
        } else {
          // In free-for-all mode, everyone broadcasts directly
          await this.broadcastDirectCommand(detail);
        }
        break;

      case "timeupdate": {
        // Handle timeupdate events for drift detection with separate throttling
        const timeupdateNow = Date.now();
        if (
          timeupdateNow - this.lastTimeupdateSync >=
          this.timeupdateThrottleMs
        ) {
          this.lastTimeupdateSync = timeupdateNow;

          // Only broadcast timeupdate in host-only mode from the host
          if (
            this.currentRoom.controlMode === "HOST_ONLY" &&
            this.currentUser.isHost
          ) {
            await this.broadcastHostStateUpdate(detail);
          }
          // In free-for-all mode, timeupdate events are used for drift detection
          // but we don't broadcast them to avoid conflicts
        }
        break;
      }
    }
  }

  private async broadcastHostStateUpdate(
    detail: AdapterEventDetail,
  ): Promise<void> {
    const state = detail.state.isPaused ? "PAUSED" : "PLAYING";

    // Only log significant events, not timeupdate
    if (detail.event !== "timeupdate") {
      console.log(
        `[RoomManager] Broadcasting host state: ${state} at ${detail.state.currentTime}s`,
      );
    }

    await this.webrtc.sendSyncMessage({
      type: "HOST_STATE_UPDATE",
      userId: this.currentUser!.id,
      state,
      time: detail.state.currentTime,
      timestamp: detail.timestamp,
    });
  }

  private async broadcastDirectCommand(
    detail: AdapterEventDetail,
  ): Promise<void> {
    // Defensive check: don't broadcast if not in a room
    if (!this.currentRoom || !this.currentUser) {
      return;
    }

    let messageType: "DIRECT_PLAY" | "DIRECT_PAUSE" | "DIRECT_SEEK";

    switch (detail.event) {
      case "play":
        messageType = "DIRECT_PLAY";
        break;
      case "pause":
        messageType = "DIRECT_PAUSE";
        break;
      case "seeking":
      case "seeked":
        messageType = "DIRECT_SEEK";
        break;
      default:
        return;
    }

    this.webrtc.sendSyncMessage({
      type: messageType,
      userId: this.currentUser.id,
      time: detail.state.currentTime,
      timestamp: detail.timestamp,
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
