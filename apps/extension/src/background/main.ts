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
  StateUpdateMessage,
} from "@repo/types";

import { RoomManager } from "./roomManager";
import { StorageManager, StorageEventManager } from "./storage";
import { defaultWebSocketConfig } from "./websocket";
import { initializeAdapterHandler } from "./adapterHandler";

// Global room manager instance
let roomManager: RoomManager | null = null;

// Navigation debouncing
let lastNavigationTime = 0;
const NAVIGATION_DEBOUNCE_MS = 500;

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
let isInitializing = false;
let isInitialized = false;

async function initializeServiceWorker(): Promise<void> {
  // Prevent multiple initializations
  if (isInitializing || isInitialized) {
    console.log("Service Worker already initialized or initializing");
    return;
  }

  isInitializing = true;

  try {
    // Clean up any existing instances
    await cleanupServiceWorker();

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

    isInitialized = true;
    console.log("Service Worker initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Service Worker:", error);
  } finally {
    isInitializing = false;
  }
}

async function cleanupServiceWorker(): Promise<void> {
  if (roomManager) {
    try {
      await roomManager.cleanup();
    } catch (error) {
      console.error("Error during room manager cleanup:", error);
    }
    roomManager = null;
  }

  // Clear potentially stale extension state
  try {
    await StorageManager.clearExtensionState();
  } catch (error) {
    console.error("Error clearing extension state:", error);
  }

  isInitialized = false;
}

/**
 * Ensure room manager is initialized
 */
async function ensureRoomManagerInitialized(): Promise<void> {
  if (!isInitialized || !roomManager) {
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
    // Don't log WebRTC messages from offscreen to reduce noise
    if (!message.type?.startsWith("WEBRTC_")) {
      console.log("Service Worker received message:", message.type);
    }

    // Check if this is from our offscreen document
    if (sender.url?.includes("offscreen.html")) {
      // Let the WebRTC manager handle these messages directly
      return false;
    }

    // Handle messages asynchronously
    handleMessage(message, sender)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        console.error("Error handling message:", error);
        sendResponse({
          error: error instanceof Error ? error.message : String(error),
        });
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
): Promise<any> {
  try {
    switch (message.type) {
      case "CREATE_ROOM":
        return await handleCreateRoom(message as CreateRoomRequest);

      case "JOIN_ROOM":
        return await handleJoinRoom(message as JoinRoomRequest);

      case "LEAVE_ROOM":
        return await handleLeaveRoom(message as LeaveRoomRequest);

      case "TOGGLE_CONTROL_MODE":
        return await handleToggleControlMode(
          message as ToggleControlModeRequest,
        );

      case "SET_FOLLOW_MODE":
        return await handleSetFollowMode(message as SetFollowModeRequest);

      case "FOLLOW_HOST":
        return await handleFollowHost(message as FollowHostRequest);

      default:
        // Handle unknown message types from content scripts
        if ((message as any).type === "VIDEO_STATE_CHANGE") {
          await handleVideoStateChange(message, sender);
          return { success: true };
        }

        console.warn("Unknown message type:", message.type);
        return { error: "Unknown message type" };
    }
  } catch (error) {
    console.error("Error in message handler:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle CREATE_ROOM request
 */
async function handleCreateRoom(message: CreateRoomRequest): Promise<any> {
  try {
    await ensureRoomManagerInitialized();

    const room = await roomManager!.createRoom(
      message.roomName,
      message.userName,
    );
    return { success: true, room };
  } catch (error) {
    console.error("Failed to create room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create room",
    };
  }
}

/**
 * Handle JOIN_ROOM request
 */
async function handleJoinRoom(message: JoinRoomRequest): Promise<any> {
  try {
    await ensureRoomManagerInitialized();

    const room = await roomManager!.joinRoom(message.roomId, message.userName);
    return { success: true, room };
  } catch (error) {
    console.error("Failed to join room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to join room",
    };
  }
}

/**
 * Handle LEAVE_ROOM request
 */
async function handleLeaveRoom(_message: LeaveRoomRequest): Promise<any> {
  try {
    if (!roomManager) {
      return { success: true }; // Nothing to leave
    }

    // Immediately clear storage state to prevent race conditions
    // This ensures popup always sees clean state, even if room cleanup takes time
    const currentState = await StorageManager.getExtensionState();
    await StorageManager.setExtensionState({
      isConnected: false,
      currentRoom: null,
      connectionStatus: "DISCONNECTED",
      currentUser: null,
      followMode: currentState.followMode, // Preserve user preference
      hasFollowNotification: false,
      followNotificationUrl: null,
    });

    await roomManager.leaveRoom();
    return { success: true };
  } catch (error) {
    console.error("Failed to leave room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to leave room",
    };
  }
}

/**
 * Handle TOGGLE_CONTROL_MODE request
 */
async function handleToggleControlMode(
  _message: ToggleControlModeRequest,
): Promise<any> {
  try {
    if (!roomManager) {
      throw new Error("Not in a room");
    }

    await roomManager.toggleControlMode();
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle control mode:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle control mode",
    };
  }
}

/**
 * Handle SET_FOLLOW_MODE request
 */
async function handleSetFollowMode(
  message: SetFollowModeRequest,
): Promise<any> {
  try {
    await ensureRoomManagerInitialized();

    await roomManager!.setFollowMode(message.mode);
    return { success: true };
  } catch (error) {
    console.error("Failed to set follow mode:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to set follow mode",
    };
  }
}

/**
 * Handle FOLLOW_HOST request
 */
async function handleFollowHost(_message: FollowHostRequest): Promise<any> {
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

    return { success: true };
  } catch (error) {
    console.error("Failed to follow host:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to follow host",
    };
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
 * Handle host navigation
 */
async function handleHostNavigation(url: string): Promise<void> {
  try {
    if (!roomManager) {
      return;
    }

    const state = roomManager.getExtensionState();

    if (state.followMode === "AUTO_FOLLOW") {
      // Only auto-follow to sites with known video adapter support
      if (isValidNavigationUrl(url)) {
        console.log("Auto-following to supported video site:", url);
        await navigateToUrl(url);
      } else {
        console.log(
          "Skipping auto-follow - site not supported or invalid:",
          url,
        );
        // Show manual notification even in auto-follow mode if site isn't supported
        await StorageManager.updateExtensionState({
          hasFollowNotification: true,
          followNotificationUrl: url,
        });
        broadcastStateUpdate(roomManager.getExtensionState());
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
 * Navigate to URL with security validation and duplicate tab checking
 */
async function navigateToUrl(url: string): Promise<void> {
  if (!isValidNavigationUrl(url)) {
    console.warn("Invalid navigation URL blocked:", url);
    return;
  }

  try {
    // Check if participant already has this URL open in any tab
    const existingTabs = await chrome.tabs.query({ url });

    if (existingTabs.length > 0) {
      // Switch to existing tab instead of creating new one
      const existingTab = existingTabs[0];
      await chrome.tabs.update(existingTab.id!, { active: true });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      console.log("Switched to existing tab with URL:", url);
    } else {
      // Create new tab for the URL
      await chrome.tabs.create({ url, active: true });
      console.log("Created new tab for URL:", url);
    }
  } catch (error) {
    console.error("Failed to navigate to URL:", error);
    // Fallback: try to update current tab
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url });
        console.log("Fallback: Updated current tab with URL:", url);
      }
    } catch (fallbackError) {
      console.error("Fallback navigation also failed:", fallbackError);
    }
  }
}


/**
 * Validate URL for navigation security and adapter support
 * Only allows navigation to known video streaming sites with potential adapter support
 */
function isValidNavigationUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Block dangerous protocols first
    if (
      urlObj.protocol === "file:" ||
      url.startsWith("data:") ||
      urlObj.protocol === "javascript:"
    ) {
      return false;
    }

    // Allow only HTTPS URLs for navigation
    if (urlObj.protocol !== "https:") {
      return false;
    }

    // Block localhost, private IPs, and suspicious domains
    const hostname = urlObj.hostname.toLowerCase();

    // Block localhost and loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return false;
    }

    // Block private IP ranges (basic check)
    if (hostname.match(/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./)) {
      return false;
    }

    // Block URLs with suspicious TLDs that could be used for malicious purposes
    const suspiciousTlds = [".tk", ".ml", ".ga", ".cf"];
    if (suspiciousTlds.some((tld) => hostname.endsWith(tld))) {
      return false;
    }

    // Restrictive allowlist for known video streaming sites with adapter support
    const allowedDomains = [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "netflix.com",
      "www.netflix.com",
      "vimeo.com",
      "www.vimeo.com",
      "player.vimeo.com",
      "twitch.tv",
      "www.twitch.tv",
      "amazon.com",
      "www.amazon.com",
      "primevideo.com",
      "www.primevideo.com",
      "hulu.com",
      "www.hulu.com",
      "disneyplus.com",
      "www.disneyplus.com",
      "crunchyroll.com",
      "www.crunchyroll.com",
      "funimation.com",
      "www.funimation.com",
      "dailymotion.com",
      "www.dailymotion.com",
    ];

    // Only allow known video streaming domains (conservative approach)
    return allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
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
      // Debounce rapid navigation events
      const now = Date.now();
      if (now - lastNavigationTime < NAVIGATION_DEBOUNCE_MS) {
        console.log("Navigation debounced:", changeInfo.url);
        return;
      }
      lastNavigationTime = now;

      // Check if this is a valid URL with adapter support
      if (isValidNavigationUrl(changeInfo.url)) {
        console.log("Host navigated to supported video site:", changeInfo.url);
        
        // Broadcast navigation to known video sites only
        try {
          await roomManager.broadcastNavigation(changeInfo.url);
        } catch (error) {
          console.error("Failed to broadcast navigation:", error);
        }
      } else {
        console.log("Host navigated to unsupported site, not broadcasting:", changeInfo.url);
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
