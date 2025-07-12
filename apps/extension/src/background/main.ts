/**
 * Service Worker entry point for Watch Together Chrome extension
 * Central orchestrator for room management, WebRTC, and content script communication
 */

import type {
  ExtensionMessage,
  ExtensionState,
  CreateRoomRequest,
  JoinRoomRequest,
  LeaveRoomRequest,
  ToggleControlModeRequest,
  SetFollowModeRequest,
  FollowHostRequest,
  GetStateRequest,
  StateUpdateMessage,
} from "@repo/types";

import { RoomManager } from "./roomManager";
import { StorageManager, StorageEventManager } from "./storage";
import { defaultWebSocketConfig } from "./websocket";
import { initializeAdapterHandler } from "./adapterHandler";

// Global room manager instance
let roomManager: RoomManager | null = null;

// Extension initialization
console.log("Watch Together Service Worker loaded");

/**
 * Handle Service Worker suspension (browser close)
 */
chrome.runtime.onSuspend.addListener(async () => {
  console.log("Service Worker suspending - cleaning up room connections");

  // Prevent duplicate cleanup
  if (isCleaningUp) {
    console.log("Cleanup already in progress, skipping");
    return;
  }

  isCleaningUp = true;

  try {
    if (roomManager) {
      await roomManager.leaveRoom();
      await StorageManager.clearConnectionState();
    }
  } catch (error) {
    console.error("Error during Service Worker suspension cleanup:", error);
  } finally {
    isCleaningUp = false;
  }
});

/**
 * Track tabs that are part of watch sessions (for reference)
 */
const activeTabs = new Set<number>();

/**
 * Track if we're already cleaning up to prevent duplicate leave messages
 */
let isCleaningUp = false;

/**
 * Initialize the Service Worker
 */
async function initializeServiceWorker(): Promise<void> {
  try {
    // Initialize storage event manager
    StorageEventManager.init();

    // Initialize adapter handler
    initializeAdapterHandler();

    // Get WebRTC configuration from storage
    const webrtcConfig = await StorageManager.getWebRTCConfig();

    // Initialize room manager
    roomManager = new RoomManager({
      websocketUrl: defaultWebSocketConfig.url,
      webrtcConfig: {
        iceServers: webrtcConfig.iceServers,
        iceCandidatePoolSize: webrtcConfig.iceCandidatePoolSize,
      },
    });

    // Set up room manager event listeners
    setupRoomManagerEventHandlers();

    // Initialize room manager
    await roomManager.initialize();

    console.log("Service Worker initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Service Worker:", error);
  }
}

/**
 * Ensure room manager is initialized
 */
async function ensureRoomManagerInitialized(): Promise<void> {
  if (!roomManager) {
    await initializeServiceWorker();
  }

  if (!roomManager) {
    throw new Error("Room manager failed to initialize");
  }
}

/**
 * Set up event handlers for room manager
 */
function setupRoomManagerEventHandlers(): void {
  if (!roomManager) return;

  // Listen for state updates to broadcast to popup
  roomManager.on("STATE_UPDATE", (state: ExtensionState) => {
    broadcastStateUpdate(state);
  });

  // Listen for video control events to forward to content scripts
  roomManager.on("VIDEO_CONTROL", (data: any) => {
    forwardToContentScript("VIDEO_CONTROL", data);
  });

  // Listen for host navigation events
  roomManager.on("HOST_NAVIGATE", async (data: any) => {
    await handleHostNavigation(data.url);
  });

  // Listen for control mode changes
  roomManager.on("CONTROL_MODE_CHANGED", (_data: any) => {
    broadcastStateUpdate(roomManager!.getExtensionState());
  });

  // Listen for client requests (when acting as host)
  roomManager.on("CLIENT_REQUEST", (data: any) => {
    handleClientRequest(data);
  });
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    console.log("Service Worker received message:", message.type);

    // Handle messages asynchronously
    handleMessage(message, sender, sendResponse).catch((error) => {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    });

    // Return true to indicate we will send a response asynchronously
    return true;
  },
);

/**
 * Handle extension messages
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): Promise<void> {
  try {
    switch (message.type) {
      case "GET_STATE":
        await handleGetState(message as GetStateRequest, sendResponse);
        break;

      case "CREATE_ROOM":
        await handleCreateRoom(message as CreateRoomRequest, sendResponse);
        break;

      case "JOIN_ROOM":
        await handleJoinRoom(message as JoinRoomRequest, sendResponse);
        break;

      case "LEAVE_ROOM":
        await handleLeaveRoom(message as LeaveRoomRequest, sendResponse);
        break;

      case "TOGGLE_CONTROL_MODE":
        await handleToggleControlMode(
          message as ToggleControlModeRequest,
          sendResponse,
        );
        break;

      case "SET_FOLLOW_MODE":
        await handleSetFollowMode(
          message as SetFollowModeRequest,
          sendResponse,
        );
        break;

      case "FOLLOW_HOST":
        await handleFollowHost(message as FollowHostRequest, sendResponse);
        break;

      default:
        // Handle unknown message types from content scripts
        if ((message as any).type === "VIDEO_STATE_CHANGE") {
          await handleVideoStateChange(message, sender);
          sendResponse({ success: true });
          return;
        }

        if ((message as any).type === "VIDEO_CONTROL_REQUEST") {
          await handleVideoControlRequest(message, sender);
          sendResponse({ success: true });
          return;
        }

        console.warn("Unknown message type:", message.type);
        sendResponse({ error: "Unknown message type" });
    }
  } catch (error) {
    console.error("Error in message handler:", error);
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle GET_STATE request
 */
async function handleGetState(
  _message: GetStateRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  await ensureRoomManagerInitialized();

  const state = roomManager!.getExtensionState();
  sendResponse({ state });
}

/**
 * Handle CREATE_ROOM request
 */
async function handleCreateRoom(
  message: CreateRoomRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    await ensureRoomManagerInitialized();

    const room = await roomManager!.createRoom(
      message.roomName,
      message.userName,
    );
    sendResponse({ success: true, room });
  } catch (error) {
    console.error("Failed to create room:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create room",
    });
  }
}

/**
 * Handle JOIN_ROOM request
 */
async function handleJoinRoom(
  message: JoinRoomRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    await ensureRoomManagerInitialized();

    const room = await roomManager!.joinRoom(message.roomId, message.userName);
    sendResponse({ success: true, room });
  } catch (error) {
    console.error("Failed to join room:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to join room",
    });
  }
}

/**
 * Handle LEAVE_ROOM request
 */
async function handleLeaveRoom(
  _message: LeaveRoomRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    if (!roomManager) {
      sendResponse({ success: true }); // Nothing to leave
      return;
    }

    await roomManager.leaveRoom();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to leave room:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to leave room",
    });
  }
}

/**
 * Handle TOGGLE_CONTROL_MODE request
 */
async function handleToggleControlMode(
  _message: ToggleControlModeRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    if (!roomManager) {
      throw new Error("Not in a room");
    }

    await roomManager.toggleControlMode();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to toggle control mode:", error);
    sendResponse({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle control mode",
    });
  }
}

/**
 * Handle SET_FOLLOW_MODE request
 */
async function handleSetFollowMode(
  message: SetFollowModeRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    await ensureRoomManagerInitialized();

    await roomManager!.setFollowMode(message.mode);
    sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to set follow mode:", error);
    sendResponse({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to set follow mode",
    });
  }
}

/**
 * Handle FOLLOW_HOST request
 */
async function handleFollowHost(
  _message: FollowHostRequest,
  sendResponse: (response: any) => void,
): Promise<void> {
  try {
    const state = roomManager?.getExtensionState();
    if (!state?.hasFollowNotification || !state.followNotificationUrl) {
      throw new Error("No follow notification available");
    }

    // Navigate to the URL
    await navigateToUrl(state.followNotificationUrl);

    // Clear the notification
    if (roomManager) {
      await StorageManager.updateExtensionState({
        hasFollowNotification: false,
        followNotificationUrl: null,
      });
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("Failed to follow host:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to follow host",
    });
  }
}

/**
 * Handle video state changes from content scripts
 */
async function handleVideoStateChange(
  message: any,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  if (!roomManager || !sender.tab?.id) {
    return;
  }

  // Track this tab as active in watch session
  activeTabs.add(sender.tab.id);

  const currentUser = roomManager.getCurrentUser();
  if (!currentUser?.isHost) {
    return; // Only host can broadcast state changes
  }

  // Broadcast video state to peers
  await roomManager.sendVideoControl(
    message.isPlaying ? "PLAY" : "PAUSE",
    message.currentTime,
  );
}

/**
 * Handle video control requests from content scripts
 */
async function handleVideoControlRequest(
  message: any,
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  if (!roomManager || !sender.tab?.id) {
    return;
  }

  // Track this tab as active in watch session
  activeTabs.add(sender.tab.id);

  // Forward control request through room manager
  await roomManager.sendVideoControl(message.action, message.seekTime);
}

/**
 * Handle host navigation
 */
async function handleHostNavigation(url: string): Promise<void> {
  try {
    if (!roomManager) {
      return;
    }

    const state = roomManager.getExtensionState();

    if (state.followMode === "AUTO_FOLLOW") {
      // Validate URL before navigation
      if (isValidNavigationUrl(url)) {
        await navigateToUrl(url);
      }
    } else {
      // Manual follow mode - show notification
      await StorageManager.updateExtensionState({
        hasFollowNotification: true,
        followNotificationUrl: url,
      });

      // Broadcast state update
      broadcastStateUpdate(roomManager.getExtensionState());
    }
  } catch (error) {
    console.error("Failed to handle host navigation:", error);
  }
}

/**
 * Handle client requests when acting as host
 */
async function handleClientRequest(data: any): Promise<void> {
  // Forward request to content script to execute
  forwardToContentScript("CLIENT_REQUEST", data);
}

/**
 * Navigate to URL with security validation
 */
async function navigateToUrl(url: string): Promise<void> {
  if (!isValidNavigationUrl(url)) {
    console.warn("Invalid navigation URL blocked:", url);
    return;
  }

  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { url });
    }
  } catch (error) {
    console.error("Failed to navigate to URL:", error);
  }
}

/**
 * Validate URL for navigation security
 */
function isValidNavigationUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Allow only HTTPS URLs
    if (urlObj.protocol !== "https:") {
      return false;
    }

    // Allow any domain with video elements for testing
    // In production, you might want to restrict this
    return true;

    // Original domain-based validation (commented out for testing)
    // const allowedDomains = [
    //   "youtube.com",
    //   "www.youtube.com",
    //   "netflix.com",
    //   "www.netflix.com",
    //   "vimeo.com",
    //   "www.vimeo.com",
    //   "twitch.tv",
    //   "www.twitch.tv",
    //   "amazon.com",
    //   "www.amazon.com",
    //   "hulu.com",
    //   "www.hulu.com",
    //   "disneyplus.com",
    //   "www.disneyplus.com",
    // ];
    // return allowedDomains.some(
    //   (domain) =>
    //     urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`),
    // );
  } catch {
    return false;
  }
}

/**
 * Forward message to content script
 */
async function forwardToContentScript(type: string, data: any): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type, ...data });
    }
  } catch (error) {
    console.error("Failed to forward message to content script:", error);
  }
}

/**
 * Broadcast state update to popup
 */
function broadcastStateUpdate(state: ExtensionState): void {
  const message: StateUpdateMessage = {
    type: "STATE_UPDATE",
    timestamp: Date.now(),
    state,
  };

  // Send to popup if it's open
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might not be open, which is fine
  });
}

/**
 * Handle tab updates for navigation detection
 */
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, _tab) => {
  if (changeInfo.url && roomManager) {
    const currentUser = roomManager.getCurrentUser();

    // Only host can trigger navigation
    if (currentUser?.isHost) {
      // Check if this is a supported video site
      if (isValidNavigationUrl(changeInfo.url)) {
        // Broadcast navigation to peers (handled by room manager)
        console.log("Host navigated to:", changeInfo.url);
        // The room manager will handle broadcasting to peers
      }
    }
  }
});

/**
 * Handle service worker startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log("Service Worker starting up");
  initializeServiceWorker();
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
  initializeServiceWorker();
});

// Initialize on script load
initializeServiceWorker();
