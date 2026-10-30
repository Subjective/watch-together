/**
 * Consolidated test setup utilities
 * Provides easy setup and teardown for Chrome extension tests
 */
import { beforeEach, afterEach } from "vitest";
import {
  setupChromeGlobal,
  resetChromeMocks,
  type ChromeMock,
} from "./chrome-mocks";
import {
  setupNavigatorGlobal,
  resetNavigatorMocks,
  type NavigatorMock,
} from "./navigator-mocks";

/**
 * Complete test environment setup
 */
export const setupTestEnvironment = () => {
  let chromeMock: ChromeMock;
  let navigatorMock: NavigatorMock;

  beforeEach(() => {
    chromeMock = setupChromeGlobal();
    navigatorMock = setupNavigatorGlobal();
  });

  afterEach(() => {
    resetChromeMocks(chromeMock);
    resetNavigatorMocks(navigatorMock);
  });

  return {
    getChromeMock: () => chromeMock,
    getNavigatorMock: () => navigatorMock,
  };
};

/**
 * Helper to get current Chrome mock (for use in tests)
 */
export const getChromeForTest = (): ChromeMock => {
  return (globalThis as any).chrome;
};

/**
 * Helper to trigger Chrome storage changes in tests
 */
export const triggerStorageChange = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string = "local",
) => {
  const chrome = getChromeForTest();
  const storageOnChanged = chrome.storage.onChanged as any;
  if (storageOnChanged._trigger) {
    storageOnChanged._trigger(changes, areaName);
  }
};

/**
 * Helper to trigger Chrome runtime messages in tests
 */
export const triggerRuntimeMessage = (
  message: any,
  sender?: chrome.runtime.MessageSender,
  sendResponse?: (response?: any) => void,
) => {
  const chrome = getChromeForTest();
  const runtimeOnMessage = chrome.runtime.onMessage as any;
  if (runtimeOnMessage._trigger) {
    runtimeOnMessage._trigger(
      message,
      sender || { tab: { id: 1 } },
      sendResponse || (() => {}),
    );
  }
};

/**
 * Common test data factories
 */
export const createMockExtensionState = (overrides?: any) => ({
  isConnected: false,
  currentRoom: null,
  connectionStatus: "DISCONNECTED" as const,
  currentUser: null,
  followMode: "AUTO_FOLLOW" as const,
  hasFollowNotification: false,
  followNotificationUrl: null,
  ...overrides,
});

export const createMockUser = (overrides?: any) => ({
  id: "user-1",
  name: "Test User",
  isHost: false,
  isConnected: true,
  joinedAt: Date.now(),
  ...overrides,
});

export const createMockRoom = (overrides?: any) => ({
  id: "room-123",
  name: "Test Room",
  hostId: "host-1",
  users: [],
  controlMode: "FREE_FOR_ALL" as const,
  followMode: "AUTO_FOLLOW" as const,
  videoState: {
    currentTime: 0,
    duration: 100,
    isPlaying: false,
    playbackRate: 1,
    url: "https://example.com/video",
    lastUpdated: Date.now(),
  },
  hostVideoState: null,
  hostCurrentUrl: null,
  createdAt: Date.now(),
  lastActivity: Date.now(),
  ...overrides,
});

export const createMockRoomHistoryEntry = (overrides?: any) => ({
  id: "room-1",
  name: "Test Room",
  lastJoined: Date.now(),
  hostName: "Test Host",
  ...overrides,
});

export const createMockUserPreferences = (overrides?: any) => ({
  followMode: "AUTO_FOLLOW" as const,
  autoJoinRooms: true,
  notificationsEnabled: true,
  defaultUserName: "Guest",
  defaultRoomName: "My Room",
  backgroundSyncEnabled: true,
  defaultControlMode: "HOST_ONLY" as const,
  preferEnhancedUrl: true,
  ...overrides,
});
