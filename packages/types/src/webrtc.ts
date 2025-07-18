/**
 * WebRTC configuration types and default configurations
 */

/**
 * Cloudflare TURN server credential interfaces
 */
export interface CloudflareTURNCredential {
  username: string;
  credential: string;
  urls: string[];
  ttl: number;
  expiresAt: number;
}

/**
 * TURN credential generation request parameters
 */
export interface TURNCredentialRequest {
  ttl: number; // Time-to-live in seconds
}

/**
 * TURN credential API response from Cloudflare
 */
export interface CloudflareTURNResponse {
  iceServers: RTCIceServer[];
}

/**
 * Enhanced WebRTC Manager configuration interface
 */
export interface WebRTCManagerConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  dataChannelOptions: RTCDataChannelInit;
  turnCredentials?: CloudflareTURNCredential;
  fallbackToSTUNOnly?: boolean;
}

/**
 * TURN service configuration for credential management
 */
export interface TURNServiceConfig {
  apiEndpoint: string;
  credentialTtl: number; // Default TTL for credentials in seconds
  refreshThreshold: number; // Refresh credentials when this many seconds remain
  maxRetries: number;
  retryDelay: number;
}

/**
 * ICE server configuration strategy
 */
export interface ICEServerStrategy {
  primary: RTCIceServer[];
  fallback: RTCIceServer[];
  enableTURN: boolean;
  enableFallback: boolean;
}

/**
 * Default TURN service configuration
 */
export const defaultTURNServiceConfig: TURNServiceConfig = {
  apiEndpoint: "/api/turn/credentials",
  credentialTtl: 86400, // 24 hours
  refreshThreshold: 3600, // Refresh when 1 hour remains
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Default ICE server strategy with Cloudflare TURN support
 */
export const defaultICEServerStrategy: ICEServerStrategy = {
  primary: [
    // Cloudflare TURN servers (will be populated dynamically)
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "turn:turn.cloudflare.com:3478" },
    { urls: "turn:turn.cloudflare.com:3478?transport=tcp" },
    { urls: "turns:turn.cloudflare.com:5349?transport=tcp" },
  ],
  fallback: [
    // Google's public STUN servers as fallback
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  enableTURN: true,
  enableFallback: true,
};

/**
 * Default WebRTC configuration for the Watch Together extension
 * Enhanced with Cloudflare TURN server support
 */
export const defaultWebRTCConfig: WebRTCManagerConfig = {
  iceServers: defaultICEServerStrategy.fallback, // Start with fallback, upgrade to TURN
  iceCandidatePoolSize: 10,
  dataChannelOptions: {
    ordered: true,
    maxRetransmits: 3,
  },
  fallbackToSTUNOnly: false,
};
