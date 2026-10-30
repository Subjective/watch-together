/**
 * Offscreen Document Entry Point
 *
 * Initializes the offscreen document context for WebRTC operations.
 * Service workers cannot access WebRTC APIs directly, so this offscreen
 * document provides the necessary browser context for peer connections.
 */

import { OffscreenWebRTCManager } from "./webrtcManager";

// Initialize the offscreen WebRTC manager
new OffscreenWebRTCManager();
console.log("[Offscreen] WebRTC offscreen document initialized");
