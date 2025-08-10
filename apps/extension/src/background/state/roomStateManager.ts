/**
 * Room State Manager - Single source of truth for extension state
 * Handles all state persistence, subscriptions, and state management logic
 * Part of Phase 1 refactoring to extract state management from monolithic RoomManager
 */

import type {
  RoomState,
  User,
  ExtensionState,
  ControlMode,
  FollowMode,
  VideoState,
  ConnectionStatus,
} from "@repo/types";

import { StorageManager } from "../storage";

/**
 * State change subscription callback type
 */
export type StateChangeCallback = (state: ExtensionState) => void;

/**
 * Debounced save configuration
 */
interface SaveConfig {
  debounceMs: number;
  maxWaitMs: number;
}

/**
 * RoomStateManager - Centralized state management for the extension
 *
 * Responsibilities:
 * - Maintain in-memory state for fast access
 * - Handle persistence to/from chrome.storage.local
 * - Provide subscription mechanism for state changes
 * - Validate state transitions
 * - Debounce storage writes to prevent excessive I/O
 */
export class RoomStateManager {
  private state: ExtensionState;
  private subscribers: Set<StateChangeCallback> = new Set();
  private saveTimeoutId: number | null = null;
  private lastSaveTime: number = 0;
  private pendingSave: boolean = false;

  private readonly saveConfig: SaveConfig = {
    debounceMs: 300, // Wait 300ms after last change before saving
    maxWaitMs: 2000, // Never wait more than 2s to save
  };

  constructor(initialState?: ExtensionState) {
    this.state = initialState || this.getDefaultState();
  }

  /**
   * Initialize state manager by loading from storage
   */
  async initialize(): Promise<void> {
    try {
      this.state = await StorageManager.getExtensionState();
      console.log("[RoomStateManager] Initialized with state from storage");
    } catch (error) {
      console.error(
        "[RoomStateManager] Failed to load state from storage:",
        error,
      );
      this.state = this.getDefaultState();
    }
  }

  // Getters - Public read-only access to state

  /**
   * Get complete extension state (immutable copy)
   */
  getState(): ExtensionState {
    return { ...this.state };
  }

  /**
   * Get current room state
   */
  getCurrentRoom(): RoomState | null {
    return this.state.currentRoom ? { ...this.state.currentRoom } : null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.state.currentUser ? { ...this.state.currentUser } : null;
  }

  /**
   * Check if user is host
   */
  isHost(): boolean {
    return this.state.currentUser?.isHost || false;
  }

  /**
   * Check if connected to room
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.state.connectionStatus;
  }

  /**
   * Get follow mode
   */
  getFollowMode(): FollowMode {
    return this.state.followMode;
  }

  /**
   * Check if has follow notification
   */
  hasFollowNotification(): boolean {
    return this.state.hasFollowNotification;
  }

  /**
   * Get follow notification URL
   */
  getFollowNotificationUrl(): string | null {
    return this.state.followNotificationUrl;
  }

  // Setters - State mutation methods

  /**
   * Set room state
   */
  async setRoom(room: RoomState | null): Promise<void> {
    await this.updateState({ currentRoom: room });
  }

  /**
   * Set current user
   */
  async setUser(user: User | null): Promise<void> {
    await this.updateState({ currentUser: user });
  }

  /**
   * Atomically set both room and user to prevent validation warnings
   * during state initialization. This prevents the race condition where
   * setRoom() is called before setUser(), causing temporary state inconsistency.
   */
  async setRoomAndUser(
    room: RoomState | null,
    user: User | null,
  ): Promise<void> {
    await this.updateState({
      currentRoom: room,
      currentUser: user,
    });
  }

  /**
   * Set connection status
   */
  async setConnectionStatus(status: ConnectionStatus): Promise<void> {
    const isConnected = status === "CONNECTED";
    await this.updateState({
      connectionStatus: status,
      isConnected,
    });
  }

  /**
   * Set follow mode
   */
  async setFollowMode(mode: FollowMode): Promise<void> {
    await this.updateState({ followMode: mode });
  }

  /**
   * Set follow notification state
   */
  async setFollowNotification(
    hasNotification: boolean,
    url: string | null = null,
  ): Promise<void> {
    await this.updateState({
      hasFollowNotification: hasNotification,
      followNotificationUrl: url,
    });
  }

  /**
   * Clear follow notification
   */
  async clearFollowNotification(): Promise<void> {
    await this.updateState({
      hasFollowNotification: false,
      followNotificationUrl: null,
    });
  }

  /**
   * Update room properties (for existing room)
   */
  async updateRoom(updates: Partial<RoomState>): Promise<void> {
    if (!this.state.currentRoom) {
      throw new Error("Cannot update room: no current room");
    }

    const updatedRoom = { ...this.state.currentRoom, ...updates };
    await this.updateState({ currentRoom: updatedRoom });
  }

  /**
   * Update user properties (for current user)
   */
  async updateUser(updates: Partial<User>): Promise<void> {
    if (!this.state.currentUser) {
      throw new Error("Cannot update user: no current user");
    }

    const updatedUser = { ...this.state.currentUser, ...updates };
    await this.updateState({ currentUser: updatedUser });
  }

  /**
   * Update video state in current room
   */
  async updateVideoState(videoState: VideoState): Promise<void> {
    if (!this.state.currentRoom) {
      throw new Error("Cannot update video state: no current room");
    }

    await this.updateRoom({ videoState });
  }

  /**
   * Update host video state in current room
   */
  async updateHostVideoState(hostVideoState: VideoState | null): Promise<void> {
    if (!this.state.currentRoom) {
      throw new Error("Cannot update host video state: no current room");
    }

    await this.updateRoom({ hostVideoState });
  }

  /**
   * Update control mode in current room
   */
  async updateControlMode(controlMode: ControlMode): Promise<void> {
    if (!this.state.currentRoom) {
      throw new Error("Cannot update control mode: no current room");
    }

    await this.updateRoom({ controlMode });
  }

  /**
   * Update room users list
   */
  async updateRoomUsers(users: User[]): Promise<void> {
    if (!this.state.currentRoom) {
      throw new Error("Cannot update room users: no current room");
    }

    await this.updateRoom({ users });
  }

  /**
   * Reset state to disconnected/clean state
   */
  async resetState(): Promise<void> {
    await this.updateState({
      isConnected: false,
      currentRoom: null,
      currentUser: null,
      connectionStatus: "DISCONNECTED",
      hasFollowNotification: false,
      followNotificationUrl: null,
    });
  }

  /**
   * Clear room state while preserving user preferences
   */
  async clearRoomState(): Promise<void> {
    await this.updateState({
      isConnected: false,
      currentRoom: null,
      currentUser: null,
      connectionStatus: "DISCONNECTED",
      hasFollowNotification: false,
      followNotificationUrl: null,
      // Preserve followMode - it's a user preference
    });
  }

  // Subscription management

  /**
   * Subscribe to state changes
   * @param callback Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: StateChangeCallback): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Remove all subscribers
   */
  clearSubscribers(): void {
    this.subscribers.clear();
  }

  // Private methods

  /**
   * Core state update method - handles validation, notification, and persistence
   */
  private async updateState(updates: Partial<ExtensionState>): Promise<void> {
    // Create new state with updates
    const newState = { ...this.state, ...updates };

    // Validate state consistency
    this.validateState(newState);

    // Update in-memory state
    this.state = newState;

    // Notify subscribers immediately
    this.notifySubscribers();

    // Schedule debounced save to storage
    await this.scheduleSave();
  }

  /**
   * Validate state consistency and relationships
   */
  private validateState(state: ExtensionState): void {
    // Connection status validation
    if (state.isConnected && state.connectionStatus === "DISCONNECTED") {
      throw new Error(
        "Invalid state: isConnected=true but connectionStatus=DISCONNECTED",
      );
    }

    if (!state.isConnected && state.connectionStatus === "CONNECTED") {
      throw new Error(
        "Invalid state: isConnected=false but connectionStatus=CONNECTED",
      );
    }

    // Room/user consistency validation (warning only for development)
    if (state.currentRoom && !state.currentUser) {
      console.warn(
        "[RoomStateManager] Warning: has currentRoom but no currentUser",
      );
    }

    if (state.currentUser && !state.currentRoom) {
      console.warn(
        "[RoomStateManager] Warning: has currentUser but no currentRoom",
      );
    }

    // User-room relationship validation
    if (state.currentRoom && state.currentUser) {
      const userInRoom = state.currentRoom.users.find(
        (u) => u.id === state.currentUser!.id,
      );
      if (!userInRoom) {
        throw new Error(
          "Invalid state: currentUser not found in currentRoom.users",
        );
      }

      // Sync user properties with room user data
      if (userInRoom.isHost !== state.currentUser.isHost) {
        console.warn(
          "[RoomStateManager] User host status inconsistency, syncing with room data",
        );
        state.currentUser.isHost = userInRoom.isHost;
      }
    }

    // Follow notification validation
    if (state.hasFollowNotification && !state.followNotificationUrl) {
      throw new Error(
        "Invalid state: hasFollowNotification=true but no followNotificationUrl",
      );
    }
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const immutableState = this.getState();

    // Use setTimeout to ensure notifications are asynchronous
    setTimeout(() => {
      this.subscribers.forEach((callback) => {
        try {
          callback(immutableState);
        } catch (error) {
          console.error("[RoomStateManager] Subscriber callback error:", error);
        }
      });
    }, 0);
  }

  /**
   * Schedule debounced save to storage
   */
  private async scheduleSave(): Promise<void> {
    this.pendingSave = true;

    // Clear existing timeout
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    const now = Date.now();
    const timeSinceLastSave = now - this.lastSaveTime;

    // If we've waited too long, save immediately
    if (timeSinceLastSave >= this.saveConfig.maxWaitMs) {
      await this.saveToStorage();
      return;
    }

    // Otherwise, schedule debounced save
    this.saveTimeoutId = setTimeout(async () => {
      await this.saveToStorage();
    }, this.saveConfig.debounceMs) as unknown as number;
  }

  /**
   * Save current state to chrome.storage.local
   */
  private async saveToStorage(): Promise<void> {
    if (!this.pendingSave) {
      return;
    }

    try {
      await StorageManager.setExtensionState(this.state);
      this.lastSaveTime = Date.now();
      this.pendingSave = false;
      this.saveTimeoutId = null;

      console.log("[RoomStateManager] State saved to storage");
    } catch (error) {
      console.error(
        "[RoomStateManager] Failed to save state to storage:",
        error,
      );

      // Retry save after a short delay
      setTimeout(() => {
        this.saveToStorage();
      }, 1000);
    }
  }

  /**
   * Get default extension state
   */
  private getDefaultState(): ExtensionState {
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

  /**
   * Force immediate save to storage (for cleanup/shutdown)
   */
  async forceSave(): Promise<void> {
    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    if (this.pendingSave) {
      await this.saveToStorage();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Force save any pending changes
    await this.forceSave();

    // Clear all subscribers
    this.clearSubscribers();

    console.log("[RoomStateManager] Cleaned up");
  }
}
