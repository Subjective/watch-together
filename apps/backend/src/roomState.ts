/**
 * RoomState Durable Object for managing room state and WebSocket connections
 */

import type {
  SignalingMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  LeaveRoomMessage,
  RenameRoomMessage,
  RenameUserMessage,
  WebRTCOfferMessage,
  WebRTCAnswerMessage,
  WebRTCIceCandidateMessage,
  RoomState as RoomStateType,
  User,
  ControlMode,
  VideoState,
} from "@repo/types";

interface ConnectedUser extends User {
  websocket: WebSocket;
  lastActivity: number;
}

interface RoomStateData {
  id: string;
  name: string;
  hostId: string;
  users: User[];
  controlMode: ControlMode;
  hostCurrentUrl: string | null;
  hostVideoState: VideoState | null;
  createdAt: number;
  lastActivity: number;
}

/**
 * Durable Object class for managing room state and WebSocket connections
 */
export class RoomState {
  private state: DurableObjectState;
  private connections: Map<string, ConnectedUser> = new Map();
  private roomData: RoomStateData | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Constants for activity monitoring
  private static readonly USER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private static readonly EMPTY_ROOM_CLEANUP_MS = 30 * 60 * 1000; // 30 minutes

  constructor(state: DurableObjectState) {
    this.state = state;

    // Load existing room data from storage on initialization
    this.state.blockConcurrencyWhile(async () => {
      this.roomData = (await this.state.storage.get("roomData")) || null;
      if (this.roomData) {
        console.log("Loaded existing room data:", this.roomData.id);
        // Start user activity monitoring for existing rooms
        this.startUserActivityMonitoring();
      }
    });
  }

  /**
   * Handle incoming requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle WebSocket upgrade requests
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader === "websocket") {
        return this.handleWebSocketUpgrade(request);
      }

      // Handle HTTP requests for room information
      if (request.method === "GET" && url.pathname === "/info") {
        return this.handleRoomInfoRequest();
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("RoomState fetch error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  /**
   * Handle Durable Object alarms for scheduled cleanup
   */
  async alarm(): Promise<void> {
    console.log("Alarm triggered - checking for empty room cleanup");

    try {
      // Load room data if not in memory
      if (!this.roomData) {
        this.roomData = (await this.state.storage.get("roomData")) || null;
      }

      // If room exists but has no connections, clean it up
      if (this.roomData && this.connections.size === 0) {
        const roomId = this.roomData.id;
        const timeSinceLastActivity = Date.now() - this.roomData.lastActivity;

        if (timeSinceLastActivity >= RoomState.EMPTY_ROOM_CLEANUP_MS) {
          console.log(
            `Cleaning up empty room ${roomId} (inactive for ${Math.round(timeSinceLastActivity / 60000)} minutes)`,
          );

          // Delete room data
          await this.state.storage.delete("roomData");
          this.roomData = null;

          // Stop monitoring
          this.stopUserActivityMonitoring();

          console.log(`Empty room cleaned up: ${roomId}`);
        } else {
          // Schedule another check
          const nextCheckTime =
            Date.now() +
            RoomState.EMPTY_ROOM_CLEANUP_MS -
            timeSinceLastActivity;
          await this.state.storage.setAlarm(nextCheckTime);
          console.log(
            `Scheduled next empty room check in ${Math.round((nextCheckTime - Date.now()) / 60000)} minutes`,
          );
        }
      }
    } catch (error) {
      console.error("Alarm handling error:", error);
    }
  }

  /**
   * Handle WebSocket upgrade and connection setup
   */
  private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
    try {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Accept the WebSocket connection using Durable Object state
      this.state.acceptWebSocket(server);

      console.log("WebSocket accepted in Durable Object");

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      console.error("WebSocket upgrade error:", error);
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
  }

  /**
   * Durable Object hibernation API - handle WebSocket messages
   */
  async webSocketMessage(websocket: WebSocket, message: string): Promise<void> {
    console.log("WebSocket message received in DO:", message);
    return this.handleWebSocketMessage(websocket, message);
  }

  /**
   * Durable Object hibernation API - handle WebSocket close
   */
  async webSocketClose(
    websocket: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    console.log("WebSocket closed in DO:", code, reason);
    return this.handleWebSocketClose(websocket);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleWebSocketMessage(
    websocket: WebSocket,
    data: string,
  ): Promise<void> {
    try {
      const message: SignalingMessage = JSON.parse(data);
      console.log(
        "Received message:",
        message.type,
        "roomId:",
        (message as any).roomId,
      );

      // Update last activity
      const user = this.findUserByWebSocket(websocket);
      if (user) {
        user.lastActivity = Date.now();
      }

      // Route message based on type
      switch (message.type) {
        case "CREATE_ROOM":
          await this.handleCreateRoom(websocket, message as CreateRoomMessage);
          break;
        case "JOIN_ROOM":
          await this.handleJoinRoom(websocket, message as JoinRoomMessage);
          break;
        case "LEAVE_ROOM":
          await this.handleLeaveRoom(websocket, message as LeaveRoomMessage);
          break;
        case "RENAME_ROOM":
          await this.handleRenameRoom(websocket, message as RenameRoomMessage);
          break;
        case "RENAME_USER":
          await this.handleRenameUser(websocket, message as RenameUserMessage);
          break;
        case "WEBRTC_OFFER":
          await this.handleWebRTCOffer(
            websocket,
            message as WebRTCOfferMessage,
          );
          break;
        case "WEBRTC_ANSWER":
          await this.handleWebRTCAnswer(
            websocket,
            message as WebRTCAnswerMessage,
          );
          break;
        case "WEBRTC_ICE_CANDIDATE":
          await this.handleWebRTCIceCandidate(
            websocket,
            message as WebRTCIceCandidateMessage,
          );
          break;
        case "PING":
          // Handle heartbeat ping messages
          this.sendMessage(websocket, {
            type: "PONG",
            timestamp: Date.now(),
          });
          break;
        default:
          console.warn("Unknown message type:", (message as any).type);
          this.sendError(
            websocket,
            "Unknown message type",
            (message as any).type,
          );
      }
    } catch (error) {
      console.error("WebSocket message handling error:", error);
      this.sendError(
        websocket,
        "Message processing failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle CREATE_ROOM messages
   */
  private async handleCreateRoom(
    websocket: WebSocket,
    message: CreateRoomMessage,
  ): Promise<void> {
    try {
      // If room data exists, validate or clear it
      if (this.roomData) {
        if (this.roomData.id === message.roomId) {
          console.log("Clearing existing room data for:", message.roomId);
          await this.state.storage.delete("roomData");
          this.roomData = null;
          this.connections.clear();
        } else {
          // Room data exists but for different room ID - clear stale data
          console.log(
            `Clearing stale room data (${this.roomData.id}) for new room:`,
            message.roomId,
          );
          await this.state.storage.delete("roomData");
          this.roomData = null;
          this.connections.clear();
        }
      }

      // Create new room
      const now = Date.now();
      const hostUser: User = {
        id: message.userId,
        name: message.userName,
        isHost: true,
        isConnected: true,
        joinedAt: now,
      };

      this.roomData = {
        id: message.roomId,
        name: message.roomName || message.roomId, // Use roomName or fallback to roomId
        hostId: message.userId,
        users: [hostUser],
        controlMode: "HOST_ONLY",
        hostCurrentUrl: null,
        hostVideoState: null,
        createdAt: now,
        lastActivity: now,
      };

      // Add user to connections
      this.connections.set(message.userId, {
        ...hostUser,
        websocket,
        lastActivity: now,
      });

      // Persist room state
      await this.state.storage.put("roomData", this.roomData);

      // Start user activity monitoring
      this.startUserActivityMonitoring();

      // Send success response
      this.sendMessage(websocket, {
        type: "ROOM_CREATED",
        roomId: message.roomId,
        userId: message.userId,
        timestamp: now,
        roomState: this.getRoomStateForClient(),
      });

      console.log(`Room created: ${message.roomId} by ${message.userName}`);
    } catch (error) {
      console.error("Create room error:", error);
      this.sendError(
        websocket,
        "Failed to create room",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle JOIN_ROOM messages
   */
  private async handleJoinRoom(
    websocket: WebSocket,
    message: JoinRoomMessage,
  ): Promise<void> {
    try {
      // Load room data if not in memory
      if (!this.roomData) {
        const storedData =
          await this.state.storage.get<RoomStateData>("roomData");
        this.roomData = storedData || null;
        if (!this.roomData) {
          this.sendError(websocket, "Room not found", message.roomId);
          return;
        }
      }

      // Validate that the stored room ID matches the requested room ID
      if (this.roomData.id !== message.roomId) {
        this.sendError(websocket, "Room ID mismatch", message.roomId);
        return;
      }

      // Check if user is already in room
      if (this.connections.has(message.userId)) {
        this.sendError(websocket, "User already in room", message.userId);
        return;
      }

      // Clean up any users from storage who don't have active connections
      // This happens when the server restarts and users are loaded from storage
      // but their connections are lost
      if (this.roomData.users.length > 0 && this.connections.size === 0) {
        console.log(
          `Cleaning up ${this.roomData.users.length} disconnected users from storage`,
        );
        this.roomData.users = [];
      }

      const now = Date.now();
      const isFirstUserInRoom = this.roomData.users.length === 0;

      const newUser: User = {
        id: message.userId,
        name: message.userName,
        isHost: isFirstUserInRoom, // Make first user in empty room the host
        isConnected: true,
        joinedAt: now,
      };

      // Update hostId if this user becomes host
      if (isFirstUserInRoom) {
        this.roomData.hostId = message.userId;
      }

      // Add user to room data
      this.roomData.users.push(newUser);
      this.roomData.lastActivity = now;

      // Add user to connections
      this.connections.set(message.userId, {
        ...newUser,
        websocket,
        lastActivity: now,
      });

      // Persist updated room state
      await this.state.storage.put("roomData", this.roomData);

      // Start user activity monitoring if this is the first connection
      if (this.connections.size === 1) {
        this.startUserActivityMonitoring();
      }

      // Send success response to joining user
      this.sendMessage(websocket, {
        type: "ROOM_JOINED",
        roomId: message.roomId,
        userId: message.userId,
        timestamp: now,
        roomState: this.getRoomStateForClient(),
      });

      // Notify other users about new participant
      this.broadcastToOthers(message.userId, {
        type: "USER_JOINED",
        roomId: message.roomId,
        userId: "system",
        timestamp: now,
        joinedUser: newUser,
        roomState: this.getRoomStateForClient(),
      });

      console.log(`User joined room ${message.roomId}: ${message.userName}`);
    } catch (error) {
      console.error("Join room error:", error);
      this.sendError(
        websocket,
        "Failed to join room",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle LEAVE_ROOM messages
   */
  private async handleLeaveRoom(
    websocket: WebSocket,
    message: LeaveRoomMessage,
  ): Promise<void> {
    try {
      await this.removeUserFromRoom(message.userId, false);

      // Explicitly close WebSocket with normal closure to prevent reconnection
      websocket.close(1000, "User left room");
    } catch (error) {
      console.error("Leave room error:", error);
      this.sendError(
        websocket,
        "Failed to leave room",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle RENAME_ROOM messages
   */
  private async handleRenameRoom(
    websocket: WebSocket,
    message: RenameRoomMessage,
  ): Promise<void> {
    try {
      if (!this.roomData) {
        this.sendError(websocket, "Room not found", message.roomId);
        return;
      }

      // Validate room ID matches
      if (this.roomData.id !== message.roomId) {
        this.sendError(websocket, "Room ID mismatch", message.roomId);
        return;
      }

      // Find the user making the request
      const user = this.findUserByWebSocket(websocket);
      if (!user) {
        this.sendError(websocket, "User not found", message.userId);
        return;
      }

      // Validate user is the host
      if (user.id !== this.roomData.hostId) {
        this.sendError(websocket, "Only host can rename room", message.userId);
        return;
      }

      // Validate room name
      const trimmedName = message.newRoomName.trim();
      if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 50) {
        this.sendError(
          websocket,
          "Invalid room name",
          "Name must be 3-50 characters",
        );
        return;
      }

      // Update room name
      this.roomData.name = trimmedName;
      this.roomData.lastActivity = Date.now();

      // Persist to storage
      await this.state.storage.put("roomData", this.roomData);

      // Broadcast to all users
      this.broadcast({
        type: "ROOM_RENAMED",
        roomId: this.roomData.id,
        newRoomName: trimmedName,
        timestamp: Date.now(),
        roomState: this.getRoomStateForClient(),
      });

      console.log(`Room renamed: ${message.roomId} -> "${trimmedName}"`);
    } catch (error) {
      console.error("Rename room error:", error);
      this.sendError(
        websocket,
        "Failed to rename room",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle RENAME_USER messages
   */
  private async handleRenameUser(
    websocket: WebSocket,
    message: RenameUserMessage,
  ): Promise<void> {
    try {
      if (!this.roomData) {
        this.sendError(websocket, "Room not found", message.roomId);
        return;
      }

      // Validate room ID matches
      if (this.roomData.id !== message.roomId) {
        this.sendError(websocket, "Room ID mismatch", message.roomId);
        return;
      }

      // Find the user making the request
      const user = this.findUserByWebSocket(websocket);
      if (!user) {
        this.sendError(websocket, "User not found", message.userId);
        return;
      }

      // Validate user can only rename themselves
      if (user.id !== message.userId) {
        this.sendError(websocket, "Can only rename yourself", message.userId);
        return;
      }

      // Validate user name
      const trimmedName = message.newUserName.trim();
      if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 30) {
        this.sendError(
          websocket,
          "Invalid user name",
          "Name must be 2-30 characters",
        );
        return;
      }

      // Update user name in room data
      const roomUser = this.roomData.users.find((u) => u.id === message.userId);
      if (roomUser) {
        roomUser.name = trimmedName;
      }

      // Update user name in connections
      if (user) {
        user.name = trimmedName;
      }

      this.roomData.lastActivity = Date.now();

      // Persist to storage
      await this.state.storage.put("roomData", this.roomData);

      // Broadcast to all users
      this.broadcast({
        type: "USER_RENAMED",
        roomId: this.roomData.id,
        userId: message.userId,
        newUserName: trimmedName,
        timestamp: Date.now(),
        roomState: this.getRoomStateForClient(),
      });

      console.log(`User renamed: ${message.userId} -> "${trimmedName}"`);
    } catch (error) {
      console.error("Rename user error:", error);
      this.sendError(
        websocket,
        "Failed to rename user",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle WebRTC offer messages
   */
  private async handleWebRTCOffer(
    websocket: WebSocket,
    message: WebRTCOfferMessage,
  ): Promise<void> {
    try {
      const targetConnection = this.connections.get(message.targetUserId);
      if (!targetConnection) {
        this.sendError(
          websocket,
          "Target user not found",
          message.targetUserId,
        );
        return;
      }

      // Forward offer to target user
      this.sendMessage(targetConnection.websocket, message);
    } catch (error) {
      console.error("WebRTC offer error:", error);
      this.sendError(
        websocket,
        "Failed to send offer",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle WebRTC answer messages
   */
  private async handleWebRTCAnswer(
    websocket: WebSocket,
    message: WebRTCAnswerMessage,
  ): Promise<void> {
    try {
      const targetConnection = this.connections.get(message.targetUserId);
      if (!targetConnection) {
        this.sendError(
          websocket,
          "Target user not found",
          message.targetUserId,
        );
        return;
      }

      // Forward answer to target user
      this.sendMessage(targetConnection.websocket, message);
    } catch (error) {
      console.error("WebRTC answer error:", error);
      this.sendError(
        websocket,
        "Failed to send answer",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle WebRTC ICE candidate messages
   */
  private async handleWebRTCIceCandidate(
    websocket: WebSocket,
    message: WebRTCIceCandidateMessage,
  ): Promise<void> {
    try {
      const targetConnection = this.connections.get(message.targetUserId);
      if (!targetConnection) {
        this.sendError(
          websocket,
          "Target user not found",
          message.targetUserId,
        );
        return;
      }

      // Forward ICE candidate to target user
      this.sendMessage(targetConnection.websocket, message);
    } catch (error) {
      console.error("WebRTC ICE candidate error:", error);
      this.sendError(
        websocket,
        "Failed to send ICE candidate",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private async handleWebSocketClose(websocket: WebSocket): Promise<void> {
    try {
      const user = this.findUserByWebSocket(websocket);
      if (user) {
        await this.removeUserFromRoom(user.id, true);
      }
    } catch (error) {
      console.error("WebSocket close handling error:", error);
    }
  }

  /**
   * Handle room info HTTP requests
   */
  private async handleRoomInfoRequest(): Promise<Response> {
    try {
      if (!this.roomData) {
        const storedData =
          await this.state.storage.get<RoomStateData>("roomData");
        this.roomData = storedData || null;
      }

      if (!this.roomData) {
        return new Response(JSON.stringify({ error: "Room not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(this.getRoomStateForClient()), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Room info request error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Remove user from room and handle cleanup
   */
  private async removeUserFromRoom(
    userId: string,
    wasDisconnection: boolean,
  ): Promise<void> {
    if (!this.roomData) return;

    const connection = this.connections.get(userId);
    if (!connection) return;

    // Remove from connections
    this.connections.delete(userId);

    // Remove from room data
    this.roomData.users = this.roomData.users.filter(
      (user) => user.id !== userId,
    );
    this.roomData.lastActivity = Date.now();

    const wasHost = connection.isHost;

    // If this was the host and there are other users, assign new host
    if (wasHost && this.roomData.users.length > 0) {
      const newHost = this.roomData.users[0];
      newHost.isHost = true;
      this.roomData.hostId = newHost.id;

      // Update connection data
      const newHostConnection = this.connections.get(newHost.id);
      if (newHostConnection) {
        newHostConnection.isHost = true;
      }
    }

    // If room is now empty, schedule cleanup
    if (this.roomData.users.length === 0) {
      const roomId = this.roomData.id;
      console.log(`Room ${roomId} is now empty - scheduling cleanup alarm`);

      // Stop user activity monitoring since no users remain
      this.stopUserActivityMonitoring();

      // Schedule alarm for empty room cleanup
      const cleanupTime = Date.now() + RoomState.EMPTY_ROOM_CLEANUP_MS;
      await this.state.storage.setAlarm(cleanupTime);

      // Persist the empty room state with updated lastActivity
      await this.state.storage.put("roomData", this.roomData);

      console.log(
        `Cleanup alarm scheduled for room ${roomId} in ${RoomState.EMPTY_ROOM_CLEANUP_MS / 60000} minutes`,
      );
      return;
    }

    // Persist updated room state
    await this.state.storage.put("roomData", this.roomData);

    // Notify remaining users
    const eventType = wasDisconnection ? "USER_DISCONNECTED" : "USER_LEFT";
    this.broadcast({
      type: eventType,
      roomId: this.roomData.id,
      userId: "system",
      timestamp: Date.now(),
      leftUserId: userId,
      roomState: this.getRoomStateForClient(),
      newHostId:
        wasHost && this.roomData.users.length > 0
          ? this.roomData.hostId
          : undefined,
    });

    console.log(`User ${eventType.toLowerCase()}: ${userId}`);
  }

  /**
   * Find user by WebSocket connection
   */
  private findUserByWebSocket(websocket: WebSocket): ConnectedUser | undefined {
    for (const connection of this.connections.values()) {
      if (connection.websocket === websocket) {
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Get room state for client consumption
   */
  private getRoomStateForClient(): RoomStateType | null {
    if (!this.roomData) return null;

    return {
      id: this.roomData.id,
      name: this.roomData.name,
      hostId: this.roomData.hostId,
      users: this.roomData.users,
      controlMode: this.roomData.controlMode,
      followMode: "AUTO_FOLLOW", // Default value
      videoState: {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        url: "",
        lastUpdated: Date.now(),
      },
      hostVideoState: this.roomData.hostVideoState,
      hostCurrentUrl: this.roomData.hostCurrentUrl,
      createdAt: this.roomData.createdAt,
      lastActivity: this.roomData.lastActivity,
    };
  }

  /**
   * Send message to specific WebSocket
   */
  private sendMessage(websocket: WebSocket, message: any): void {
    try {
      websocket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  /**
   * Send error message to WebSocket
   */
  private sendError(
    websocket: WebSocket,
    error: string,
    details?: string,
  ): void {
    this.sendMessage(websocket, {
      type: "ERROR",
      error,
      details,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all connected users
   */
  private broadcast(message: any): void {
    for (const connection of this.connections.values()) {
      this.sendMessage(connection.websocket, message);
    }
  }

  /**
   * Broadcast message to all users except the specified one
   */
  private broadcastToOthers(excludeUserId: string, message: any): void {
    for (const [userId, connection] of this.connections.entries()) {
      if (userId !== excludeUserId) {
        this.sendMessage(connection.websocket, message);
      }
    }
  }

  /**
   * Start monitoring user activity and clean up inactive users
   */
  private startUserActivityMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.checkAndCleanupInactiveUsers();
    }, RoomState.CLEANUP_INTERVAL_MS);

    console.log("Started user activity monitoring");
  }

  /**
   * Stop monitoring user activity
   */
  private stopUserActivityMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("Stopped user activity monitoring");
    }
  }

  /**
   * Check for inactive users and disconnect them
   */
  private async checkAndCleanupInactiveUsers(): Promise<void> {
    if (!this.roomData || this.connections.size === 0) {
      return;
    }

    const now = Date.now();
    const inactiveUsers: string[] = [];

    // Find users who haven't been active recently
    for (const [userId, connection] of this.connections.entries()) {
      const timeSinceLastActivity = now - connection.lastActivity;
      if (timeSinceLastActivity > RoomState.USER_TIMEOUT_MS) {
        inactiveUsers.push(userId);
        console.log(
          `User ${userId} inactive for ${Math.round(timeSinceLastActivity / 1000)}s - disconnecting`,
        );
      }
    }

    // Remove inactive users
    for (const userId of inactiveUsers) {
      await this.removeUserFromRoom(userId, true);
    }

    // If room is now empty, stop monitoring
    if (this.connections.size === 0) {
      this.stopUserActivityMonitoring();
    }
  }
}
