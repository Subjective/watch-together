/**
 * WebRTC Bridge for Service Worker Context
 *
 * Chrome extension service workers cannot access WebRTC APIs directly.
 * This class provides a bridge that delegates all WebRTC operations
 * to an offscreen document via message passing, maintaining the same
 * API surface as a direct WebRTC implementation.
 *
 * Architecture:
 * - Service Worker (this file) ←→ Offscreen Document (src/offscreen/main.ts)
 * - All WebRTC operations are async due to message passing overhead
 * - Event listeners forward events from offscreen back to service worker
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

import type {
  WebRTCManagerConfig,
  OffscreenToServiceWorkerMessage,
  WebRTCCreateOfferResponse,
  WebRTCCreateAnswerResponse,
  WebRTCSendSyncMessageResponse,
} from "../shared/webrtcTypes";

export class WebRTCManager {
  private currentUserId: string | null = null;
  private isHost: boolean = false;
  private controlMode: ControlMode = "HOST_ONLY";
  private eventListeners: Map<string, ((data: unknown) => void)[]> = new Map();
  private offscreenDocumentCreated: boolean = false;

  constructor(_config: WebRTCManagerConfig) {
    // Config is passed to match the interface but actual config is in offscreen document
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    // Listen for messages from offscreen document
    chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
      // Only handle messages from our offscreen document
      if (sender.url?.includes("offscreen.html")) {
        this.handleOffscreenMessage(message);
      }
    });
  }

  private handleOffscreenMessage(
    message: OffscreenToServiceWorkerMessage,
  ): void {
    switch (message.type) {
      case "WEBRTC_ICE_CANDIDATE":
        this.emit("ICE_CANDIDATE", {
          targetUserId: message.targetUserId,
          candidate: message.candidate,
        });
        break;

      case "WEBRTC_CONNECTION_STATE_CHANGE":
        this.emit("PEER_CONNECTION_STATE_CHANGE", {
          userId: message.userId,
          state: message.state,
        });
        break;

      case "WEBRTC_DATA_CHANNEL_OPEN":
        this.emit("DATA_CHANNEL_OPEN", { userId: message.userId });
        break;

      case "WEBRTC_DATA_CHANNEL_CLOSE":
        this.emit("DATA_CHANNEL_CLOSE", { userId: message.userId });
        break;

      case "WEBRTC_SYNC_MESSAGE":
        // Emit to specific message type listeners
        this.emit(message.message.type, {
          ...message.message,
          fromUserId: message.fromUserId,
        });
        // Emit to generic message listeners
        this.emit("SYNC_MESSAGE", {
          ...message.message,
          fromUserId: message.fromUserId,
        });
        break;

      case "WEBRTC_DATA_CHANNEL_ERROR":
        this.emit("DATA_CHANNEL_ERROR", {
          userId: message.userId,
          error: message.error,
        });
        break;
    }
  }

  private async ensureOffscreenDocument(): Promise<void> {
    if (this.offscreenDocumentCreated) return;

    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
      });

      if (existingContexts.length > 0) {
        this.offscreenDocumentCreated = true;
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA" as chrome.offscreen.Reason],
        justification: "WebRTC is not available in service workers",
      });

      this.offscreenDocumentCreated = true;
      console.log("Offscreen document created for WebRTC");
    } catch (error) {
      console.error("Failed to create offscreen document:", error);
      throw error;
    }
  }

  private async sendToOffscreen(
    type: string,
    data?: unknown,
  ): Promise<unknown> {
    await this.ensureOffscreenDocument();

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async initialize(userId: string, isHost: boolean): Promise<void> {
    this.currentUserId = userId;
    this.isHost = isHost;
    await this.sendToOffscreen("WEBRTC_INITIALIZE", { userId, isHost });
    console.log(
      `WebRTC initialized for ${isHost ? "host" : "client"} user:`,
      userId,
    );
  }

  async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
    const result = (await this.sendToOffscreen("WEBRTC_CREATE_OFFER", {
      targetUserId,
    })) as WebRTCCreateOfferResponse;
    return result.offer;
  }

  async createAnswer(
    targetUserId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescriptionInit> {
    const result = (await this.sendToOffscreen("WEBRTC_CREATE_ANSWER", {
      targetUserId,
      offer,
    })) as WebRTCCreateAnswerResponse;
    return result.answer;
  }

  async handleAnswer(
    targetUserId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    await this.sendToOffscreen("WEBRTC_HANDLE_ANSWER", {
      targetUserId,
      answer,
    });
  }

  async addIceCandidate(
    targetUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    await this.sendToOffscreen("WEBRTC_ADD_ICE_CANDIDATE", {
      targetUserId,
      candidate,
    });
  }

  async sendSyncMessage(
    message: SyncMessage,
    targetUserId?: string,
  ): Promise<void> {
    const result = (await this.sendToOffscreen("WEBRTC_SEND_SYNC_MESSAGE", {
      message,
      targetUserId,
    })) as WebRTCSendSyncMessageResponse;
    console.log(
      `Sent sync message to ${result.sentCount} peers:`,
      message.type,
    );
  }

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

    // Send to host (we'll need to track host peer in offscreen)
    await this.sendSyncMessage(message);
  }

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

  getConnectedPeers(): unknown[] {
    // This information is maintained in the offscreen document
    // For now, return empty array
    return [];
  }

  closePeerConnection(userId: string): void {
    this.sendToOffscreen("WEBRTC_CLOSE_PEER", { userId }).catch((error) => {
      console.error("Failed to close peer connection:", error);
    });
  }

  closeAllConnections(): void {
    this.sendToOffscreen("WEBRTC_CLOSE_ALL").catch((error) => {
      console.error("Failed to close all connections:", error);
    });
  }

  on(messageType: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(messageType)) {
      this.eventListeners.set(messageType, []);
    }
    this.eventListeners.get(messageType)!.push(callback);
  }

  off(messageType: string, callback: (data: unknown) => void): void {
    const listeners = this.eventListeners.get(messageType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
    this.sendToOffscreen("WEBRTC_SET_CONTROL_MODE", { mode }).catch((error) => {
      console.error("Failed to set control mode:", error);
    });
  }

  getControlMode(): ControlMode {
    return this.controlMode;
  }

  markPeerAsHost(userId: string): void {
    this.sendToOffscreen("WEBRTC_MARK_PEER_AS_HOST", { userId }).catch(
      (error) => {
        console.error("Failed to mark peer as host:", error);
      },
    );
  }

  private emit(eventType: string, data: unknown): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }
}

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
