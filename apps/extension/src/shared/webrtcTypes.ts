/**
 * Shared WebRTC types and interfaces
 * Used by both service worker bridge and offscreen WebRTC manager
 */

import type { ControlMode, SyncMessage } from "@repo/types";

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

// Service Worker → Offscreen Messages
export interface WebRTCInitializeMessage {
  type: "WEBRTC_INITIALIZE";
  data: { userId: string; isHost: boolean };
}

export interface WebRTCCreateOfferMessage {
  type: "WEBRTC_CREATE_OFFER";
  data: { targetUserId: string };
}

export interface WebRTCCreateAnswerMessage {
  type: "WEBRTC_CREATE_ANSWER";
  data: { targetUserId: string; offer: RTCSessionDescriptionInit };
}

export interface WebRTCHandleAnswerMessage {
  type: "WEBRTC_HANDLE_ANSWER";
  data: { targetUserId: string; answer: RTCSessionDescriptionInit };
}

export interface WebRTCAddIceCandidateMessage {
  type: "WEBRTC_ADD_ICE_CANDIDATE";
  data: { targetUserId: string; candidate: RTCIceCandidateInit };
}

export interface WebRTCSendSyncMessage {
  type: "WEBRTC_SEND_SYNC_MESSAGE";
  data: { message: SyncMessage; targetUserId?: string };
}

export interface WebRTCSetControlModeMessage {
  type: "WEBRTC_SET_CONTROL_MODE";
  data: { mode: ControlMode };
}

export interface WebRTCMarkPeerAsHostMessage {
  type: "WEBRTC_MARK_PEER_AS_HOST";
  data: { userId: string };
}

export interface WebRTCClosePeerMessage {
  type: "WEBRTC_CLOSE_PEER";
  data: { userId: string };
}

export interface WebRTCCloseAllMessage {
  type: "WEBRTC_CLOSE_ALL";
  data?: undefined;
}

export type ServiceWorkerToOffscreenMessage =
  | WebRTCInitializeMessage
  | WebRTCCreateOfferMessage
  | WebRTCCreateAnswerMessage
  | WebRTCHandleAnswerMessage
  | WebRTCAddIceCandidateMessage
  | WebRTCSendSyncMessage
  | WebRTCSetControlModeMessage
  | WebRTCMarkPeerAsHostMessage
  | WebRTCClosePeerMessage
  | WebRTCCloseAllMessage;

// Offscreen → Service Worker Messages
export interface WebRTCIceCandidateEvent {
  type: "WEBRTC_ICE_CANDIDATE";
  targetUserId: string;
  candidate: RTCIceCandidate;
}

export interface WebRTCConnectionStateChangeEvent {
  type: "WEBRTC_CONNECTION_STATE_CHANGE";
  userId: string;
  state: RTCPeerConnectionState;
}

export interface WebRTCDataChannelOpenEvent {
  type: "WEBRTC_DATA_CHANNEL_OPEN";
  userId: string;
}

export interface WebRTCDataChannelCloseEvent {
  type: "WEBRTC_DATA_CHANNEL_CLOSE";
  userId: string;
}

export interface WebRTCSyncMessageEvent {
  type: "WEBRTC_SYNC_MESSAGE";
  message: SyncMessage;
  fromUserId: string;
}

export interface WebRTCDataChannelErrorEvent {
  type: "WEBRTC_DATA_CHANNEL_ERROR";
  userId: string;
  error: string;
}

export type OffscreenToServiceWorkerMessage =
  | WebRTCIceCandidateEvent
  | WebRTCConnectionStateChangeEvent
  | WebRTCDataChannelOpenEvent
  | WebRTCDataChannelCloseEvent
  | WebRTCSyncMessageEvent
  | WebRTCDataChannelErrorEvent;

// Response types
export interface WebRTCInitializeResponse {
  success: boolean;
}

export interface WebRTCCreateOfferResponse {
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCCreateAnswerResponse {
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCSuccessResponse {
  success: boolean;
}

export interface WebRTCSendSyncMessageResponse {
  success: boolean;
  sentCount: number;
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
