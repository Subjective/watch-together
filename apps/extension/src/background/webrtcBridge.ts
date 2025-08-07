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
  UnifiedSyncMessage,
  ControlModeChangeMessage,
  ControlMode,
  WebRTCManagerConfig,
} from "@repo/types";

import type {
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
  
  // ICE candidate queue for handling candidates that arrive before connection is ready
  private iceCandidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();
  private maxQueueSize = 50; // Maximum candidates per peer

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

      case "WEBRTC_ALL_CONNECTIONS_RESTARTED":
        this.emit("ALL_CONNECTIONS_RESTARTED", {
          restartedPeerIds: message.restartedPeerIds,
        });
        break;

      case "WEBRTC_PEER_CONNECTION_RESTARTED":
        this.emit("PEER_CONNECTION_RESTARTED", {
          userId: message.userId,
        });
        break;

      case "WEBRTC_ICE_RESTART_OFFER":
        this.emit("ICE_RESTART_OFFER", {
          userId: message.userId,
          offer: message.offer,
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
    
    // Flush any queued ICE candidates after creating answer
    await this.flushIceCandidateQueue(targetUserId);
    
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
    
    // Flush any queued ICE candidates after handling answer
    await this.flushIceCandidateQueue(targetUserId);
  }

  async addIceCandidate(
    targetUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    try {
      await this.sendToOffscreen("WEBRTC_ADD_ICE_CANDIDATE", {
        targetUserId,
        candidate,
      });
      
      // If successful, clear any queued candidates for this peer
      if (this.iceCandidateQueue.has(targetUserId)) {
        console.log(`[WebRTCManager] Clearing ${this.iceCandidateQueue.get(targetUserId)?.length} queued candidates for ${targetUserId} after successful add`);
        this.iceCandidateQueue.delete(targetUserId);
      }
    } catch (error) {
      // Queue the candidate if we can't add it immediately
      console.warn(`[WebRTCManager] Failed to add ICE candidate for ${targetUserId}, queuing:`, error);
      this.queueIceCandidate(targetUserId, candidate);
      throw error;
    }
  }

  /**
   * Queue an ICE candidate for later processing
   */
  private queueIceCandidate(targetUserId: string, candidate: RTCIceCandidateInit): void {
    if (!this.iceCandidateQueue.has(targetUserId)) {
      this.iceCandidateQueue.set(targetUserId, []);
    }
    
    const queue = this.iceCandidateQueue.get(targetUserId)!;
    
    // Limit queue size to prevent memory issues
    if (queue.length >= this.maxQueueSize) {
      console.warn(`[WebRTCManager] ICE candidate queue full for ${targetUserId}, dropping oldest`);
      queue.shift();
    }
    
    queue.push(candidate);
    console.log(`[WebRTCManager] Queued ICE candidate for ${targetUserId}, queue size: ${queue.length}`);
  }

  /**
   * Flush queued ICE candidates for a specific peer
   */
  async flushIceCandidateQueue(targetUserId: string): Promise<void> {
    const candidates = this.iceCandidateQueue.get(targetUserId);
    
    if (!candidates || candidates.length === 0) {
      return;
    }
    
    console.log(`[WebRTCManager] Flushing ${candidates.length} queued ICE candidates for ${targetUserId}`);
    
    // Clear the queue first to avoid re-queuing on failure
    this.iceCandidateQueue.delete(targetUserId);
    
    for (const candidate of candidates) {
      try {
        await this.sendToOffscreen("WEBRTC_ADD_ICE_CANDIDATE", {
          targetUserId,
          candidate,
        });
        
        // Add small delay to avoid overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`[WebRTCManager] Failed to flush ICE candidate for ${targetUserId}:`, error);
        // Re-queue the remaining candidates on failure
        this.queueIceCandidate(targetUserId, candidate);
      }
    }
  }

  /**
   * Flush all queued ICE candidates
   */
  async flushAllIceCandidateQueues(): Promise<void> {
    const peerIds = Array.from(this.iceCandidateQueue.keys());
    
    if (peerIds.length === 0) {
      return;
    }
    
    console.log(`[WebRTCManager] Flushing ICE candidates for ${peerIds.length} peers`);
    
    for (const peerId of peerIds) {
      await this.flushIceCandidateQueue(peerId);
    }
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
    hostVideoUrl?: string | null,
    targetUserId?: string,
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
      hostVideoUrl,
    };

    await this.sendSyncMessage(message, targetUserId);
  }

  async sendUnifiedSync(
    action: "PLAY" | "PAUSE" | "SEEK",
    time: number,
    videoUrl: string,
  ): Promise<void> {
    if (this.controlMode !== "FREE_FOR_ALL") {
      console.warn("Unified sync only available in FREE_FOR_ALL mode");
      return;
    }

    const message: UnifiedSyncMessage = {
      type: "UNIFIED_SYNC",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      action,
      time,
      videoUrl,
    };

    await this.sendSyncMessage(message);
  }

  async broadcastControlModeChange(mode: ControlMode): Promise<void> {
    console.log(
      `[WebRTC] broadcastControlModeChange called with mode: ${mode}, isHost: ${this.isHost}`,
    );
    if (!this.isHost) {
      console.warn(
        "Only host can change control mode - current isHost:",
        this.isHost,
      );
      return;
    }

    this.controlMode = mode;

    const message: ControlModeChangeMessage = {
      type: "CONTROL_MODE_CHANGE",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      mode,
    };

    console.log("[WebRTC] Sending control mode change message:", message);
    await this.sendSyncMessage(message);
    console.log(
      `[WebRTC] Successfully broadcasted control mode change to ${mode}`,
    );
  }

  async sendControlModeToUser(
    mode: ControlMode,
    targetUserId: string,
  ): Promise<void> {
    if (!this.isHost) {
      console.warn("Only host can send control mode updates");
      return;
    }

    const message: ControlModeChangeMessage = {
      type: "CONTROL_MODE_CHANGE",
      userId: this.currentUserId!,
      timestamp: Date.now(),
      mode,
    };

    console.log(`[WebRTC] Sending control mode to user ${targetUserId}:`, mode);
    await this.sendSyncMessage(message, targetUserId);
  }

  getConnectedPeers(): unknown[] {
    // This information is maintained in the offscreen document
    // For now, return empty array
    return [];
  }

  closePeerConnection(userId: string): void {
    // Clear any queued candidates for this peer
    if (this.iceCandidateQueue.has(userId)) {
      console.log(`[WebRTCManager] Clearing ${this.iceCandidateQueue.get(userId)?.length} queued candidates for closed peer ${userId}`);
      this.iceCandidateQueue.delete(userId);
    }
    
    // Only try to close connections if offscreen document already exists
    if (this.offscreenDocumentCreated) {
      this.sendToOffscreen("WEBRTC_CLOSE_PEER", { userId }).catch((error) => {
        console.error("Failed to close peer connection:", error);
      });
    }
  }

  closeAllConnections(): void {
    // Clear all queued candidates
    const queuedPeers = this.iceCandidateQueue.size;
    if (queuedPeers > 0) {
      console.log(`[WebRTCManager] Clearing ICE candidate queues for ${queuedPeers} peers`);
      this.iceCandidateQueue.clear();
    }
    
    // Only try to close connections if offscreen document already exists
    if (this.offscreenDocumentCreated) {
      this.sendToOffscreen("WEBRTC_CLOSE_ALL").catch((error) => {
        console.error("Failed to close all connections:", error);
      });
    }
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
    // Only send to offscreen if document exists
    if (this.offscreenDocumentCreated) {
      this.sendToOffscreen("WEBRTC_SET_CONTROL_MODE", { mode }).catch(
        (error) => {
          console.error("Failed to set control mode:", error);
        },
      );
    }
  }

  setIceServers(iceServers: RTCIceServer[]): void {
    // Only send to offscreen if document exists
    if (this.offscreenDocumentCreated) {
      this.sendToOffscreen("WEBRTC_SET_ICE_SERVERS", { iceServers }).catch(
        (error) => {
          console.error("Failed to set ICE servers:", error);
        },
      );
    }
  }

  /**
   * Update host status - used when user becomes host after room creation
   */
  setHostStatus(isHost: boolean): void {
    this.isHost = isHost;
    console.log(`[WebRTC] Host status updated to: ${isHost}`);
  }

  getControlMode(): ControlMode {
    return this.controlMode;
  }

  markPeerAsHost(userId: string): void {
    // Only send to offscreen if document exists
    if (this.offscreenDocumentCreated) {
      this.sendToOffscreen("WEBRTC_MARK_PEER_AS_HOST", { userId }).catch(
        (error) => {
          console.error("Failed to mark peer as host:", error);
        },
      );
    }
  }

  /**
   * Restart all peer connections with fresh ICE configuration
   */
  async restartAllConnections(): Promise<void> {
    if (this.offscreenDocumentCreated) {
      await this.sendToOffscreen("WEBRTC_RESTART_ALL_CONNECTIONS");
      console.log("Initiated restart of all WebRTC peer connections");
    }
  }

  /**
   * Restart a specific peer connection
   */
  async restartPeerConnection(userId: string): Promise<void> {
    console.log(`[WebRTCManager] Restarting peer connection for ${userId}`);
    
    // Clear any queued candidates for this peer before restart
    if (this.iceCandidateQueue.has(userId)) {
      console.log(`[WebRTCManager] Clearing ${this.iceCandidateQueue.get(userId)?.length} queued candidates before restart`);
      this.iceCandidateQueue.delete(userId);
    }
    
    if (this.offscreenDocumentCreated) {
      await this.sendToOffscreen("WEBRTC_RESTART_PEER_CONNECTION", { userId });
      console.log(`Initiated restart of peer connection for ${userId}`);
    }
  }

  /**
   * Perform ICE restart for a specific peer connection
   */
  async performIceRestart(targetUserId: string): Promise<void> {
    console.log(`[WebRTCManager] Performing ICE restart for ${targetUserId}`);
    
    try {
      // Clear queued candidates
      this.iceCandidateQueue.delete(targetUserId);
      
      // Request ICE restart from offscreen document
      await this.sendToOffscreen("WEBRTC_ICE_RESTART", { targetUserId });
      
      console.log(`[WebRTCManager] ICE restart initiated for ${targetUserId}`);
    } catch (error) {
      console.error(`[WebRTCManager] ICE restart failed for ${targetUserId}:`, error);
      throw error;
    }
  }

  private emit(eventType: string, data: unknown): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }
}
