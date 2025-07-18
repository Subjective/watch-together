/**
 * Offscreen WebRTC Manager
 *
 * Handles all WebRTC operations in the offscreen document context where
 * WebRTC APIs are available. Communicates with the service worker via
 * message passing to provide WebRTC functionality to the extension.
 */

import type { SyncMessage, ControlMode } from "@repo/types";

import type {
  PeerConnection,
  ServiceWorkerToOffscreenMessage,
  WebRTCInitializeResponse,
  WebRTCCreateOfferResponse,
  WebRTCCreateAnswerResponse,
  WebRTCSuccessResponse,
  WebRTCSendSyncMessageResponse,
} from "../shared/webrtcTypes";

import {
  defaultWebRTCConfig,
  defaultICEServerStrategy,
  type CloudflareTURNCredential,
} from "@repo/types";
import { TURNCredentialsManager } from "../utils/turnCredentials";

export class OffscreenWebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private config: RTCConfiguration;
  private currentUserId: string | null = null;
  private isHost: boolean = false;
  private controlMode: ControlMode = "HOST_ONLY";
  private turnCredentialsManager: TURNCredentialsManager;
  private backendUrl: string;
  private isInitialized: boolean = false;

  constructor() {
    this.config = defaultWebRTCConfig;

    // Initialize backend URL (could be from environment or storage)
    this.backendUrl = this.getBackendUrl();

    // Initialize TURN credentials manager
    this.turnCredentialsManager = new TURNCredentialsManager(this.backendUrl);

    // Listen for messages from the service worker
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleServiceWorkerMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ error: error.message }));
      return true; // Keep channel open for async response
    });
  }

  private async handleServiceWorkerMessage(
    message: ServiceWorkerToOffscreenMessage,
  ): Promise<unknown> {
    console.log("[Offscreen] Received message:", message.type);

    switch (message.type) {
      case "WEBRTC_INITIALIZE":
        return await this.initialize(message.data.userId, message.data.isHost);

      case "WEBRTC_CREATE_OFFER":
        return this.createOffer(message.data.targetUserId);

      case "WEBRTC_CREATE_ANSWER":
        return this.createAnswer(message.data.targetUserId, message.data.offer);

      case "WEBRTC_HANDLE_ANSWER":
        return this.handleAnswer(
          message.data.targetUserId,
          message.data.answer,
        );

      case "WEBRTC_ADD_ICE_CANDIDATE":
        return this.addIceCandidate(
          message.data.targetUserId,
          message.data.candidate,
        );

      case "WEBRTC_SEND_SYNC_MESSAGE":
        return this.sendSyncMessage(
          message.data.message,
          message.data.targetUserId,
        );

      case "WEBRTC_SET_CONTROL_MODE":
        this.controlMode = message.data.mode;
        return { success: true };

      case "WEBRTC_MARK_PEER_AS_HOST":
        return this.markPeerAsHost(message.data.userId);

      case "WEBRTC_CLOSE_PEER":
        return this.closePeerConnection(message.data.userId);

      case "WEBRTC_CLOSE_ALL":
        return this.closeAllConnections();
    }
  }

  private async initialize(
    userId: string,
    isHost: boolean,
  ): Promise<WebRTCInitializeResponse> {
    this.currentUserId = userId;
    this.isHost = isHost;

    console.log(
      `[Offscreen] WebRTC initialized for ${isHost ? "host" : "client"} user:`,
      userId,
    );

    // Initialize TURN credentials if not already done
    if (!this.isInitialized) {
      await this.initializeTURNCredentials();
      this.isInitialized = true;
    }

    return { success: true };
  }

  private async createOffer(
    targetUserId: string,
  ): Promise<WebRTCCreateOfferResponse> {
    try {
      const peerConnection = this.createPeerConnection(targetUserId);

      // Create data channel for the initiator
      const dataChannel = peerConnection.connection.createDataChannel("sync", {
        ordered: true,
        maxRetransmits: 3,
      });
      this.setupDataChannel(dataChannel, targetUserId);
      peerConnection.dataChannel = dataChannel;

      const offer = await peerConnection.connection.createOffer();
      await peerConnection.connection.setLocalDescription(offer);

      console.log("[Offscreen] Created offer for peer:", targetUserId);
      return { offer };
    } catch (error) {
      console.error("[Offscreen] Failed to create offer:", error);
      throw error;
    }
  }

  private async createAnswer(
    targetUserId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<WebRTCCreateAnswerResponse> {
    try {
      const peerConnection = this.createPeerConnection(targetUserId);

      await peerConnection.connection.setRemoteDescription(offer);
      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);

      console.log("[Offscreen] Created answer for peer:", targetUserId);
      return { answer };
    } catch (error) {
      console.error("[Offscreen] Failed to create answer:", error);
      throw error;
    }
  }

  private async handleAnswer(
    targetUserId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<WebRTCSuccessResponse> {
    try {
      const peer = this.peers.get(targetUserId);
      if (!peer) {
        throw new Error(`Peer not found: ${targetUserId}`);
      }

      await peer.connection.setRemoteDescription(answer);
      console.log("[Offscreen] Handled answer from peer:", targetUserId);
      return { success: true };
    } catch (error) {
      console.error("[Offscreen] Failed to handle answer:", error);
      throw error;
    }
  }

  private async addIceCandidate(
    targetUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<WebRTCSuccessResponse> {
    try {
      const peer = this.peers.get(targetUserId);
      if (!peer) {
        throw new Error(`Peer not found: ${targetUserId}`);
      }

      await peer.connection.addIceCandidate(candidate);
      console.log("[Offscreen] Added ICE candidate for peer:", targetUserId);
      return { success: true };
    } catch (error) {
      console.error("[Offscreen] Failed to add ICE candidate:", error);
      throw error;
    }
  }

  private async sendSyncMessage(
    message: SyncMessage,
    targetUserId?: string,
  ): Promise<WebRTCSendSyncMessageResponse> {
    try {
      const messageStr = JSON.stringify(message);
      let sentCount = 0;

      if (targetUserId) {
        // Send to specific peer
        const peer = this.peers.get(targetUserId);
        if (peer?.dataChannel?.readyState === "open") {
          peer.dataChannel.send(messageStr);
          sentCount = 1;
          console.log(
            `[Offscreen] Sent sync message to ${targetUserId}:`,
            message.type,
          );
        } else {
          console.warn(
            `[Offscreen] Data channel not ready for peer: ${targetUserId}`,
          );
        }
      } else {
        // Send to all connected peers based on control mode
        for (const [, peer] of this.peers) {
          if (peer.dataChannel?.readyState === "open") {
            // In HOST_ONLY mode, only send to non-host peers if we're the host
            if (
              this.controlMode === "HOST_ONLY" &&
              this.isHost &&
              peer.isHost
            ) {
              continue;
            }
            peer.dataChannel.send(messageStr);
            sentCount++;
          }
        }
        console.log(
          `[Offscreen] Sent sync message to ${sentCount} peers:`,
          message.type,
          `(mode: ${this.controlMode})`,
        );
      }

      return { success: true, sentCount };
    } catch (error) {
      console.error("[Offscreen] Failed to send sync message:", error);
      throw error;
    }
  }

  private markPeerAsHost(userId: string): WebRTCSuccessResponse {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.isHost = true;
      console.log(`[Offscreen] Marked peer ${userId} as host`);
      return { success: true };
    }
    return { success: false };
  }

  private closePeerConnection(userId: string): WebRTCSuccessResponse {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(userId);
      console.log("[Offscreen] Closed connection to peer:", userId);
      return { success: true };
    }
    return { success: false };
  }

  private closeAllConnections(): WebRTCSuccessResponse {
    for (const [, peer] of this.peers) {
      peer.connection.close();
    }
    this.peers.clear();
    this.cleanup();
    console.log(
      "[Offscreen] Closed all peer connections and cleaned up resources",
    );
    return { success: true };
  }

  private createPeerConnection(userId: string): PeerConnection {
    const connection = new RTCPeerConnection(this.config);

    const peerConnection: PeerConnection = {
      id: `peer-${userId}`,
      userId,
      connection,
      dataChannel: null,
      connectionState: "new",
      isHost: false,
    };

    this.setupPeerConnectionEventHandlers(peerConnection);
    this.peers.set(userId, peerConnection);

    return peerConnection;
  }

  private setupPeerConnectionEventHandlers(peer: PeerConnection): void {
    peer.connection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to service worker
        chrome.runtime.sendMessage({
          type: "WEBRTC_ICE_CANDIDATE",
          targetUserId: peer.userId,
          candidate: event.candidate,
        });
      }
    };

    peer.connection.onconnectionstatechange = () => {
      peer.connectionState = peer.connection.connectionState;
      console.log(
        `[Offscreen] Peer ${peer.userId} connection state:`,
        peer.connectionState,
      );

      // Notify service worker of connection state change
      chrome.runtime.sendMessage({
        type: "WEBRTC_CONNECTION_STATE_CHANGE",
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
      console.log(
        `[Offscreen] Data channel opened for peer: ${userId} (current user: ${this.currentUserId})`,
      );
      chrome.runtime.sendMessage({
        type: "WEBRTC_DATA_CHANNEL_OPEN",
        userId,
      });
    };

    dataChannel.onclose = () => {
      console.log(`[Offscreen] Data channel closed for peer: ${userId}`);
      chrome.runtime.sendMessage({
        type: "WEBRTC_DATA_CHANNEL_CLOSE",
        userId,
      });
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        console.log(
          `[Offscreen] Received sync message from ${userId}:`,
          message.type,
        );

        // Forward message to service worker
        chrome.runtime.sendMessage({
          type: "WEBRTC_SYNC_MESSAGE",
          message,
          fromUserId: userId,
        });
      } catch (error) {
        console.error("[Offscreen] Failed to parse sync message:", error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(
        `[Offscreen] Data channel error for peer ${userId}:`,
        error,
      );
      chrome.runtime.sendMessage({
        type: "WEBRTC_DATA_CHANNEL_ERROR",
        userId,
        error: error.toString(),
      });
    };
  }

  /**
   * Get backend URL for API calls
   */
  private getBackendUrl(): string {
    // This could be configured based on environment or stored in extension storage
    // For now, use a default that matches the development setup
    return "https://watch-together-backend-dev.your-subdomain.workers.dev";
  }

  /**
   * Initialize TURN credentials and configure ICE servers
   */
  private async initializeTURNCredentials(): Promise<void> {
    try {
      console.log("[Offscreen] Initializing TURN credentials...");

      // Try to get TURN credentials
      const credentials = await this.turnCredentialsManager.getCredentials();

      if (credentials) {
        // Use Cloudflare TURN servers with credentials
        const turnICEServers = this.createTURNICEServers(credentials);
        this.config.iceServers = [
          ...turnICEServers,
          ...defaultICEServerStrategy.fallback, // Add fallback STUN servers
        ];

        console.log("[Offscreen] Successfully configured TURN servers");
      } else {
        // Fall back to STUN-only
        this.config.iceServers = defaultICEServerStrategy.fallback;
        console.log("[Offscreen] Using STUN-only configuration");
      }
    } catch (error) {
      console.error(
        "[Offscreen] Failed to initialize TURN credentials:",
        error,
      );

      // Fall back to STUN-only on error
      this.config.iceServers = defaultICEServerStrategy.fallback;
      console.log("[Offscreen] Falling back to STUN-only configuration");
    }
  }

  /**
   * Create RTCIceServer configurations for TURN servers
   */
  private createTURNICEServers(
    credentials: CloudflareTURNCredential,
  ): RTCIceServer[] {
    return credentials.urls.map((url) => ({
      urls: url,
      username: credentials.username,
      credential: credentials.credential,
    }));
  }


  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.turnCredentialsManager.clear();
    this.isInitialized = false;
  }
}
