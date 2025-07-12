/**
 * Content script loader that detects sites and injects appropriate adapters
 */
import { AdapterFactory } from "@repo/adapters";
import type { IPlayerAdapter, AdapterMessage } from "@repo/types";
import { runUniversalPlayerDiagnostic } from "@repo/adapters";

// Current adapter instance
let currentAdapter: IPlayerAdapter | null = null;

// Communication channel with Service Worker
let port: chrome.runtime.Port | null = null;

/**
 * Initialize the content script loader
 */
export function initialize(): void {
  console.log("[ContentLoader] Initializing...");

  // Set up diagnostic via message passing (CSP-compliant)
  document.addEventListener("run-diagnostic", async () => {
    console.log("🔍 Running Universal Player Diagnostic...");
    const results = await runUniversalPlayerDiagnostic();
    console.log("✅ Diagnostic complete. Results:", results);
    // Dispatch results back
    document.dispatchEvent(
      new CustomEvent("diagnostic-complete", {
        detail: results,
      }),
    );
  });

  console.log(
    "[ContentLoader] Diagnostics enabled. Run: document.dispatchEvent(new Event('run-diagnostic'))",
  );

  // Set up communication with Service Worker
  setupServiceWorkerConnection();

  // Detect and create adapter for current page
  detectAndCreateAdapter();

  // Listen for page navigation changes
  observePageChanges();

  // Listen for commands from Service Worker
  listenForCommands();
}

/**
 * Set up persistent connection with Service Worker
 */
function setupServiceWorkerConnection(): void {
  try {
    port = chrome.runtime.connect({ name: "content-adapter" });

    port.onMessage.addListener((message) => {
      handleServiceWorkerMessage(message);
    });

    port.onDisconnect.addListener(() => {
      console.log("[ContentLoader] Disconnected from Service Worker");
      port = null;
      // Try to reconnect after a delay
      setTimeout(setupServiceWorkerConnection, 1000);
    });

    console.log("[ContentLoader] Connected to Service Worker");
  } catch (error) {
    console.error(
      "[ContentLoader] Failed to connect to Service Worker:",
      error,
    );
  }
}

/**
 * Detect and create appropriate adapter for the current page
 */
function detectAndCreateAdapter(): void {
  // Clean up existing adapter
  if (currentAdapter) {
    currentAdapter.destroy();
    currentAdapter = null;
  }

  try {
    // Use AdapterFactory to create appropriate adapter
    currentAdapter = AdapterFactory.createAdapter();

    if (currentAdapter) {
      console.log("[ContentLoader] Adapter created successfully");
      setupAdapterEventListeners();
      notifyAdapterReady();
    } else {
      console.log("[ContentLoader] No suitable adapter found for this page");
      notifyNoAdapter();
    }
  } catch (error) {
    console.error("[ContentLoader] Failed to create adapter:", error);
    notifyAdapterError(error);
  }
}

/**
 * Set up event listeners on the current adapter
 */
function setupAdapterEventListeners(): void {
  if (!currentAdapter) return;

  // Send all events to room manager, which will handle throttling logic
  // This allows room manager to make intelligent decisions about when to sync

  const events: Array<"play" | "pause" | "seeking" | "seeked" | "timeupdate"> =
    ["play", "pause", "seeking", "seeked", "timeupdate"];

  events.forEach((event) => {
    currentAdapter!.on(event, (payload) => {
      sendAdapterEvent(event, payload);
    });
  });
}

/**
 * Send adapter event to Service Worker
 */
function sendAdapterEvent(
  event: "play" | "pause" | "seeking" | "seeked" | "timeupdate",
  payload?: any,
): void {
  const message: AdapterMessage = {
    type: "ADAPTER_EVENT",
    event,
    payload,
    timestamp: Date.now(),
  };

  sendToServiceWorker(message);
}

/**
 * Send message to Service Worker
 */
function sendToServiceWorker(message: AdapterMessage): void {
  if (port) {
    port.postMessage(message);
  } else {
    // Fallback to runtime.sendMessage if port is not available
    chrome.runtime.sendMessage(message).catch((error) => {
      console.error("[ContentLoader] Failed to send message:", error);
    });
  }
}

/**
 * Handle messages from Service Worker
 */
async function handleServiceWorkerMessage(message: any): Promise<void> {
  if (!message.type) return;

  switch (message.type) {
    case "ADAPTER_COMMAND":
      await handleAdapterCommand(message);
      break;
    case "ADAPTER_STATE_REQUEST":
      await handleStateRequest(message);
      break;
    case "RELOAD_ADAPTER":
      detectAndCreateAdapter();
      break;
  }
}

/**
 * Handle adapter commands from Service Worker
 */
async function handleAdapterCommand(message: AdapterMessage): Promise<void> {
  if (!currentAdapter || message.type !== "ADAPTER_COMMAND") return;

  try {
    switch (message.command) {
      case "play":
        await currentAdapter.play();
        break;
      case "pause":
        await currentAdapter.pause();
        break;
      case "seek":
        if (message.payload?.time !== undefined) {
          await currentAdapter.seek(message.payload.time);
        }
        break;
      case "setPlaybackRate":
        if (message.payload?.rate !== undefined) {
          await currentAdapter.setPlaybackRate(message.payload.rate);
        }
        break;
    }
  } catch (error) {
    console.error(`[ContentLoader] Command ${message.command} failed:`, error);
    sendAdapterError(error);
  }
}

/**
 * Handle state request from Service Worker
 */
async function handleStateRequest(message: AdapterMessage): Promise<void> {
  if (!currentAdapter || message.type !== "ADAPTER_STATE_REQUEST") return;

  try {
    const state = {
      currentTime: await currentAdapter.getCurrentTime(),
      duration: await currentAdapter.getDuration(),
      isPaused: await currentAdapter.isPaused(),
      playbackRate: 1, // Default, as not all adapters support this
    };

    const response: AdapterMessage = {
      type: "ADAPTER_STATE_RESPONSE",
      state,
      timestamp: Date.now(),
    };

    sendToServiceWorker(response);
  } catch (error) {
    console.error("[ContentLoader] Failed to get adapter state:", error);
    sendAdapterError(error);
  }
}

// Store debounce timeout
let observeTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * Observe page changes that might require adapter reload
 */
function observePageChanges(): void {
  // Observe DOM changes for dynamic video loading
  const observer = new MutationObserver(() => {
    // Debounce to avoid excessive checks
    clearTimeout(observeTimeout);
    observeTimeout = setTimeout(() => {
      // Check if we need to reload adapter (e.g., new video element appeared)
      if (!currentAdapter) {
        detectAndCreateAdapter();
      }
    }, 1000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Listen for history changes (single-page apps)
  window.addEventListener("popstate", () => {
    detectAndCreateAdapter();
  });

  // Override pushState and replaceState to detect programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    setTimeout(detectAndCreateAdapter, 100);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    setTimeout(detectAndCreateAdapter, 100);
  };
}

/**
 * Listen for commands from extension popup or Service Worker
 */
function listenForCommands(): void {
  // Listen for one-time messages
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.target === "content-adapter") {
      handleServiceWorkerMessage(message)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response
    }
  });
}

/**
 * Notify Service Worker that adapter is ready
 */
function notifyAdapterReady(): void {
  chrome.runtime
    .sendMessage({
      type: "ADAPTER_READY",
      url: window.location.href,
      timestamp: Date.now(),
    })
    .catch(() => {
      // Service Worker might not be ready yet
    });
}

/**
 * Notify Service Worker that no adapter is available
 */
function notifyNoAdapter(): void {
  chrome.runtime
    .sendMessage({
      type: "NO_ADAPTER",
      url: window.location.href,
      timestamp: Date.now(),
    })
    .catch(() => {
      // Service Worker might not be ready yet
    });
}

/**
 * Send adapter error to Service Worker
 */
function sendAdapterError(error: any): void {
  chrome.runtime
    .sendMessage({
      type: "ADAPTER_ERROR",
      error: error.message || String(error),
      url: window.location.href,
      timestamp: Date.now(),
    })
    .catch(() => {
      // Service Worker might not be ready yet
    });
}

/**
 * Notify Service Worker about adapter error during creation
 */
function notifyAdapterError(error: any): void {
  sendAdapterError(error);
}

// Initialize when content script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
