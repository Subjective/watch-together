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
  RenameRoomRequest,
  RenameUserRequest,
  ToggleControlModeRequest,
  SetFollowModeRequest,
  FollowHostRequest,
  JoinRoomFromLinkRequest,
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

  // Navigation-based auto-follow has been replaced with video state-based auto-follow

  // Listen for control mode changes
  roomManager.on("CONTROL_MODE_CHANGED", (_data: any) => {
    broadcastStateUpdate(roomManager!.getExtensionState());
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
          success: false,
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

      case "RENAME_ROOM":
        return await handleRenameRoom(message as RenameRoomRequest);

      case "RENAME_USER":
        return await handleRenameUser(message as RenameUserRequest);

      case "TOGGLE_CONTROL_MODE":
        return await handleToggleControlMode(
          message as ToggleControlModeRequest,
        );

      case "SET_FOLLOW_MODE":
        return await handleSetFollowMode(message as SetFollowModeRequest);

      case "FOLLOW_HOST":
        return await handleFollowHost(message as FollowHostRequest);

      case "JOIN_ROOM_FROM_LINK":
        return await handleJoinRoomFromLink(message as JoinRoomFromLinkRequest);

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

    const room = await roomManager!.joinRoom(
      message.roomId,
      message.userName,
      message.allowRecreation,
    );
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
 * Handle RENAME_ROOM request
 */
async function handleRenameRoom(message: RenameRoomRequest): Promise<any> {
  try {
    if (!roomManager) {
      throw new Error("Not in a room");
    }

    await roomManager.renameRoom(message.newRoomName);
    return { success: true };
  } catch (error) {
    console.error("Failed to rename room:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rename room",
    };
  }
}

/**
 * Handle RENAME_USER request
 */
async function handleRenameUser(message: RenameUserRequest): Promise<any> {
  try {
    if (!roomManager) {
      throw new Error("Not in a room");
    }

    await roomManager.renameUser(message.newUserName);
    return { success: true };
  } catch (error) {
    console.error("Failed to rename user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rename user",
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

    // Navigate to the video URL (trusted video URLs don't need domain validation)
    await navigateToVideoUrl(state.followNotificationUrl);

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
 * Handle JOIN_ROOM_FROM_LINK request
 */
async function handleJoinRoomFromLink(
  message: JoinRoomFromLinkRequest,
): Promise<any> {
  try {
    await ensureRoomManagerInitialized();

    const currentRoom = roomManager!.getCurrentRoom();
    if (currentRoom) {
      if (currentRoom.id === message.roomId) {
        return { success: true };
      }
      return { success: false, error: "Already in a room" };
    }

    const prefs = await StorageManager.getUserPreferences();
    const userName = prefs.defaultUserName || "Guest";

    const room = await roomManager!.joinRoom(message.roomId, userName, true);
    return { success: true, room };
  } catch (error) {
    console.error("Failed to join room from link:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to join room from link",
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
 * Navigate to trusted video URL without domain validation (for host video state URLs)
 */
async function navigateToVideoUrl(url: string): Promise<void> {
  try {
    // Basic security check for dangerous protocols only
    if (
      url.startsWith("data:") ||
      url.startsWith("javascript:") ||
      url.startsWith("file:")
    ) {
      console.warn("Dangerous video URL blocked:", url);
      return;
    }

    // Check if participant already has this URL open in any tab
    const existingTabs = await chrome.tabs.query({ url });

    if (existingTabs.length > 0) {
      // Switch to existing tab instead of creating new one
      const existingTab = existingTabs[0];
      await chrome.tabs.update(existingTab.id!, { active: true });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
      console.log("Switched to existing tab with video URL:", url);
    } else {
      // Create new tab for the URL
      await chrome.tabs.create({ url, active: true });
      console.log("Created new tab for video URL:", url);
    }
  } catch (error) {
    console.error("Failed to navigate to video URL:", error);
    // Fallback: try to update current tab
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url });
        console.log("Fallback: Updated current tab with video URL:", url);
      }
    } catch (fallbackError) {
      console.error(
        "Fallback navigation for video URL also failed:",
        fallbackError,
      );
    }
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
 * Handle tab updates for host current location tracking
 * Note: Auto-follow is now handled via video state updates, not navigation events
 */
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, _tab) => {
  if (changeInfo.url && roomManager) {
    const currentUser = roomManager.getCurrentUser();

    // Track host current location for "Host Current Location" display
    if (currentUser?.isHost) {
      // Debounce rapid navigation events
      const now = Date.now();
      if (now - lastNavigationTime < NAVIGATION_DEBOUNCE_MS) {
        console.log("Navigation debounced:", changeInfo.url);
        return;
      }
      lastNavigationTime = now;

      // Update host current location in room state (for display purposes only)
      try {
        await roomManager.updateHostCurrentUrl(changeInfo.url);
      } catch (error) {
        console.error("Failed to update host current URL:", error);
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
