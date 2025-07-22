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

vi.mock("../../apps/extension/src/background/webrtcBridge", () => {
  const webrtcMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    closeAllConnections: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "test" }),
    createAnswer: vi.fn().mockResolvedValue({ type: "answer", sdp: "test" }),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    setIceServers: vi.fn(),
    restartAllConnections: vi.fn().mockResolvedValue(undefined),
    restartPeerConnection: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    WebRTCManager: vi.fn().mockImplementation(() => webrtcMock),
  };
});

import { RoomManager } from "../../apps/extension/src/background/roomManager";

// Mock global fetch for TURN server requests
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({
    iceServers: [
      {
        urls: "turn:test-turn-server.com",
        username: "test",
        credential: "test",
      },
    ],
  }),
});

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
  let webrtcMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked WebSocket instance
    const { WebSocketManager } = await vi.importMock(
      "../../apps/extension/src/background/websocket",
    );
    wsMock = new (WebSocketManager as any)();

    // Get the mocked WebRTC instance
    const { WebRTCManager } = await vi.importMock(
      "../../apps/extension/src/background/webrtcBridge",
    );
    webrtcMock = new (WebRTCManager as any)();

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
        {
          id: "user-2",
          name: "Participant",
          isHost: false,
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

    // Mock the webrtc instance on the room manager
    (roomManager as any).webrtc = webrtcMock;
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

  describe("WebRTC Recovery", () => {
    it("fetches fresh TURN credentials during reconnection", async () => {
      // Simulate connection status change from DISCONNECTED to CONNECTED
      wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify that fetch was called to get fresh TURN credentials
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/turn-credentials"),
      );

      // Verify that setIceServers was called with fresh credentials
      expect(webrtcMock.setIceServers).toHaveBeenCalledWith([
        { urls: "stun:stun.l.google.com:19302" }, // default STUN servers
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:test-turn-server.com",
          username: "test",
          credential: "test",
        },
      ]);
    });

    it("closes and reinitializes WebRTC connections during recovery", async () => {
      // Simulate connection status change from DISCONNECTED to CONNECTED
      wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify WebRTC recovery sequence
      expect(webrtcMock.closeAllConnections).toHaveBeenCalledTimes(1);
      expect(webrtcMock.setIceServers).toHaveBeenCalledTimes(1);
      expect(webrtcMock.initialize).toHaveBeenCalledWith("user-1", true);
    });

    it("handles failed peer connections proactively", async () => {
      // Set up room manager in connected state
      (roomManager as any).extensionState.isConnected = true;
      (roomManager as any).extensionState.connectionStatus = "CONNECTED";

      // Mock WebSocket as connected
      wsMock.isConnected.mockReturnValue(true);

      // Simulate failed WebRTC peer connection
      const connectionStateData = {
        userId: "user-2",
        state: "failed" as RTCPeerConnectionState,
      };

      // Get the registered event handler for PEER_CONNECTION_STATE_CHANGE
      const onCall = webrtcMock.on.mock.calls.find(
        (call: any) => call[0] === "PEER_CONNECTION_STATE_CHANGE",
      );
      expect(onCall).toBeDefined();
      const stateChangeHandler = onCall[1];

      // Trigger the connection state change
      await stateChangeHandler(connectionStateData);

      // Allow async recovery to complete - need more time for exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify that peer connection restart was attempted
      expect(webrtcMock.restartPeerConnection).toHaveBeenCalledWith("user-2");
    });

    it("retries WebRTC recovery with exponential backoff on failure", async () => {
      // Mock WebSocket send to fail first time, succeed on retry
      let callCount = 0;
      wsMock.send.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("First attempt failed"));
        }
        return Promise.resolve();
      });

      // Simulate connection status change
      wsMock.trigger("CONNECTION_STATUS_CHANGE", { status: "CONNECTED" });

      // Allow first attempt to fail
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the initial call count (should be 1 for the failed attempt)
      const initialCallCount = wsMock.send.mock.calls.length;
      expect(initialCallCount).toBe(1);

      // Wait for retry (should happen after ~2s delay)
      await new Promise((resolve) => setTimeout(resolve, 2200));

      // Verify retry was attempted (should be at least 1 more call than initial)
      expect(wsMock.send.mock.calls.length).toBeGreaterThan(initialCallCount);

      // Verify the retry call was a JOIN_ROOM message
      const lastCall =
        wsMock.send.mock.calls[wsMock.send.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({
        type: "JOIN_ROOM",
        roomId: "room-123",
        userId: "user-1",
        userName: "Host",
        timestamp: expect.any(Number),
      });
    });

    it("handles WebRTC connection restart events from offscreen document", async () => {
      // Set up room manager in connected state
      (roomManager as any).extensionState.isConnected = true;
      (roomManager as any).extensionState.connectionStatus = "CONNECTED";

      // Get the registered event handler for ALL_CONNECTIONS_RESTARTED
      const onCall = webrtcMock.on.mock.calls.find(
        (call: any) => call[0] === "ALL_CONNECTIONS_RESTARTED",
      );
      expect(onCall).toBeDefined();
      const restartHandler = onCall[1];

      // Simulate all connections restarted event
      await restartHandler({ restartedPeerIds: ["user-2"] });

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify that new offers were created for restarted peers (host behavior)
      expect(webrtcMock.createOffer).toHaveBeenCalledWith("user-2");
      expect(wsMock.send).toHaveBeenCalledWith({
        type: "WEBRTC_OFFER",
        roomId: "room-123",
        userId: "user-1",
        targetUserId: "user-2",
        offer: { type: "offer", sdp: "test" },
        timestamp: expect.any(Number),
      });
    });

    it("resets recovery retry state on successful data channel connection", async () => {
      // Set up some recovery retry state
      (roomManager as any).peerRecoveryRetries.set("user-2", 1);

      // Get the registered event handler for DATA_CHANNEL_OPEN
      const onCall = webrtcMock.on.mock.calls.find(
        (call: any) => call[0] === "DATA_CHANNEL_OPEN",
      );
      expect(onCall).toBeDefined();
      const dataChannelHandler = onCall[1];

      // Simulate data channel open
      await dataChannelHandler({ userId: "user-2" });

      // Verify retry state was cleared
      expect((roomManager as any).peerRecoveryRetries.has("user-2")).toBe(
        false,
      );
    });
  });
});
