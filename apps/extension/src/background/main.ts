/**
 * Service Worker entry point for Watch Together Chrome extension
 */
import type { ExtensionMessage, ExtensionState } from "@repo/types";

console.log("Watch Together Service Worker loaded");

// Initial state for testing
const initialState: ExtensionState = {
  isConnected: false,
  currentRoom: null,
  connectionStatus: "DISCONNECTED",
  currentUser: null,
  followMode: "AUTO_FOLLOW",
  hasFollowNotification: false,
  followNotificationUrl: null,
};

// Handle messages from popup
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    console.log("Service Worker received message:", message);

    switch (message.type) {
      case "GET_STATE":
        // Return current state
        sendResponse(initialState);
        break;

      case "CREATE_ROOM":
        console.log("Create room request:", message.roomName, message.userName);
        // TODO: Implement room creation logic
        sendResponse({ success: true });
        break;

      case "JOIN_ROOM":
        console.log("Join room request:", message.roomId, message.userName);
        // TODO: Implement room joining logic
        sendResponse({ success: true });
        break;

      case "LEAVE_ROOM":
        console.log("Leave room request");
        // TODO: Implement leave room logic
        sendResponse({ success: true });
        break;

      case "TOGGLE_CONTROL_MODE":
        console.log("Toggle control mode request");
        // TODO: Implement control mode toggle
        sendResponse({ success: true });
        break;

      case "SET_FOLLOW_MODE":
        console.log("Set follow mode request:", message.mode);
        // TODO: Implement follow mode setting
        sendResponse({ success: true });
        break;

      case "FOLLOW_HOST":
        console.log("Follow host request");
        // TODO: Implement follow host logic
        sendResponse({ success: true });
        break;

      default:
        console.warn("Unknown message type:", message.type);
        sendResponse({ error: "Unknown message type" });
    }

    // Return true to indicate we will send a response asynchronously
    return true;
  },
);
