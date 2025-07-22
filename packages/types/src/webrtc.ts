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
 * Uses Cloudflare STUN servers for basic NAT traversal
 * TURN servers are fetched dynamically from the backend API
 */
export const defaultWebRTCConfig: WebRTCManagerConfig = {
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.cloudflare.com:53" },
  ],
  iceCandidatePoolSize: 10,
  dataChannelOptions: {
    ordered: true,
    maxRetransmits: 3,
  },
};
