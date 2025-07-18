/**
 * WebRTC configuration types and default configurations
 */

/**
 * WebRTC Manager configuration interface
 */
export interface WebRTCManagerConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  dataChannelOptions: RTCDataChannelInit;
}

/**
 * Default WebRTC configuration for the Watch Together extension
 * Uses Google's public STUN servers for NAT traversal
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
