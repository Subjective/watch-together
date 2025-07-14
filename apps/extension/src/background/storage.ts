/**
 * Chrome storage management for Watch Together extension
 * Handles persistent storage of user preferences and room state
 */

import type { ExtensionState, RoomState, FollowMode } from "@repo/types";

export interface StorageKeys {
  EXTENSION_STATE: "extensionState";
  USER_PREFERENCES: "userPreferences";
  ROOM_HISTORY: "roomHistory";
  WEBRTC_CONFIG: "webrtcConfig";
}

export interface UserPreferences {
  followMode: FollowMode;
  autoJoinRooms: boolean;
  notificationsEnabled: boolean;
  defaultUserName: string;
  defaultRoomName: string;
  backgroundSyncEnabled: boolean;
}

export interface RoomHistoryEntry {
  id: string;
  name: string;
  lastJoined: number;
  hostName: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
}

export class StorageManager {
  private static readonly STORAGE_KEYS: StorageKeys = {
    EXTENSION_STATE: "extensionState",
    USER_PREFERENCES: "userPreferences",
    ROOM_HISTORY: "roomHistory",
    WEBRTC_CONFIG: "webrtcConfig",
  };

  /**
   * Get extension state from storage
   */
  static async getExtensionState(): Promise<ExtensionState> {
    try {
      const result = await chrome.storage.local.get(
        this.STORAGE_KEYS.EXTENSION_STATE,
      );
      return (
        result[this.STORAGE_KEYS.EXTENSION_STATE] ||
        this.getDefaultExtensionState()
      );
    } catch (error) {
      console.error("Failed to get extension state from storage:", error);
      return this.getDefaultExtensionState();
    }
  }

  /**
   * Save extension state to storage
   */
  static async setExtensionState(state: ExtensionState): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.EXTENSION_STATE]: state,
      });
      console.log("Extension state saved to storage");
    } catch (error) {
      console.error("Failed to save extension state to storage:", error);
      throw error;
    }
  }

  /**
   * Get user preferences from storage
   */
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const result = await chrome.storage.local.get(
        this.STORAGE_KEYS.USER_PREFERENCES,
      );
      return (
        result[this.STORAGE_KEYS.USER_PREFERENCES] ||
        this.getDefaultUserPreferences()
      );
    } catch (error) {
      console.error("Failed to get user preferences from storage:", error);
      return this.getDefaultUserPreferences();
    }
  }

  /**
   * Save user preferences to storage
   */
  static async setUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.USER_PREFERENCES]: preferences,
      });
      console.log("User preferences saved to storage");
    } catch (error) {
      console.error("Failed to save user preferences to storage:", error);
      throw error;
    }
  }

  /**
   * Get room history from storage
   */
  static async getRoomHistory(): Promise<RoomHistoryEntry[]> {
    try {
      const result = await chrome.storage.local.get(
        this.STORAGE_KEYS.ROOM_HISTORY,
      );
      return result[this.STORAGE_KEYS.ROOM_HISTORY] || [];
    } catch (error) {
      console.error("Failed to get room history from storage:", error);
      return [];
    }
  }

  /**
   * Add room to history
   */
  static async addRoomToHistory(room: RoomState): Promise<void> {
    try {
      const history = await this.getRoomHistory();
      const hostUser = room.users.find((u) => u.id === room.hostId);

      const entry: RoomHistoryEntry = {
        id: room.id,
        name: room.name,
        lastJoined: Date.now(),
        hostName: hostUser?.name || "Unknown",
      };

      // Remove existing entry if present
      const filteredHistory = history.filter((h) => h.id !== room.id);

      // Add new entry at the beginning
      filteredHistory.unshift(entry);

      // Keep only last 10 entries
      const limitedHistory = filteredHistory.slice(0, 10);

      await chrome.storage.local.set({
        [this.STORAGE_KEYS.ROOM_HISTORY]: limitedHistory,
      });

      console.log("Room added to history:", room.id);
    } catch (error) {
      console.error("Failed to add room to history:", error);
      throw error;
    }
  }

  /**
   * Get WebRTC configuration from storage
   */
  static async getWebRTCConfig(): Promise<WebRTCConfig> {
    try {
      const result = await chrome.storage.local.get(
        this.STORAGE_KEYS.WEBRTC_CONFIG,
      );
      return (
        result[this.STORAGE_KEYS.WEBRTC_CONFIG] || this.getDefaultWebRTCConfig()
      );
    } catch (error) {
      console.error("Failed to get WebRTC config from storage:", error);
      return this.getDefaultWebRTCConfig();
    }
  }

  /**
   * Save WebRTC configuration to storage
   */
  static async setWebRTCConfig(config: WebRTCConfig): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.WEBRTC_CONFIG]: config,
      });
      console.log("WebRTC config saved to storage");
    } catch (error) {
      console.error("Failed to save WebRTC config to storage:", error);
      throw error;
    }
  }

  /**
   * Clear extension state to reset connection/room state
   */
  static async clearExtensionState(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEYS.EXTENSION_STATE);
      console.log("Extension state cleared");
    } catch (error) {
      console.error("Failed to clear extension state:", error);
      throw error;
    }
  }

  /**
   * Clear all storage data
   */
  static async clearAll(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      console.log("All storage data cleared");
    } catch (error) {
      console.error("Failed to clear storage:", error);
      throw error;
    }
  }

  /**
   * Get storage usage stats
   */
  static async getStorageUsage(): Promise<{ bytesInUse: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      return { bytesInUse };
    } catch (error) {
      console.error("Failed to get storage usage:", error);
      return { bytesInUse: 0 };
    }
  }

  /**
   * Update specific fields in extension state
   */
  static async updateExtensionState(
    updates: Partial<ExtensionState>,
  ): Promise<ExtensionState> {
    try {
      const currentState = await this.getExtensionState();
      const newState = { ...currentState, ...updates };
      await this.setExtensionState(newState);
      return newState;
    } catch (error) {
      console.error("Failed to update extension state:", error);
      throw error;
    }
  }

  /**
   * Update user preferences with partial updates
   */
  static async updateUserPreferences(
    updates: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences();
      const newPreferences = { ...currentPreferences, ...updates };
      await this.setUserPreferences(newPreferences);
      return newPreferences;
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      throw error;
    }
  }

  private static getDefaultExtensionState(): ExtensionState {
    return {
      isConnected: false,
      currentRoom: null,
      connectionStatus: "DISCONNECTED",
      currentUser: null,
      followMode: "AUTO_FOLLOW",
      hasFollowNotification: false,
      followNotificationUrl: null,
    };
  }

  private static getDefaultUserPreferences(): UserPreferences {
    return {
      followMode: "AUTO_FOLLOW",
      autoJoinRooms: false,
      notificationsEnabled: true,
      defaultUserName: "",
      defaultRoomName: "My Room",
      backgroundSyncEnabled: true,
    };
  }

  private static getDefaultWebRTCConfig(): WebRTCConfig {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    };
  }
}

/**
 * Storage event listener for syncing changes across extension components
 */
export class StorageEventManager {
  private static listeners: Map<string, ((changes: any) => void)[]> = new Map();

  /**
   * Initialize storage event listeners
   */
  static init(): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local") {
        for (const [key, change] of Object.entries(changes)) {
          const listeners = this.listeners.get(key);
          if (listeners) {
            listeners.forEach((callback) => callback(change));
          }
        }
      }
    });
  }

  /**
   * Listen for changes to a specific storage key
   */
  static onStorageChange(key: string, callback: (change: any) => void): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);
  }

  /**
   * Remove storage change listener
   */
  static offStorageChange(key: string, callback: (change: any) => void): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
}
