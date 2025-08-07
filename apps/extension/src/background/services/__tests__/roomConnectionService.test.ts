/**
 * Tests for RoomConnectionService
 * Validates the refactored networking layer functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import { RoomConnectionService } from "../roomConnectionService";
import type { RoomStateManager } from "../../state/roomStateManager";
import type { RoomState, User, ConnectionStatus } from "@repo/types";

// Skip module mocking, we'll replace instances manually

// Mock chrome.runtime and chrome.offscreen
global.chrome = {
  runtime: {
    getContexts: vi.fn().mockResolvedValue([]),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
    },
  },
  offscreen: {
    createDocument: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
} as const;

// Mock fetch for TURN credentials
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({ iceServers: [] }),
}) as MockedFunction<typeof fetch>;

// Helper function to create mock RoomState
function createMockRoomState(
  roomId: string,
  roomName: string,
  users: User[],
): RoomState {
  return {
    id: roomId,
    name: roomName,
    users,
    hostId: users.find((u) => u.isHost)?.id || users[0]?.id || "host-123",
    createdAt: Date.now(),
    lastActivity: Date.now(),
    controlMode: "HOST_ONLY",
    followMode: "AUTO_FOLLOW",
    videoState: {
      url: "https://example.com/video",
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      lastUpdated: Date.now(),
    },
    hostVideoState: null,
    hostCurrentUrl: null,
  };
}

// Helper function to create mock User
function createMockUser(
  id: string,
  name: string,
  isHost: boolean = false,
): User {
  return {
    id,
    name,
    isHost,
    isConnected: true,
    joinedAt: Date.now(),
  };
}

describe("RoomConnectionService", () => {
  let service: RoomConnectionService;
  let mockStateManager: Partial<RoomStateManager>;
  let mockWebSocketManager: any;
  let mockWebRTCManager: any;

  beforeEach(() => {
    // Create mock state manager
    mockStateManager = {
      setRoom: vi.fn().mockResolvedValue(undefined),
      setUser: vi.fn().mockResolvedValue(undefined),
      setConnectionStatus: vi.fn().mockResolvedValue(undefined),
      resetState: vi.fn().mockResolvedValue(undefined),
      getCurrentRoom: vi.fn().mockReturnValue(null),
      getCurrentUser: vi.fn().mockReturnValue(null),
      initialize: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    };

    // Create service instance
    service = new RoomConnectionService({
      websocketConfig: {
        url: "ws://localhost:8787/ws",
        maxRetries: 3,
        baseRetryDelay: 1000,
        maxRetryDelay: 10000,
        heartbeatInterval: 30000,
      },
      webrtcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      },
      stateManager: mockStateManager as RoomStateManager,
    });

    // Create proper mock instances manually
    mockWebSocketManager = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      updateUrl: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    mockWebRTCManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      setIceServers: vi.fn(),
      setHostStatus: vi.fn(),
      closeAllConnections: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    // Replace the service instances with our mocks
    (
      service as unknown as { websocket: typeof mockWebSocketManager }
    ).websocket = mockWebSocketManager;
    (service as unknown as { webrtc: typeof mockWebRTCManager }).webrtc =
      mockWebRTCManager;
  });

  afterEach(() => {
    // Clear mocks after assertions are done
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize offscreen document proactively", async () => {
      await service.initialize();

      expect(chrome.runtime.getContexts).toHaveBeenCalledWith({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });
      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "WebRTC is not available in service workers",
      });
    });

    it("should not recreate offscreen document if it already exists", async () => {
      // Clear any previous mock calls and reset to fresh state
      vi.clearAllMocks();

      (
        chrome.runtime.getContexts as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }]);

      await service.initialize();

      expect(chrome.runtime.getContexts).toHaveBeenCalled();
      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });

    it("should set up WebSocket reconnection handler", async () => {
      await service.initialize();

      expect(mockWebSocketManager.on).toHaveBeenCalledWith(
        "CONNECTION_STATUS_CHANGE",
        expect.any(Function),
      );
    });
  });

  describe("connectToRoom", () => {
    // Remove the connectToRoom spy to test the actual implementation
    it("should create a room when asHost is true", async () => {
      const roomId = "room-123";
      const userName = "Test User";
      const roomName = "Test Room";

      // Mock WebSocket send and on methods to handle async message flow
      const eventHandlers = new Map<string, ((data: unknown) => void)[]>();

      mockWebSocketManager.on.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          if (!eventHandlers.has(eventType)) {
            eventHandlers.set(eventType, []);
          }
          eventHandlers.get(eventType)!.push(callback);
        },
      );

      mockWebSocketManager.off.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          const handlers = eventHandlers.get(eventType);
          if (handlers) {
            const index = handlers.indexOf(callback);
            if (index !== -1) {
              handlers.splice(index, 1);
            }
          }
        },
      );

      mockWebSocketManager.send.mockImplementation(
        async (message: {
          type: string;
          userId?: string;
          [key: string]: unknown;
        }) => {
          if (message.type === "CREATE_ROOM") {
            // Simulate ROOM_CREATED response after a short delay to allow listeners to be set up
            setTimeout(() => {
              const listeners = eventHandlers.get("ROOM_CREATED") || [];
              listeners.forEach((callback) => {
                // Use the userId from the message to ensure consistency
                const mockUser = createMockUser(message.userId, userName, true);
                const mockRoom = createMockRoomState(roomId, roomName, [
                  mockUser,
                ]);
                callback({
                  type: "ROOM_CREATED",
                  roomId,
                  roomState: mockRoom,
                });
              });
            }, 10);
          }
        },
      );

      const result = await service.connectToRoom(
        roomId,
        userName,
        true,
        roomName,
      );

      expect(result).toMatchObject({
        room: {
          id: roomId,
          name: roomName,
        },
        user: {
          name: userName,
          isHost: true,
        },
      });

      expect(mockWebSocketManager.connect).toHaveBeenCalled();
      expect(mockWebRTCManager.initialize).toHaveBeenCalled();
      expect(mockWebRTCManager.setHostStatus).toHaveBeenCalledWith(true);
      expect(mockStateManager.setRoom).toHaveBeenCalledWith(expect.any(Object));
      expect(mockStateManager.setUser).toHaveBeenCalledWith(expect.any(Object));
      expect(mockStateManager.setConnectionStatus).toHaveBeenCalledWith(
        "CONNECTED",
      );
    });

    it("should join a room when asHost is false", async () => {
      const roomId = "room-456";
      const userName = "Participant";

      // Set up event handlers for this test
      const eventHandlers = new Map<string, ((data: unknown) => void)[]>();

      mockWebSocketManager.on.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          if (!eventHandlers.has(eventType)) {
            eventHandlers.set(eventType, []);
          }
          eventHandlers.get(eventType)!.push(callback);
        },
      );

      mockWebSocketManager.off.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          const handlers = eventHandlers.get(eventType);
          if (handlers) {
            const index = handlers.indexOf(callback);
            if (index !== -1) {
              handlers.splice(index, 1);
            }
          }
        },
      );

      // Mock WebSocket responses
      mockWebSocketManager.send.mockImplementation(
        async (message: {
          type: string;
          userId?: string;
          [key: string]: unknown;
        }) => {
          if (message.type === "JOIN_ROOM") {
            // Simulate ROOM_JOINED response after a short delay to allow listeners to be set up
            setTimeout(() => {
              const listeners = eventHandlers.get("ROOM_JOINED") || [];
              listeners.forEach((callback) => {
                const hostUser = createMockUser("host-123", "Host", true);
                // Use the userId from the message to ensure consistency
                const participantUser = createMockUser(
                  message.userId,
                  userName,
                  false,
                );
                const mockRoom = createMockRoomState(roomId, "Existing Room", [
                  hostUser,
                  participantUser,
                ]);
                callback({
                  type: "ROOM_JOINED",
                  roomId,
                  roomState: mockRoom,
                });
              });
            }, 10);
          }
        },
      );

      const result = await service.connectToRoom(roomId, userName, false);

      expect(result).toMatchObject({
        room: {
          id: roomId,
        },
        user: {
          name: userName,
          isHost: false,
        },
      });

      expect(mockWebRTCManager.setHostStatus).not.toHaveBeenCalledWith(true);
    });

    it("should handle connection failures gracefully", async () => {
      // Mock WebSocket to fail connection
      mockWebSocketManager.connect.mockResolvedValue(undefined);
      mockWebSocketManager.isConnected.mockReturnValue(false);

      // Clear any existing mock implementations from previous tests
      mockWebSocketManager.send.mockClear();

      await expect(
        service.connectToRoom("room-789", "User", false),
      ).rejects.toThrow("Failed to establish WebSocket connection");

      expect(mockWebSocketManager.disconnect).toHaveBeenCalled();
      expect(mockWebRTCManager.closeAllConnections).toHaveBeenCalled();
      // cleanup() method doesn't call resetState - only disconnectFromRoom does
    });
  });

  describe("auto-rejoin", () => {
    it("should auto-rejoin after reconnection", async () => {
      // Initialize the service first to set up event handlers
      await service.initialize();

      // Setup initial room state
      const mockRoom = createMockRoomState("room-123", "Test Room", []);
      const mockUser = createMockUser("user-123", "Test User", true);

      // Set up the service internal state to simulate being in a room
      (
        service as unknown as { currentRoomId: string; currentUserId: string }
      ).currentRoomId = "room-123";
      (
        service as unknown as { currentRoomId: string; currentUserId: string }
      ).currentUserId = "user-123";

      mockStateManager.getCurrentRoom = vi.fn().mockReturnValue(mockRoom);
      mockStateManager.getCurrentUser = vi.fn().mockReturnValue(mockUser);

      // Find the connection status handler that was registered during initialization
      const connectionStatusHandler = mockWebSocketManager.on.mock.calls.find(
        (call: any) => call[0] === "CONNECTION_STATUS_CHANGE",
      )?.[1];

      // First mark as disconnected
      await connectionStatusHandler?.({
        status: "DISCONNECTED" as ConnectionStatus,
      });

      // Set up event handlers for auto-rejoin test
      const eventHandlers = new Map<string, ((data: unknown) => void)[]>();

      mockWebSocketManager.on.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          if (!eventHandlers.has(eventType)) {
            eventHandlers.set(eventType, []);
          }
          eventHandlers.get(eventType)!.push(callback);
        },
      );

      mockWebSocketManager.off.mockImplementation(
        (eventType: string, callback: (data: unknown) => void) => {
          const handlers = eventHandlers.get(eventType);
          if (handlers) {
            const index = handlers.indexOf(callback);
            if (index !== -1) {
              handlers.splice(index, 1);
            }
          }
        },
      );

      // Mock the rejoin response
      mockWebSocketManager.send.mockImplementation(
        async (message: {
          type: string;
          userId?: string;
          [key: string]: unknown;
        }) => {
          if (message.type === "JOIN_ROOM") {
            setTimeout(() => {
              const listeners = eventHandlers.get("ROOM_JOINED") || [];
              listeners.forEach((callback) => {
                callback({
                  type: "ROOM_JOINED",
                  roomId: mockRoom.id,
                  roomState: {
                    ...mockRoom,
                    users: [mockUser],
                  },
                });
              });
            }, 10);
          }
        },
      );

      // Then simulate reconnection
      await connectionStatusHandler?.({
        status: "CONNECTED" as ConnectionStatus,
      });

      // Allow time for async operations and clear any pending timers
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify that auto-rejoin was attempted (methods should be called)
      expect(mockWebRTCManager.closeAllConnections).toHaveBeenCalled();
      expect(mockWebRTCManager.initialize).toHaveBeenCalled();
      expect(mockStateManager.setRoom).toHaveBeenCalled();
      expect(mockStateManager.setUser).toHaveBeenCalled();
      expect(mockStateManager.setConnectionStatus).toHaveBeenCalledWith(
        "CONNECTED",
      );
    }, 15000); // Increase timeout for this complex async test
  });

  describe("disconnectFromRoom", () => {
    it("should clean up resources when disconnecting", async () => {
      await service.disconnectFromRoom();

      expect(mockWebRTCManager.closeAllConnections).toHaveBeenCalled();
      expect(mockWebSocketManager.disconnect).toHaveBeenCalled();
      expect(mockStateManager.resetState).toHaveBeenCalled();
    });
  });
});
