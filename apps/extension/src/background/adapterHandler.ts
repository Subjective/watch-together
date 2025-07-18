/**
 * Handles communication with content script adapters
 */
import type { AdapterMessage } from "@repo/types";

// Adapter event detail interface
export interface AdapterEventDetail {
  tabId: number;
  event:
    | "play"
    | "pause"
    | "seeking"
    | "seeked"
    | "timeupdate"
    | "loadedmetadata"
    | "durationchange";
  payload?: any;
  state: {
    currentTime: number;
    duration: number;
    isPaused: boolean;
    playbackRate: number;
  };
  sourceUrl: string;
  timestamp: number;
  isRemoteOrigin?: boolean; // Track if event originated from remote command
}

// Custom event type for adapter events
export interface AdapterEvent extends Event {
  detail: AdapterEventDetail;
}

// Store active adapter connections
const activeAdapters = new Map<
  string,
  {
    tabId: number;
    port?: chrome.runtime.Port;
    state: {
      currentTime: number;
      duration: number;
      isPaused: boolean;
      playbackRate: number;
    };
    lastUpdate: number;
  }
>();

// Event target for broadcasting adapter events
export const adapterEventTarget = new EventTarget();

/**
 * Initialize adapter handler
 */
export function initializeAdapterHandler(): void {
  // Listen for port connections from content scripts
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "content-adapter") {
      handleAdapterConnection(port);
    }
  });

  // Listen for one-time messages (only as fallback when no port exists)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab?.id && isAdapterMessage(message)) {
      const adapterId = `tab-${sender.tab.id}`;
      const adapter = activeAdapters.get(adapterId);

      // Only handle if no active port connection exists
      if (!adapter?.port) {
        handleAdapterMessage(message, sender.tab.id);
        sendResponse({ received: true });
      }
    }
  });

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    activeAdapters.delete(`tab-${tabId}`);
  });
}

/**
 * Handle new adapter connection
 */
function handleAdapterConnection(port: chrome.runtime.Port): void {
  const tabId = port.sender?.tab?.id;
  if (!tabId) return;

  const adapterId = `tab-${tabId}`;

  // Store the connection
  activeAdapters.set(adapterId, {
    tabId,
    port,
    state: {
      currentTime: 0,
      duration: 0,
      isPaused: true,
      playbackRate: 1,
    },
    lastUpdate: Date.now(),
  });

  console.log(`[AdapterHandler] Connected to adapter in tab ${tabId}`);

  // Request initial state to populate duration and other details
  try {
    port.postMessage({ type: "ADAPTER_STATE_REQUEST", timestamp: Date.now() });
  } catch (error) {
    console.warn(
      `[AdapterHandler] Failed to request initial state from tab ${tabId}:`,
      error,
    );
  }

  // Handle messages from the adapter
  port.onMessage.addListener((message) => {
    if (isAdapterMessage(message)) {
      handleAdapterMessage(message, tabId);
    }
  });

  // Handle disconnection
  port.onDisconnect.addListener(() => {
    console.log(`[AdapterHandler] Disconnected from adapter in tab ${tabId}`);
    const adapter = activeAdapters.get(adapterId);
    if (adapter) {
      adapter.port = undefined;
    }
  });
}

/**
 * Check if message is an adapter message
 */
function isAdapterMessage(message: any): message is AdapterMessage {
  return (
    message?.type &&
    [
      "ADAPTER_EVENT",
      "ADAPTER_COMMAND",
      "ADAPTER_STATE_REQUEST",
      "ADAPTER_STATE_RESPONSE",
    ].includes(message.type)
  );
}

/**
 * Handle adapter message
 */
function handleAdapterMessage(message: AdapterMessage, tabId: number): void {
  const adapterId = `tab-${tabId}`;
  const adapter = activeAdapters.get(adapterId);

  switch (message.type) {
    case "ADAPTER_EVENT":
      handleAdapterEvent(message, tabId);
      break;
    case "ADAPTER_STATE_RESPONSE":
      if (adapter && message.state) {
        adapter.state = message.state;
        adapter.lastUpdate = Date.now();
      }
      break;
  }
}

/**
 * Handle adapter events
 */
function handleAdapterEvent(message: AdapterMessage, tabId: number): void {
  if (message.type !== "ADAPTER_EVENT") return;

  const adapterId = `tab-${tabId}`;
  const adapter = activeAdapters.get(adapterId);
  if (!adapter) return;

  // Update state based on event
  switch (message.event) {
    case "play":
      adapter.state.isPaused = false;
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      break;
    case "pause":
      adapter.state.isPaused = true;
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      break;
    case "timeupdate":
      if (message.payload?.currentTime !== undefined) {
        adapter.state.currentTime = message.payload.currentTime;
      }
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      break;
    case "seeking":
      // For seeking events, we expect currentTime in the payload
      if (message.payload?.currentTime !== undefined) {
        adapter.state.currentTime = message.payload.currentTime;
      }
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      break;
    case "seeked":
      // For seeked events (seek completed), update the current time
      if (message.payload?.currentTime !== undefined) {
        adapter.state.currentTime = message.payload.currentTime;
      }
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      break;
    case "loadedmetadata":
    case "durationchange":
      // These events specifically indicate duration is available
      if (message.payload?.duration !== undefined) {
        adapter.state.duration = message.payload.duration;
      }
      if (message.payload?.currentTime !== undefined) {
        adapter.state.currentTime = message.payload.currentTime;
      }
      break;
  }

  adapter.lastUpdate = Date.now();

  // Broadcast event to other parts of the extension
  broadcastAdapterEvent(tabId, message);
}

/**
 * Broadcast adapter event to other parts of the extension
 */
function broadcastAdapterEvent(tabId: number, message: AdapterMessage): void {
  if (message.type !== "ADAPTER_EVENT") return;

  console.log(`[AdapterHandler] Event from tab ${tabId}:`, message.event);

  // Get the adapter state
  const adapterId = `tab-${tabId}`;
  const adapter = activeAdapters.get(adapterId);
  if (!adapter) return;

  // Create a custom event that the room manager can listen to
  const event = new CustomEvent("adapter:event", {
    detail: {
      tabId,
      event: message.event,
      payload: message.payload,
      state: adapter.state,
      sourceUrl: message.sourceUrl,
      timestamp: message.timestamp || Date.now(),
    },
  });

  // Dispatch the event on a shared event target
  adapterEventTarget.dispatchEvent(event);
}

/**
 * Send command to adapter
 */
export async function sendAdapterCommand(
  tabId: number,
  command: "play" | "pause" | "seek" | "setPlaybackRate",
  payload?: { time?: number; rate?: number },
): Promise<void> {
  const adapterId = `tab-${tabId}`;
  const adapter = activeAdapters.get(adapterId);

  if (!adapter) {
    throw new Error(`No adapter found for tab ${tabId}`);
  }

  const message: AdapterMessage = {
    type: "ADAPTER_COMMAND",
    command,
    payload,
    timestamp: Date.now(),
  };

  // Try to send via port first
  if (adapter.port) {
    try {
      adapter.port.postMessage(message);
      return;
    } catch {
      console.warn(
        `[AdapterHandler] Port send failed, falling back to tabs API`,
      );
    }
  }

  // Fallback to tabs.sendMessage
  try {
    await chrome.tabs.sendMessage(tabId, {
      ...message,
      target: "content-adapter",
    });
  } catch (error) {
    console.error(
      `[AdapterHandler] Failed to send command to tab ${tabId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Request adapter state
 */
export async function requestAdapterState(tabId: number): Promise<{
  currentTime: number;
  duration: number;
  isPaused: boolean;
  playbackRate: number;
} | null> {
  const adapterId = `tab-${tabId}`;
  const adapter = activeAdapters.get(adapterId);

  if (!adapter) {
    return null;
  }

  const message: AdapterMessage = {
    type: "ADAPTER_STATE_REQUEST",
    timestamp: Date.now(),
  };

  // Send state request
  if (adapter.port) {
    adapter.port.postMessage(message);
  } else {
    await chrome.tabs.sendMessage(tabId, {
      ...message,
      target: "content-adapter",
    });
  }

  // Return cached state (will be updated by response)
  return adapter.state;
}

/**
 * Get all active adapters
 */
export function getActiveAdapters(): Array<{
  tabId: number;
  connected: boolean;
  state: {
    currentTime: number;
    duration: number;
    isPaused: boolean;
    playbackRate: number;
  };
  lastUpdate: number;
}> {
  return Array.from(activeAdapters.entries()).map(([_id, adapter]) => ({
    tabId: adapter.tabId,
    connected: !!adapter.port,
    state: adapter.state,
    lastUpdate: adapter.lastUpdate,
  }));
}

/**
 * Check if adapter is active for a tab
 */
export function isAdapterActive(tabId: number): boolean {
  return activeAdapters.has(`tab-${tabId}`);
}
