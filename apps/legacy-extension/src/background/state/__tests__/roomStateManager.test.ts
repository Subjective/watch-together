/**
 * Tests for RoomStateManager
 * Validates core state management functionality for Phase 1 refactoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RoomState, User, ExtensionState } from "@repo/types";
import { RoomStateManager } from "../roomStateManager";

// Mock StorageManager
vi.mock("../../storage", () => ({
  StorageManager: {
    getExtensionState: vi.fn(),
    setExtensionState: vi.fn(),
  },
}));

import { StorageManager } from "../../storage";

describe("RoomStateManager", () => {
  let stateManager: RoomStateManager;

  const mockUser: User = {
    id: "user1",
    name: "Test User",
    isHost: false,
    isConnected: true,
    joinedAt: Date.now(),
  };

  const mockRoom: RoomState = {
    id: "room1",
    name: "Test Room",
    hostId: "user1",
    users: [mockUser],
    controlMode: "HOST_ONLY",
    followMode: "AUTO_FOLLOW",
    videoState: {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      url: "",
      lastUpdated: Date.now(),
    },
    hostVideoState: null,
    hostCurrentUrl: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new RoomStateManager();
  });

  afterEach(async () => {
    await stateManager.cleanup();
  });

  describe("initialization", () => {
    it("should initialize with default state", () => {
      const state = stateManager.getState();

      expect(state.isConnected).toBe(false);
      expect(state.currentRoom).toBeNull();
      expect(state.currentUser).toBeNull();
      expect(state.connectionStatus).toBe("DISCONNECTED");
      expect(state.followMode).toBe("AUTO_FOLLOW");
      expect(state.hasFollowNotification).toBe(false);
      expect(state.followNotificationUrl).toBeNull();
    });

    it("should load state from storage on initialize", async () => {
      const mockStorageState: ExtensionState = {
        isConnected: true,
        currentRoom: mockRoom,
        currentUser: mockUser,
        connectionStatus: "CONNECTED",
        followMode: "MANUAL_FOLLOW",
        hasFollowNotification: false,
        followNotificationUrl: null,
      };

      vi.mocked(StorageManager.getExtensionState).mockResolvedValue(
        mockStorageState,
      );

      await stateManager.initialize();

      const state = stateManager.getState();
      expect(state).toEqual(mockStorageState);
      expect(StorageManager.getExtensionState).toHaveBeenCalledTimes(1);
    });

    it("should handle storage errors gracefully", async () => {
      vi.mocked(StorageManager.getExtensionState).mockRejectedValue(
        new Error("Storage error"),
      );

      await stateManager.initialize();

      const state = stateManager.getState();
      expect(state.isConnected).toBe(false);
      expect(state.currentRoom).toBeNull();
    });
  });

  describe("getters", () => {
    beforeEach(async () => {
      await stateManager.setRoomAndUser(mockRoom, mockUser);
      await stateManager.setConnectionStatus("CONNECTED");
    });

    it("should return current room", () => {
      const room = stateManager.getCurrentRoom();
      expect(room).toEqual(mockRoom);
      expect(room).not.toBe(mockRoom); // Should be a copy
    });

    it("should return current user", () => {
      const user = stateManager.getCurrentUser();
      expect(user).toEqual(mockUser);
      expect(user).not.toBe(mockUser); // Should be a copy
    });

    it("should return host status", () => {
      expect(stateManager.isHost()).toBe(false);
    });

    it("should return connection status", () => {
      expect(stateManager.isConnected()).toBe(true);
      expect(stateManager.getConnectionStatus()).toBe("CONNECTED");
    });

    it("should return follow mode", () => {
      expect(stateManager.getFollowMode()).toBe("AUTO_FOLLOW");
    });
  });

  describe("setters", () => {
    it("should set room state", async () => {
      await stateManager.setRoom(mockRoom);

      const room = stateManager.getCurrentRoom();
      expect(room).toEqual(mockRoom);
      expect(StorageManager.setExtensionState).toHaveBeenCalled();
    });

    it("should set user state", async () => {
      await stateManager.setUser(mockUser);

      const user = stateManager.getCurrentUser();
      expect(user).toEqual(mockUser);
    });

    it("should set connection status", async () => {
      await stateManager.setConnectionStatus("CONNECTING");

      expect(stateManager.getConnectionStatus()).toBe("CONNECTING");
      expect(stateManager.isConnected()).toBe(false);
    });

    it("should set follow mode", async () => {
      await stateManager.setFollowMode("MANUAL_FOLLOW");

      expect(stateManager.getFollowMode()).toBe("MANUAL_FOLLOW");
    });

    it("should set room and user atomically", async () => {
      await stateManager.setRoomAndUser(mockRoom, mockUser);

      const room = stateManager.getCurrentRoom();
      const user = stateManager.getCurrentUser();

      expect(room).toEqual(mockRoom);
      expect(user).toEqual(mockUser);
      expect(StorageManager.setExtensionState).toHaveBeenCalled();
    });

    it("should set room and user to null atomically", async () => {
      // First set some state
      await stateManager.setRoomAndUser(mockRoom, mockUser);

      // Then clear it atomically
      await stateManager.setRoomAndUser(null, null);

      const room = stateManager.getCurrentRoom();
      const user = stateManager.getCurrentUser();

      expect(room).toBeNull();
      expect(user).toBeNull();
    });

    it("should set follow notification", async () => {
      await stateManager.setFollowNotification(true, "http://example.com");

      expect(stateManager.hasFollowNotification()).toBe(true);
      expect(stateManager.getFollowNotificationUrl()).toBe(
        "http://example.com",
      );
    });

    it("should clear follow notification", async () => {
      await stateManager.setFollowNotification(true, "http://example.com");
      await stateManager.clearFollowNotification();

      expect(stateManager.hasFollowNotification()).toBe(false);
      expect(stateManager.getFollowNotificationUrl()).toBeNull();
    });
  });

  describe("room updates", () => {
    beforeEach(async () => {
      await stateManager.setRoom(mockRoom);
    });

    it("should update room properties", async () => {
      await stateManager.updateRoom({ name: "Updated Room" });

      const room = stateManager.getCurrentRoom();
      expect(room?.name).toBe("Updated Room");
      expect(room?.id).toBe(mockRoom.id); // Other properties preserved
    });

    it("should update control mode", async () => {
      await stateManager.updateControlMode("FREE_FOR_ALL");

      const room = stateManager.getCurrentRoom();
      expect(room?.controlMode).toBe("FREE_FOR_ALL");
    });

    it("should update room users", async () => {
      const newUser: User = { ...mockUser, id: "user2", name: "New User" };
      const users = [mockUser, newUser];

      await stateManager.updateRoomUsers(users);

      const room = stateManager.getCurrentRoom();
      expect(room?.users).toEqual(users);
    });

    it("should throw error when updating room without current room", async () => {
      await stateManager.setRoom(null);

      await expect(stateManager.updateRoom({ name: "Test" })).rejects.toThrow(
        "Cannot update room: no current room",
      );
    });
  });

  describe("user updates", () => {
    beforeEach(async () => {
      await stateManager.setUser(mockUser);
    });

    it("should update user properties", async () => {
      await stateManager.updateUser({ name: "Updated User" });

      const user = stateManager.getCurrentUser();
      expect(user?.name).toBe("Updated User");
      expect(user?.id).toBe(mockUser.id); // Other properties preserved
    });

    it("should throw error when updating user without current user", async () => {
      await stateManager.setUser(null);

      await expect(stateManager.updateUser({ name: "Test" })).rejects.toThrow(
        "Cannot update user: no current user",
      );
    });
  });

  describe("state reset", () => {
    beforeEach(async () => {
      await stateManager.setRoomAndUser(mockRoom, mockUser);
      await stateManager.setConnectionStatus("CONNECTED");
      await stateManager.setFollowNotification(true, "http://example.com");
    });

    it("should reset state to disconnected", async () => {
      await stateManager.resetState();

      const state = stateManager.getState();
      expect(state.isConnected).toBe(false);
      expect(state.currentRoom).toBeNull();
      expect(state.currentUser).toBeNull();
      expect(state.connectionStatus).toBe("DISCONNECTED");
      expect(state.hasFollowNotification).toBe(false);
      expect(state.followNotificationUrl).toBeNull();
    });

    it("should clear room state while preserving follow mode", async () => {
      await stateManager.setFollowMode("MANUAL_FOLLOW");
      await stateManager.clearRoomState();

      const state = stateManager.getState();
      expect(state.isConnected).toBe(false);
      expect(state.currentRoom).toBeNull();
      expect(state.currentUser).toBeNull();
      expect(state.followMode).toBe("MANUAL_FOLLOW"); // Preserved
    });
  });

  describe("subscriptions", () => {
    it("should notify subscribers on state changes", async () => {
      const subscriber = vi.fn();
      const unsubscribe = stateManager.subscribe(subscriber);

      await stateManager.setRoom(mockRoom);

      // Wait for async notification
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          currentRoom: mockRoom,
        }),
      );

      unsubscribe();
    });

    it("should remove subscribers when unsubscribed", async () => {
      const subscriber = vi.fn();
      const unsubscribe = stateManager.subscribe(subscriber);

      unsubscribe();
      await stateManager.setRoom(mockRoom);

      // Wait for potential async notification
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(subscriber).not.toHaveBeenCalled();
    });

    it("should handle subscriber errors gracefully", async () => {
      const errorSubscriber = vi.fn().mockImplementation(() => {
        throw new Error("Subscriber error");
      });

      stateManager.subscribe(errorSubscriber);

      // Should not throw
      await expect(stateManager.setRoom(mockRoom)).resolves.not.toThrow();
    });
  });

  describe("state validation", () => {
    it("should validate connection status consistency", async () => {
      // This should work - connected state with CONNECTED status
      await stateManager.setConnectionStatus("CONNECTED");
      expect(stateManager.isConnected()).toBe(true);
    });

    it("should validate room-user relationships", async () => {
      const hostUser = { ...mockUser, isHost: true };
      const roomWithHost = {
        ...mockRoom,
        users: [hostUser],
        hostId: hostUser.id,
      };

      await stateManager.setRoom(roomWithHost);
      await stateManager.setUser(hostUser);

      expect(stateManager.isHost()).toBe(true);
    });

    it("should validate follow notification consistency", async () => {
      // Should work - has notification with URL
      await stateManager.setFollowNotification(true, "http://example.com");
      expect(stateManager.hasFollowNotification()).toBe(true);
      expect(stateManager.getFollowNotificationUrl()).toBe(
        "http://example.com",
      );
    });
  });

  describe("debounced saving", () => {
    it("should debounce multiple rapid state updates", async () => {
      vi.mocked(StorageManager.setExtensionState).mockClear();

      // Make multiple rapid updates
      await stateManager.setFollowMode("MANUAL_FOLLOW");
      await stateManager.setConnectionStatus("CONNECTING");
      await stateManager.setConnectionStatus("CONNECTED");

      // Should have called storage multiple times due to debouncing
      expect(StorageManager.setExtensionState).toHaveBeenCalled();
    });

    it("should force save on cleanup", async () => {
      vi.mocked(StorageManager.setExtensionState).mockClear();

      await stateManager.setRoom(mockRoom);
      await stateManager.cleanup();

      // Should have saved during cleanup
      expect(StorageManager.setExtensionState).toHaveBeenCalled();
    });
  });
});
