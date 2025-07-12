/**
 * WebRTC peer connection management for Watch Together extension
 * Handles P2P connections and data channels for video synchronization
 */

import type {
  SyncMessage,
  HostStateUpdateMessage,
  ClientRequestPlayMessage,
  ClientRequestPauseMessage,
  ClientRequestSeekMessage,
  DirectPlayMessage,
  DirectPauseMessage,
  DirectSeekMessage,
  ControlModeChangeMessage,
  HostNavigateMessage,
  ControlMode,
} from "@repo/types";

export interface PeerConnection {
  id: string;
  userId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  connectionState: RTCPeerConnectionState;
  isHost: boolean;
}

export interface WebRTCManagerConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  dataChannelOptions: RTCDataChannelInit;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private config: WebRTCManagerConfig;
  private currentUserId: string | null = null;
  private isHost: boolean = false;
  private controlMode: ControlMode = "HOST_ONLY";
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(config: WebRTCManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize WebRTC manager with user information
   */
  initialize(userId: string, isHost: boolean): void {
    this.currentUserId = userId;
    this.isHost = isHost;
    console.log(
      `WebRTC initialized for ${isHost ? "host" : "client"} user:`,
      userId,
    );
  }

  /**
   * Create offer for a new peer connection
   */
  async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
    try {
      const peerConnection = this.createPeerConnection(targetUserId);

      // Create data channel for the initiator
      const dataChannel = peerConnection.connection.createDataChannel(
        "sync",
        this.config.dataChannelOptions,
      );
      this.setupDataChannel(dataChannel, targetUserId);
      peerConnection.dataChannel = dataChannel;

      const offer = await peerConnection.connection.createOffer();
      await peerConnection.connection.setLocalDescription(offer);

      console.log("Created offer for peer:", targetUserId);
      return offer;
    } catch (error) {
      console.error("Failed to create offer:", error);
      throw error;
    }
  }

  /**
   * Create answer for an incoming offer
   */
  async createAnswer(
    targetUserId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescriptionInit> {
    try {
      const peerConnection = this.createPeerConnection(targetUserId);

      await peerConnection.connection.setRemoteDescription(offer);
      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);

      console.log("Created answer for peer:", targetUserId);
      return answer;
    } catch (error) {
      console.error("Failed to create answer:", error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(
    targetUserId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    try {
      const peer = this.peers.get(targetUserId);
      if (!peer) {
        throw new Error(`Peer not found: ${targetUserId}`);
      }

      await peer.connection.setRemoteDescription(answer);
      console.log("Handled answer from peer:", targetUserId);
    } catch (error) {
      console.error("Failed to handle answer:", error);
      throw error;
    }
  }

  /**
   * Add ICE candidate to peer connection
   */
  async addIceCandidate(
    targetUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    try {
      const peer = this.peers.get(targetUserId);
      if (!peer) {
        throw new Error(`Peer not found: ${targetUserId}`);
      }

      await peer.connection.addIceCandidate(candidate);
      console.log("Added ICE candidate for peer:", targetUserId);
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
      throw error;
    }
  }

  /**
   * Send sync message to peers
   */
  async sendSyncMessage(
    message: SyncMessage,
    targetUserId?: string,
  ): Promise<void> {
    try {
      const messageStr = JSON.stringify(message);

      if (targetUserId) {
        // Send to specific peer
        const peer = this.peers.get(targetUserId);
        if (peer?.dataChannel?.readyState === "open") {
          peer.dataChannel.send(messageStr);
          console.log(`Sent sync message to ${targetUserId}:`, message.type);
        } else {
          console.warn(`Data channel not ready for peer: ${targetUserId}`);
        }
      } else {
        // Send to all connected peers
        let sentCount = 0;
        for (const [, peer] of this.peers) {
          if (peer.dataChannel?.readyState === "open") {
            peer.dataChannel.send(messageStr);
            sentCount++;
          }
        }
        console.log(`Sent sync message to ${sentCount} peers:`, message.type);
      }
    } catch (error) {
      console.error("Failed to send sync message:", error);
      throw error;
    }
  }

  /**
   * Handle host state update (for hosts to broadcast state)
   */
  async broadcastHostState(
    state: "PLAYING" | "PAUSED",
    time: number,
  ): Promise<void> {
    if (!this.isHost) {
      console.warn("Only host can broadcast state updates");
      return;
    }

    const message: HostStateUpdateMessage = {
      type: "HOST_STATE_UPDATE",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      state,
      time,
    };

    await this.sendSyncMessage(message);
  }

  /**
   * Send client request to host (for clients in HOST_ONLY mode)
   */
  async sendClientRequest(
    requestType: "PLAY" | "PAUSE" | "SEEK",
    seekTime?: number,
  ): Promise<void> {
    if (this.isHost) {
      console.warn("Host cannot send client requests");
      return;
    }

    if (this.controlMode !== "HOST_ONLY") {
      console.warn("Client requests only available in HOST_ONLY mode");
      return;
    }

    const hostPeer = Array.from(this.peers.values()).find((p) => p.isHost);
    if (!hostPeer) {
      console.error("No host peer found");
      return;
    }

    let message:
      | ClientRequestPlayMessage
      | ClientRequestPauseMessage
      | ClientRequestSeekMessage;

    switch (requestType) {
      case "PLAY":
        message = {
          type: "CLIENT_REQUEST_PLAY",
          userId: this.currentUserId!,
          timestamp: Date.now(),
        };
        break;
      case "PAUSE":
        message = {
          type: "CLIENT_REQUEST_PAUSE",
          userId: this.currentUserId!,
          timestamp: Date.now(),
        };
        break;
      case "SEEK":
        message = {
          type: "CLIENT_REQUEST_SEEK",
          userId: this.currentUserId!,
          timestamp: Date.now(),
          time: seekTime || 0,
        };
        break;
    }

    await this.sendSyncMessage(message, hostPeer.userId);
  }

  /**
   * Send direct command (for FREE_FOR_ALL mode)
   */
  async sendDirectCommand(
    commandType: "PLAY" | "PAUSE" | "SEEK",
    seekTime?: number,
  ): Promise<void> {
    if (this.controlMode !== "FREE_FOR_ALL") {
      console.warn("Direct commands only available in FREE_FOR_ALL mode");
      return;
    }

    let message: DirectPlayMessage | DirectPauseMessage | DirectSeekMessage;

    switch (commandType) {
      case "PLAY":
        message = {
          type: "DIRECT_PLAY",
          userId: this.currentUserId!,
          timestamp: Date.now(),
        };
        break;
      case "PAUSE":
        message = {
          type: "DIRECT_PAUSE",
          userId: this.currentUserId!,
          timestamp: Date.now(),
        };
        break;
      case "SEEK":
        message = {
          type: "DIRECT_SEEK",
          userId: this.currentUserId!,
          timestamp: Date.now(),
          time: seekTime || 0,
        };
        break;
    }

    await this.sendSyncMessage(message);
  }

  /**
   * Broadcast control mode change (host only)
   */
  async broadcastControlModeChange(mode: ControlMode): Promise<void> {
    if (!this.isHost) {
      console.warn("Only host can change control mode");
      return;
    }

    this.controlMode = mode;

    const message: ControlModeChangeMessage = {
      type: "CONTROL_MODE_CHANGE",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      mode,
    };

    await this.sendSyncMessage(message);
  }

  /**
   * Broadcast navigation change (host only)
   */
  async broadcastNavigation(url: string): Promise<void> {
    if (!this.isHost) {
      console.warn("Only host can broadcast navigation");
      return;
    }

    const message: HostNavigateMessage = {
      type: "HOST_NAVIGATE",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      url,
    };

    await this.sendSyncMessage(message);
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.peers.values()).filter(
      (peer) => peer.connectionState === "connected",
    );
  }

  /**
   * Close connection to a specific peer
   */
  closePeerConnection(userId: string): void {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(userId);
      console.log("Closed connection to peer:", userId);
    }
  }

  /**
   * Close all peer connections
   */
  closeAllConnections(): void {
    for (const [, peer] of this.peers) {
      peer.connection.close();
    }
    this.peers.clear();
    console.log("Closed all peer connections");
  }

  /**
   * Add event listener for sync messages
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
   * Set control mode
   */
  setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
  }

  /**
   * Get current control mode
   */
  getControlMode(): ControlMode {
    return this.controlMode;
  }

  /**
   * Mark a peer as host
   */
  markPeerAsHost(userId: string): void {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.isHost = true;
      console.log(`Marked peer ${userId} as host`);
    }
  }

  private createPeerConnection(userId: string): PeerConnection {
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
    });

    const peerConnection: PeerConnection = {
      id: `peer-${userId}`,
      userId,
      connection,
      dataChannel: null,
      connectionState: "new",
      isHost: false, // Will be set based on room state
    };

    this.setupPeerConnectionEventHandlers(peerConnection);
    this.peers.set(userId, peerConnection);

    return peerConnection;
  }

  private setupPeerConnectionEventHandlers(peer: PeerConnection): void {
    peer.connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit("ICE_CANDIDATE", {
          targetUserId: peer.userId,
          candidate: event.candidate,
        });
      }
    };

    peer.connection.onconnectionstatechange = () => {
      peer.connectionState = peer.connection.connectionState;
      console.log(
        `Peer ${peer.userId} connection state:`,
        peer.connectionState,
      );

      this.emit("PEER_CONNECTION_STATE_CHANGE", {
        userId: peer.userId,
        state: peer.connectionState,
      });
    };

    peer.connection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannel(dataChannel, peer.userId);
      peer.dataChannel = dataChannel;
    };
  }

  private setupDataChannel(dataChannel: RTCDataChannel, userId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened for peer: ${userId}`);
      this.emit("DATA_CHANNEL_OPEN", { userId });
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed for peer: ${userId}`);
      this.emit("DATA_CHANNEL_CLOSE", { userId });
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        console.log(`Received sync message from ${userId}:`, message.type);

        // Emit to specific message type listeners
        this.emit(message.type, { ...message, fromUserId: userId });

        // Emit to generic message listeners
        this.emit("SYNC_MESSAGE", { ...message, fromUserId: userId });
      } catch (error) {
        console.error("Failed to parse sync message:", error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error for peer ${userId}:`, error);
      this.emit("DATA_CHANNEL_ERROR", { userId, error });
    };
  }

  private emit(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }
}

/**
 * Default WebRTC configuration
 */
export const defaultWebRTCConfig: WebRTCManagerConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
  dataChannelOptions: {
    ordered: true,
    maxRetransmits: 3,
  },
};
