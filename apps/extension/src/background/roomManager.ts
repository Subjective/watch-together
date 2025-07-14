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
  private lastHostVideoUrl: string | null = null;

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
  async createRoom(roomName: string, userName: string): Promise<RoomState> {
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
        roomName: roomName,
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
   * Update host current URL for display purposes only (no auto-follow)
   */
  async updateHostCurrentUrl(url: string): Promise<void> {
    if (!this.currentRoom || !this.currentUser) {
      throw new Error("Not in a room");
    }
    if (!this.currentUser.isHost) {
      console.warn("Only host can update current URL");
      return;
    }
    // Update room state with host's current URL (for display only)
    this.currentRoom.hostCurrentUrl = url;
    this.updateExtensionState({
      currentRoom: this.currentRoom,
    });
    console.log("Host current URL updated for display:", url);
  }

  /**
   * Handle host video switch for auto-follow functionality
   */
  private async handleHostVideoSwitch(hostVideoUrl: string): Promise<void> {
    try {
      if (this.extensionState.followMode === "AUTO_FOLLOW") {
        // Check if participant already has this video URL open
        const hasExistingTab = await this.hasTabWithVideoUrl(hostVideoUrl);

        if (hasExistingTab) {
          console.log(
            "Auto-follow: Switching to existing tab with host's video",
          );
          await this.switchToTabWithVideoUrl(hostVideoUrl);
        } else {
          console.log("Auto-follow: Creating new tab for host's video");
          await this.createTabForVideo(hostVideoUrl);
        }
      } else {
        // Manual follow mode - show notification
        console.log("Manual follow: Showing notification for host's video");
        await StorageManager.updateExtensionState({
          hasFollowNotification: true,
          followNotificationUrl: hostVideoUrl,
        });

        // Broadcast state update to trigger UI refresh
        this.emit("STATE_UPDATE", this.getExtensionState());
      }
    } catch (error) {
      console.error("Failed to handle host video switch:", error);
    }
  }

  /**
   * Check if participant has a tab with the given video URL
   */
  private async hasTabWithVideoUrl(videoUrl: string): Promise<boolean> {
    try {
      // Basic security check for dangerous protocols only
      if (
        videoUrl.startsWith("data:") ||
        videoUrl.startsWith("javascript:") ||
        videoUrl.startsWith("file:")
      ) {
        console.warn("Dangerous video URL blocked:", videoUrl);
        return false;
      }

      const tabs = await chrome.tabs.query({ url: videoUrl });
      return tabs.length > 0;
    } catch (error) {
      console.error("Failed to check for existing tab:", error);
      return false;
    }
  }

  /**
   * Switch to existing tab with the given video URL
   */
  private async switchToTabWithVideoUrl(videoUrl: string): Promise<void> {
    try {
      // Basic security check for dangerous protocols only
      if (
        videoUrl.startsWith("data:") ||
        videoUrl.startsWith("javascript:") ||
        videoUrl.startsWith("file:")
      ) {
        console.warn("Dangerous video URL blocked:", videoUrl);
        return;
      }

      const tabs = await chrome.tabs.query({ url: videoUrl });
      if (tabs.length > 0) {
        const tab = tabs[0];
        await chrome.tabs.update(tab.id!, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        console.log("Switched to existing tab with video URL:", videoUrl);
      } else {
        console.warn("No tab found with video URL:", videoUrl);
      }
    } catch (error) {
      console.error("Failed to switch to tab:", error);
    }
  }

  /**
   * Create new tab for the given video URL
   */
  private async createTabForVideo(videoUrl: string): Promise<void> {
    try {
      // Basic security check for dangerous protocols only
      if (
        videoUrl.startsWith("data:") ||
        videoUrl.startsWith("javascript:") ||
        videoUrl.startsWith("file:")
      ) {
        console.warn("Dangerous video URL blocked:", videoUrl);
        return;
      }

      await chrome.tabs.create({ url: videoUrl, active: true });
      console.log("Created new tab for video URL:", videoUrl);
    } catch (error) {
      console.error("Failed to create tab for video:", error);
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
   * Get current tab URL
   */
  private async getCurrentTabUrl(): Promise<string | null> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0]?.url || null;
    } catch (error) {
      console.error("[RoomManager] Failed to get current tab URL:", error);
      return null;
    }
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

      // Update host video state for participants to see in UI
      if (this.currentRoom && message.hostVideoUrl) {
        const hostVideoState = {
          isPlaying: message.state === "PLAYING",
          currentTime: message.time || 0,
          duration: 0, // Duration will be updated from actual video events
          playbackRate: 1,
          url: message.hostVideoUrl,
          lastUpdated: message.timestamp,
        };

        this.currentRoom.hostVideoState = hostVideoState;

        // Check if host switched to a new video and trigger auto-follow
        if (this.lastHostVideoUrl !== message.hostVideoUrl) {
          console.log(
            `[RoomManager] Host switched video: ${this.lastHostVideoUrl} -> ${message.hostVideoUrl}`,
          );
          await this.handleHostVideoSwitch(message.hostVideoUrl);
          this.lastHostVideoUrl = message.hostVideoUrl;
        }

        // Update extension state to trigger UI refresh
        this.updateExtensionState({
          currentRoom: this.currentRoom,
        });

        console.log(`[RoomManager] Updated host video state for participant:`, {
          url: hostVideoState.url,
          playing: hostVideoState.isPlaying,
          time: hostVideoState.currentTime,
        });
      }

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
      hostVideoUrl: undefined, // Direct commands don't require URL matching
    });
  }

  private async applyVideoState(message: {
    state: string;
    time: number;
    timestamp: number;
    fromUserId?: string;
    hostVideoUrl?: string | null;
  }): Promise<void> {
    // Check user preference for background sync
    const userPreferences = await StorageManager.getUserPreferences();

    // Determine which tabs to sync based on whether hostVideoUrl is provided
    let targetTabs: number[] = [];

    if (message.hostVideoUrl && userPreferences.backgroundSyncEnabled) {
      // Use background sync: find all tabs with matching video URL
      targetTabs = await this.getAllMatchingAdapterTabs(message.hostVideoUrl);

      if (targetTabs.length === 0) {
        console.warn(
          `[RoomManager] No tabs found matching host video URL: ${message.hostVideoUrl}`,
        );
        return;
      }
    } else {
      // Fallback to single active tab behavior (for direct commands or disabled background sync)
      const activeTab = await this.getActiveAdapterTab();
      if (!activeTab) {
        console.warn(
          `[RoomManager] No active adapter tab found to apply state`,
        );
        return;
      }

      // If hostVideoUrl is provided but background sync is disabled, validate URL
      if (message.hostVideoUrl && !userPreferences.backgroundSyncEnabled) {
        const currentUrl = await this.getCurrentTabUrl();
        if (currentUrl !== message.hostVideoUrl) {
          console.warn(
            `[RoomManager] Background sync disabled - ignoring command for different video:`,
            `current: ${currentUrl}, host: ${message.hostVideoUrl}`,
          );
          return;
        }
      }

      targetTabs = [activeTab];
    }

    console.log(
      `[RoomManager] Applying video state to ${targetTabs.length} tab(s):`,
      {
        state: message.state,
        time: message.time,
        fromUser: message.fromUserId,
        hostVideoUrl: message.hostVideoUrl,
        backgroundSyncEnabled: userPreferences.backgroundSyncEnabled,
        targetTabs,
      },
    );

    // Apply latency compensation
    const latency = this.calculateLatency(message.timestamp);
    const compensatedTime = message.time + latency / 1000; // Convert ms to seconds

    // Apply state to all matching tabs
    const promises: Promise<void>[] = [];

    for (const tabId of targetTabs) {
      promises.push(this.applyVideoStateToTab(tabId, message, compensatedTime));
    }

    try {
      await Promise.all(promises);
      console.log(
        `[RoomManager] Successfully applied video state to ${targetTabs.length} tab(s)`,
      );
    } catch (error) {
      console.error("Failed to apply video state to some tabs:", error);
    }
  }

  /**
   * Apply video state commands to a specific tab
   */
  private async applyVideoStateToTab(
    tabId: number,
    message: {
      state: string;
      time: number;
      timestamp: number;
      fromUserId?: string;
      hostVideoUrl?: string | null;
    },
    compensatedTime: number,
  ): Promise<void> {
    try {
      // Apply the state
      if (message.state === "PLAYING") {
        console.log(`[RoomManager] Sending play command to tab ${tabId}`);
        await sendAdapterCommand(tabId, "play");
      } else if (message.state === "PAUSED") {
        console.log(`[RoomManager] Sending pause command to tab ${tabId}`);
        await sendAdapterCommand(tabId, "pause");
      }

      // Only sync the time if there's a significant difference
      if (message.time !== undefined) {
        // Get current adapter state to check time difference
        const adapters = getActiveAdapters();
        const currentAdapter = adapters.find((a) => a.tabId === tabId);

        if (currentAdapter) {
          const timeDiff = Math.abs(
            currentAdapter.state.currentTime - compensatedTime,
          );

          // Only seek if the difference is greater than tolerance
          if (timeDiff > this.seekTolerance) {
            console.log(
              `[RoomManager] Seeking tab ${tabId} to time: ${compensatedTime}s (diff: ${timeDiff}s)`,
            );
            await sendAdapterCommand(tabId, "seek", {
              time: compensatedTime,
            });
          } else {
            console.log(
              `[RoomManager] Skipping seek for tab ${tabId}, within tolerance (diff: ${timeDiff}s)`,
            );
          }
        }
      }
    } catch (error) {
      console.error(`Failed to apply video state to tab ${tabId}:`, error);
      throw error; // Re-throw to be caught by Promise.all
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

  /**
   * Get all adapter tabs that match the target video URL
   * Used for background tab synchronization
   */
  private async getAllMatchingAdapterTabs(
    targetUrl: string | null,
  ): Promise<number[]> {
    if (!targetUrl) {
      return [];
    }

    const adapters = getActiveAdapters();
    if (adapters.length === 0) {
      return [];
    }

    const matchingTabIds: number[] = [];

    // Get URLs for all adapter tabs
    for (const adapter of adapters) {
      if (!adapter.connected) {
        continue;
      }

      try {
        const tab = await chrome.tabs.get(adapter.tabId);
        if (tab.url === targetUrl) {
          matchingTabIds.push(adapter.tabId);
        }
      } catch (error) {
        // Tab might have been closed or is inaccessible
        console.warn(
          `[RoomManager] Failed to get tab ${adapter.tabId}:`,
          error,
        );
      }
    }

    console.log(
      `[RoomManager] Found ${matchingTabIds.length} tabs matching URL: ${targetUrl}`,
      matchingTabIds,
    );

    return matchingTabIds;
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

    // Update local room video state for UI display
    await this.updateLocalVideoState(detail);
  }

  private async broadcastHostStateUpdate(
    detail: AdapterEventDetail,
  ): Promise<void> {
    const state = detail.state.isPaused ? "PAUSED" : "PLAYING";
    const currentUrl = await this.getCurrentTabUrl();

    // Only log significant events, not timeupdate
    if (detail.event !== "timeupdate") {
      console.log(
        `[RoomManager] Broadcasting host state: ${state} at ${detail.state.currentTime}s`,
        currentUrl ? `on ${currentUrl}` : "",
      );
    }

    await this.webrtc.broadcastHostState(
      state,
      detail.state.currentTime,
      currentUrl,
    );
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

  /**
   * Update local room video state for UI display
   */
  private async updateLocalVideoState(
    detail: AdapterEventDetail,
  ): Promise<void> {
    if (!this.currentRoom) {
      return;
    }

    // Get current tab URL for video URL
    const currentUrl = await this.getCurrentTabUrl();

    const videoState = {
      isPlaying: !detail.state.isPaused,
      currentTime: detail.state.currentTime,
      duration: detail.state.duration || 0,
      playbackRate: detail.state.playbackRate || 1,
      url: currentUrl || "",
      lastUpdated: detail.timestamp,
    };

    // Update different video states based on user role
    if (this.currentUser?.isHost) {
      // Host updates both host video state (for participants to see) and own video state
      this.currentRoom.hostVideoState = videoState;
      this.currentRoom.videoState = videoState;
    } else {
      // Participants only update their own local video state
      this.currentRoom.videoState = videoState;
    }

    // Update extension state to trigger UI refresh
    this.updateExtensionState({
      currentRoom: this.currentRoom,
    });

    // Only log significant events, not timeupdate
    if (detail.event !== "timeupdate") {
      const role = this.currentUser?.isHost ? "host" : "participant";
      console.log(
        `[RoomManager] Updated ${role} video state: ${videoState.isPlaying ? "Playing" : "Paused"} at ${videoState.currentTime}s`,
        currentUrl ? `on ${currentUrl}` : "",
      );
    }
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
