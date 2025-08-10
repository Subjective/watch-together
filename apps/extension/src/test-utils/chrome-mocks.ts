/**
 * Proper Chrome API mocks for testing
 * Provides type-safe mocks that match the actual Chrome extension APIs
 */
import { vi } from "vitest";

/**
 * Create a mock Chrome Event object
 */
export const createChromeEventMock = <T extends (...args: any[]) => any>() => {
  const listeners = new Set<T>();

  return {
    addListener: vi.fn((listener: T) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: T) => {
      listeners.delete(listener);
    }),
    hasListener: vi.fn((listener: T) => listeners.has(listener)),
    hasListeners: vi.fn(() => listeners.size > 0),
    getRules: vi.fn(),
    removeRules: vi.fn(),
    addRules: vi.fn(),
    // Helper to trigger events in tests
    _trigger: (...args: Parameters<T>) => {
      listeners.forEach((listener) => listener(...args));
    },
  };
};

/**
 * Create a mock Chrome Storage Area
 */
export const createStorageAreaMock = () => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  getBytesInUse: vi.fn(),
  setAccessLevel: vi.fn(),
  onChanged: createChromeEventMock(),
  QUOTA_BYTES: 5242880,
});

/**
 * Create a mock Chrome Runtime
 */
export const createRuntimeMock = () => ({
  sendMessage: vi.fn(),
  onMessage:
    createChromeEventMock<
      (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void,
      ) => void
    >(),
  connect: vi.fn(),
  connectNative: vi.fn(),
  getBackgroundPage: vi.fn(),
  getContexts: vi.fn(),
  getManifest: vi.fn(),
  getPackageDirectoryEntry: vi.fn(),
  getPlatformInfo: vi.fn(),
  getURL: vi.fn(),
  id: "test-extension-id",
  lastError: undefined,
  onConnect: createChromeEventMock(),
  onConnectExternal: createChromeEventMock(),
  onConnectNative: createChromeEventMock(),
  onInstalled: createChromeEventMock(),
  onMessageExternal: createChromeEventMock(),
  onRestartRequired: createChromeEventMock(),
  onStartup: createChromeEventMock(),
  onSuspend: createChromeEventMock(),
  onSuspendCanceled: createChromeEventMock(),
  onUpdateAvailable: createChromeEventMock(),
  openOptionsPage: vi.fn(),
  reload: vi.fn(),
  requestUpdateCheck: vi.fn(),
  restart: vi.fn(),
  restartAfterDelay: vi.fn(),
  sendNativeMessage: vi.fn(),
  setUninstallURL: vi.fn(),
});

/**
 * Create a mock Chrome Storage
 */
export const createStorageMock = () => ({
  local: createStorageAreaMock(),
  sync: createStorageAreaMock(),
  managed: createStorageAreaMock(),
  session: createStorageAreaMock(),
  onChanged:
    createChromeEventMock<
      (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string,
      ) => void
    >(),
  AccessLevel: {
    TRUSTED_CONTEXTS: "TRUSTED_CONTEXTS",
    TRUSTED_AND_UNTRUSTED_CONTEXTS: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
  },
});

/**
 * Create a mock Chrome Action API
 */
export const createActionMock = () => ({
  setBadgeText: vi.fn().mockResolvedValue(undefined),
  setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  getBadgeText: vi.fn().mockResolvedValue(""),
  getBadgeBackgroundColor: vi.fn().mockResolvedValue([0, 0, 0, 0]),
  setTitle: vi.fn().mockResolvedValue(undefined),
  getTitle: vi.fn().mockResolvedValue("Watch Together"),
  setIcon: vi.fn().mockResolvedValue(undefined),
  setPopup: vi.fn().mockResolvedValue(undefined),
  getPopup: vi.fn().mockResolvedValue(""),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(true),
  onClicked: createChromeEventMock(),
});

/**
 * Create a complete Chrome API mock
 */
export const createChromeMock = () => ({
  runtime: createRuntimeMock(),
  storage: createStorageMock(),
  action: createActionMock(),
  // Add other Chrome APIs as needed
});

/**
 * Setup Chrome global for tests
 */
export const setupChromeGlobal = () => {
  const chromeMock = createChromeMock();

  // Type-safe global assignment
  (globalThis as any).chrome = chromeMock;

  return chromeMock;
};

/**
 * Reset all Chrome mocks
 */
export const resetChromeMocks = (
  chromeMock: ReturnType<typeof createChromeMock>,
) => {
  vi.clearAllMocks();

  // Reset any internal state if needed
  const storageOnChanged = chromeMock.storage.onChanged as any;
  if (storageOnChanged._trigger) {
    storageOnChanged._listeners?.clear();
  }

  const runtimeOnMessage = chromeMock.runtime.onMessage as any;
  if (runtimeOnMessage._trigger) {
    runtimeOnMessage._listeners?.clear();
  }

  const actionOnClicked = chromeMock.action.onClicked as any;
  if (actionOnClicked._trigger) {
    actionOnClicked._listeners?.clear();
  }
};

/**
 * Type-safe Chrome mock for testing
 */
export type ChromeMock = ReturnType<typeof createChromeMock>;
