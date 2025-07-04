/**
 * WebSocket signaling message types for room management and WebRTC negotiation
 */
export interface BaseSignalingMessage {
  type: string;
  roomId: string;
  userId: string;
  timestamp: number;
}

export interface CreateRoomMessage extends BaseSignalingMessage {
  type: "CREATE_ROOM";
  userName: string;
}

export interface JoinRoomMessage extends BaseSignalingMessage {
  type: "JOIN_ROOM";
  userName: string;
}

export interface LeaveRoomMessage extends BaseSignalingMessage {
  type: "LEAVE_ROOM";
}

export interface WebRTCOfferMessage extends BaseSignalingMessage {
  type: "WEBRTC_OFFER";
  targetUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerMessage extends BaseSignalingMessage {
  type: "WEBRTC_ANSWER";
  targetUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCIceCandidateMessage extends BaseSignalingMessage {
  type: "WEBRTC_ICE_CANDIDATE";
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}

export type SignalingMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | WebRTCOfferMessage
  | WebRTCAnswerMessage
  | WebRTCIceCandidateMessage;

/**
 * WebRTC Data Channel message types for video synchronization
 */
export interface BaseSyncMessage {
  type: string;
  userId: string;
  timestamp: number;
}

export interface HostStateUpdateMessage extends BaseSyncMessage {
  type: "HOST_STATE_UPDATE";
  state: "PLAYING" | "PAUSED";
  time: number;
}

export interface ClientRequestPlayMessage extends BaseSyncMessage {
  type: "CLIENT_REQUEST_PLAY";
}

export interface ClientRequestPauseMessage extends BaseSyncMessage {
  type: "CLIENT_REQUEST_PAUSE";
}

export interface ClientRequestSeekMessage extends BaseSyncMessage {
  type: "CLIENT_REQUEST_SEEK";
  time: number;
}

export interface DirectPlayMessage extends BaseSyncMessage {
  type: "DIRECT_PLAY";
}

export interface DirectPauseMessage extends BaseSyncMessage {
  type: "DIRECT_PAUSE";
}

export interface DirectSeekMessage extends BaseSyncMessage {
  type: "DIRECT_SEEK";
  time: number;
}

export interface ControlModeChangeMessage extends BaseSyncMessage {
  type: "CONTROL_MODE_CHANGE";
  mode: "HOST_ONLY" | "FREE_FOR_ALL";
}

export interface HostNavigateMessage extends BaseSyncMessage {
  type: "HOST_NAVIGATE";
  url: string;
}

export type SyncMessage =
  | HostStateUpdateMessage
  | ClientRequestPlayMessage
  | ClientRequestPauseMessage
  | ClientRequestSeekMessage
  | DirectPlayMessage
  | DirectPauseMessage
  | DirectSeekMessage
  | ControlModeChangeMessage
  | HostNavigateMessage;
