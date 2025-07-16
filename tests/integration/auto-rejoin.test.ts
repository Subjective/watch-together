import { describe, it, expect, beforeEach, vi } from "vitest";

let wsMock: any;

vi.mock("../../apps/extension/src/background/websocket", () => {
  const listeners = new Map<string, ((data: any) => void)[]>();

  const mockWebSocket = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined),
    updateUrl: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    reset: vi.fn(),
    on: vi.fn((type: string, cb: (data: any) => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(cb);
    }),
    off: vi.fn((type: string, cb: (data: any) => void) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
    trigger: (type: string, data: any) => {
      const arr = listeners.get(type);
      if (arr) arr.forEach((cb) => cb(data));
    },
  };

  return {
    WebSocketManager: vi.fn().mockImplementation(() => mockWebSocket),
    defaultWebSocketConfig: { url: "wss://test.example.com" },
  };
});

vi.mock("../../apps/extension/src/background/storage", () => {
  const state = {
    isConnected: false,
    currentRoom: null,
    connectionStatus: "DISCONNECTED",
    currentUser: null,
    followMode: "AUTO_FOLLOW" as const,
    hasFollowNotification: false,
    followNotificationUrl: null,
  };
  return {
    StorageManager: {
      getExtensionState: vi.fn().mockResolvedValue(state),
      setExtensionState: vi.fn().mockResolvedValue(undefined),
      updateExtensionState: vi.fn(async (updates: any) => {
        Object.assign(state, updates);
        return state;
      }),
      updateUserPreferences: vi.fn(),
      addRoomToHistory: vi.fn(),
    },
  };
});

vi.mock("../../apps/extension/src/background/webrtc", () => {
  const webrtcMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    closeAllConnections: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "test" }),
    createAnswer: vi.fn().mockResolvedValue({ type: "answer", sdp: "test" }),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    WebRTCManager: vi.fn().mockImplementation(() => webrtcMock),
    defaultWebRTCConfig: { iceServers: [] },
  };
});

import { RoomManager } from "../../apps/extension/src/background/roomManager";

declare const chrome: any;
const mockChrome = {
  runtime: {
    onConnect: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    connect: vi.fn(),
    sendMessage: vi.fn().mockImplementation((_message: any, callback?: any) => {
      if (callback) callback({ success: true });
    }),
    getContexts: vi.fn().mockResolvedValue([]),
    getURL: vi.fn((path: string) => path),
  },
  tabs: {
    onRemoved: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    create: vi.fn(),
  },
  offscreen: {
    createDocument: vi.fn().mockResolvedValue(undefined),
    closeDocument: vi.fn().mockResolvedValue(undefined),
    hasDocument: vi.fn().mockResolvedValue(false),
    Reason: { USER_MEDIA: "USER_MEDIA" },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  windows: {
    update: vi.fn(),
  },
};
// @ts-expect-error - assign mock
global.chrome = mockChrome;

describe("Auto rejoin on WebSocket reconnection", () => {
  let roomManager: RoomManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked WebSocket instance
    const { WebSocketManager } = await vi.importMock(
      "../../apps/extension/src/background/websocket",
    );
    wsMock = new (WebSocketManager as any)();

    roomManager = new RoomManager({
      websocketUrl: "wss://test.example.com",
      webrtcConfig: { iceServers: [], iceCandidatePoolSize: 0 },
    });

    // Set up room and user state
    (roomManager as any).currentRoom = {
      id: "room-123",
      name: "Test Room",
      hostId: "user-1",
      users: [
        {
          id: "user-1",
          name: "Host",
          isHost: true,
          isConnected: true,
          joinedAt: Date.now(),
        },
      ],
      controlMode: "HOST_ONLY",
      createdAt: Date.now(),
    };
    (roomManager as any).currentUser = {
      id: "user-1",
      name: "Host",
      isHost: true,
    };
    (roomManager as any).extensionState = {
      isConnected: false,
      currentRoom: (roomManager as any).currentRoom,
      currentUser: (roomManager as any).currentUser,
      connectionStatus: "DISCONNECTED",
      followMode: "AUTO_FOLLOW",
      hasFollowNotification: false,
      followNotificationUrl: null,
    };
  });

  it("sends JOIN_ROOM after reconnection from DISCONNECTED state", async () => {
    // Simulate connection status change from DISCONNECTED to CONNECTED
    wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify that JOIN_ROOM was sent
    expect(wsMock.send).toHaveBeenCalledTimes(1);
    expect(wsMock.send.mock.calls[0][0]).toMatchObject({
      type: "JOIN_ROOM",
      roomId: "room-123",
      userId: "user-1",
      userName: "Host",
    });
  });

  it("does not auto-rejoin if already connected", async () => {
    // Set initial state as CONNECTED
    (roomManager as any).extensionState.connectionStatus = "CONNECTED";
    (roomManager as any).extensionState.isConnected = true;

    // Simulate connection status change from CONNECTED to CONNECTED (no change)
    wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should not send JOIN_ROOM since we were already connected
    expect(wsMock.send).not.toHaveBeenCalled();
  });

  it("does not auto-rejoin if no current room", async () => {
    // Remove current room
    (roomManager as any).currentRoom = null;

    wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should not send JOIN_ROOM since there's no room to rejoin
    expect(wsMock.send).not.toHaveBeenCalled();
  });

  it("does not auto-rejoin if no current user", async () => {
    // Remove current user
    (roomManager as any).currentUser = null;

    wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should not send JOIN_ROOM since there's no user to rejoin
    expect(wsMock.send).not.toHaveBeenCalled();
  });

  it("handles rejoin errors gracefully", async () => {
    // Mock WebSocket send to throw error
    wsMock.send.mockRejectedValueOnce(new Error("Connection failed"));

    // Spy on console.error to verify error is logged
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "[RoomManager] Failed to auto-rejoin room:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
