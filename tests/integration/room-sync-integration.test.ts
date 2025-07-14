import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RoomManager } from "../../apps/extension/src/background/roomManager";
import type { AdapterEventDetail } from "../../apps/extension/src/background/adapterHandler";
import {
  adapterEventTarget,
  sendAdapterCommand,
} from "../../apps/extension/src/background/adapterHandler";
import type { ControlMode } from "@repo/types";

// Mock chrome APIs
const mockChrome = {
  runtime: {
    onConnect: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
    connect: vi.fn(),
    sendMessage: vi.fn().mockImplementation((_message, callback) => {
      // Mock successful response for offscreen document calls
      if (callback) {
        callback({ success: true });
      }
    }),
    getContexts: vi.fn().mockResolvedValue([]),
    getURL: vi.fn((path: string) => path),
  },
  tabs: {
    onRemoved: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    query: vi.fn().mockResolvedValue([{ id: 1 }]),
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
};

// @ts-expect-error - Mocking chrome global
global.chrome = mockChrome;

// Mock modules
vi.mock("../../apps/extension/src/background/adapterHandler", () => ({
  adapterEventTarget: new EventTarget(),
  sendAdapterCommand: vi.fn().mockResolvedValue(undefined),
  getActiveAdapters: vi.fn().mockReturnValue([
    {
      tabId: 1,
      connected: true,
      state: {
        currentTime: 0,
        duration: 600,
        isPaused: false,
        playbackRate: 1,
      },
      lastUpdate: Date.now(),
    },
  ]),
  initializeAdapterHandler: vi.fn(),
}));

vi.mock("../../apps/extension/src/background/websocket", () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  })),
  defaultWebSocketConfig: {
    url: "wss://test.example.com",
  },
}));

describe("Room Sync Integration", () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create room manager with mocked dependencies
    roomManager = new RoomManager({
      websocketUrl: "wss://test.example.com",
      webrtcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Host-Only Control Mode", () => {
    beforeEach(async () => {
      // Set up room as host
      (roomManager as any).currentRoom = {
        id: "room-123",
        name: "Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "HOST_ONLY" as ControlMode,
        createdAt: Date.now(),
      };
      (roomManager as any).currentUser = {
        id: "host-user",
        name: "Host",
        isHost: true,
      };

      // Initialize WebRTC bridge properly for host
      await (roomManager as any).webrtc.initialize("host-user", true);
    });

    it("should broadcast host state update when host plays video", async () => {
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "play",
        state: {
          currentTime: 100,
          duration: 600,
          isPaused: false,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      // Simulate adapter event
      const event = new CustomEvent("adapter:event", { detail: adapterEvent });
      adapterEventTarget.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify message was sent to offscreen document
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "WEBRTC_SEND_SYNC_MESSAGE",
          data: expect.objectContaining({
            message: expect.objectContaining({
              type: "HOST_STATE_UPDATE",
              userId: "host-user",
              state: "PLAYING",
              time: 100,
              timestamp: expect.any(Number),
            }),
          }),
        }),
        expect.any(Function),
      );
    });

    it("should handle seeking events from host", async () => {
      // Ensure user is set back to host
      (roomManager as any).currentUser = {
        id: "host-user",
        name: "Host",
        isHost: true,
      };

      // Re-initialize WebRTC bridge as host
      await (roomManager as any).webrtc.initialize("host-user", true);

      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "seeking",
        payload: { currentTime: 200 },
        state: {
          currentTime: 200,
          duration: 600,
          isPaused: false,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      // Simulate adapter event
      const event = new CustomEvent("adapter:event", { detail: adapterEvent });
      adapterEventTarget.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify message was sent to offscreen document
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "WEBRTC_SEND_SYNC_MESSAGE",
          data: expect.objectContaining({
            message: expect.objectContaining({
              type: "HOST_STATE_UPDATE",
              userId: "host-user",
              state: "PLAYING",
              time: 200,
              timestamp: expect.any(Number),
            }),
          }),
        }),
        expect.any(Function),
      );
    });

    it("should send heartbeat on timeupdate events", async () => {
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "timeupdate",
        payload: { currentTime: 105 },
        state: {
          currentTime: 105,
          duration: 600,
          isPaused: false,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      // Simulate adapter event
      const event = new CustomEvent("adapter:event", { detail: adapterEvent });
      adapterEventTarget.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify heartbeat message was sent
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "WEBRTC_SEND_SYNC_MESSAGE",
          data: expect.objectContaining({
            message: expect.objectContaining({
              type: "HOST_STATE_UPDATE",
              userId: "host-user",
              state: "PLAYING",
              time: 105,
              timestamp: expect.any(Number),
            }),
          }),
        }),
        expect.any(Function),
      );
    });
  });

  describe("Free-For-All Control Mode", () => {
    beforeEach(async () => {
      // Set up room with free-for-all mode
      (roomManager as any).currentRoom = {
        id: "room-123",
        name: "Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "FREE_FOR_ALL" as ControlMode,
        createdAt: Date.now(),
      };
      (roomManager as any).currentUser = {
        id: "client-user",
        name: "Client",
        isHost: false,
      };

      // Initialize WebRTC bridge for client in FREE_FOR_ALL mode
      await (roomManager as any).webrtc.initialize("client-user", false);
    });

    it("should broadcast direct commands in free-for-all mode", async () => {
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "play",
        state: {
          currentTime: 100,
          duration: 600,
          isPaused: false,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      // Simulate adapter event
      const event = new CustomEvent("adapter:event", { detail: adapterEvent });
      adapterEventTarget.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify direct command message was sent
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "WEBRTC_SEND_SYNC_MESSAGE",
          data: expect.objectContaining({
            message: expect.objectContaining({
              type: "DIRECT_PLAY",
              userId: "client-user",
              time: 100,
              timestamp: expect.any(Number),
            }),
          }),
        }),
        expect.any(Function),
      );
    });
  });

  describe("Receiving Sync Messages", () => {
    beforeEach(async () => {
      // Set up room as client
      (roomManager as any).currentRoom = {
        id: "room-123",
        name: "Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "HOST_ONLY" as ControlMode,
        createdAt: Date.now(),
      };
      (roomManager as any).currentUser = {
        id: "client-user",
        name: "Client",
        isHost: false,
      };
    });

    it("should apply host state updates with latency compensation", async () => {
      const timestamp = Date.now() - 100; // 100ms ago

      // Simulate receiving HOST_STATE_UPDATE
      await (roomManager as any).handleHostStateUpdate({
        type: "HOST_STATE_UPDATE",
        userId: "host-user",
        state: "PLAYING",
        time: 50,
        timestamp,
      });

      // Verify adapter commands were sent
      expect(sendAdapterCommand).toHaveBeenCalledWith(1, "play");

      // Verify seek was called with latency compensation
      expect(sendAdapterCommand).toHaveBeenCalledWith(1, "seek", {
        time: expect.closeTo(50.1, 0.5), // 50 + 0.1s latency compensation
      });
    });

    it("should handle client requests as host", async () => {
      // Switch to host perspective
      (roomManager as any).currentUser = {
        id: "host-user",
        name: "Host",
        isHost: true,
      };

      // Initialize WebRTC bridge as host
      await (roomManager as any).webrtc.initialize("host-user", true);

      // Simulate receiving CLIENT_REQUEST_SEEK
      await (roomManager as any).handleClientRequest({
        type: "CLIENT_REQUEST_SEEK",
        userId: "client-user",
        time: 300,
        timestamp: Date.now(),
      });

      // Verify adapter command was sent
      expect(sendAdapterCommand).toHaveBeenCalledWith(1, "seek", { time: 300 });
    });

    it("should apply direct commands in free-for-all mode", async () => {
      (roomManager as any).currentRoom.controlMode = "FREE_FOR_ALL";

      // Simulate receiving DIRECT_PAUSE
      await (roomManager as any).handleDirectCommand({
        type: "DIRECT_PAUSE",
        userId: "host-user",
        time: 200,
        timestamp: Date.now(),
      });

      // Verify adapter commands were sent
      expect(sendAdapterCommand).toHaveBeenCalledWith(1, "pause");
      expect(sendAdapterCommand).toHaveBeenCalledWith(1, "seek", { time: 200 });
    });

    it("should block direct commands in host-only mode", async () => {
      // Ensure room is in HOST_ONLY mode
      (roomManager as any).currentRoom.controlMode = "HOST_ONLY";

      // Mock console.warn to verify warning is logged
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Clear previous sendAdapterCommand calls
      vi.clearAllMocks();

      // Simulate receiving DIRECT_PLAY in HOST_ONLY mode (should be blocked)
      await (roomManager as any).handleDirectCommand({
        type: "DIRECT_PLAY",
        userId: "client-user",
        time: 100,
        timestamp: Date.now(),
      });

      // Verify no adapter commands were sent
      expect(sendAdapterCommand).not.toHaveBeenCalled();

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        "[RoomManager] Ignoring direct command in HOST_ONLY mode:",
        "DIRECT_PLAY",
      );

      warnSpy.mockRestore();
    });

    it("should block direct commands when room is null", async () => {
      // Set room to null
      (roomManager as any).currentRoom = null;

      // Mock console.warn to verify warning is logged
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Clear previous sendAdapterCommand calls
      vi.clearAllMocks();

      // Simulate receiving DIRECT_SEEK with no room (should be blocked)
      await (roomManager as any).handleDirectCommand({
        type: "DIRECT_SEEK",
        userId: "client-user",
        time: 150,
        timestamp: Date.now(),
      });

      // Verify no adapter commands were sent
      expect(sendAdapterCommand).not.toHaveBeenCalled();

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        "[RoomManager] Ignoring direct command in unknown mode:",
        "DIRECT_SEEK",
      );

      warnSpy.mockRestore();
    });
  });

  describe("Adapter Event Security", () => {
    beforeEach(() => {
      // Clear all mocks and ensure clean state
      vi.clearAllMocks();
    });

    it("should block adapter events from non-host participants in HOST_ONLY mode", async () => {
      // Set up room with HOST_ONLY mode and non-host user
      (roomManager as any).currentRoom = {
        id: "test-room",
        name: "Security Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "HOST_ONLY" as ControlMode,
        createdAt: Date.now(),
      };

      (roomManager as any).currentUser = {
        id: "client-user",
        name: "Client",
        isHost: false,
      };

      // Mock console.warn to verify warning is logged
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Clear previous mocks
      vi.clearAllMocks();

      // Simulate adapter event from non-host participant (e.g., user pressed spacebar)
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "play",
        state: {
          isPaused: false,
          currentTime: 50,
          duration: 300,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      await (roomManager as any).handleAdapterEvent(adapterEvent);

      // Verify no sync messages were sent (event was blocked)
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();

      // Verify warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        "[RoomManager] Ignoring video control event from non-host participant in HOST_ONLY mode:",
        "play",
      );

      warnSpy.mockRestore();
    });

    it("should allow adapter events from host in HOST_ONLY mode", async () => {
      // Set up room with HOST_ONLY mode and host user
      (roomManager as any).currentRoom = {
        id: "test-room",
        name: "Security Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "HOST_ONLY" as ControlMode,
        createdAt: Date.now(),
      };

      (roomManager as any).currentUser = {
        id: "host-user",
        name: "Host",
        isHost: true,
      };

      // Initialize WebRTC bridge properly for host
      await (roomManager as any).webrtc.initialize("host-user", true);

      // Clear previous mocks
      vi.clearAllMocks();

      // Simulate adapter event from host (should be allowed)
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "pause",
        state: {
          isPaused: true,
          currentTime: 75,
          duration: 300,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      await (roomManager as any).handleAdapterEvent(adapterEvent);

      // Verify sync message was sent (host event was processed)
      const calls = mockChrome.runtime.sendMessage.mock.calls;
      const hostStateCall = calls.find(
        (call) =>
          call[0]?.type === "WEBRTC_SEND_SYNC_MESSAGE" &&
          call[0]?.data?.message?.type === "HOST_STATE_UPDATE" &&
          call[0]?.data?.message?.userId === "host-user" &&
          call[0]?.data?.message?.state === "PAUSED",
      );

      expect(hostStateCall).toBeDefined();
    });

    it("should allow adapter events from all participants in FREE_FOR_ALL mode", async () => {
      // Set up room with FREE_FOR_ALL mode and non-host user
      (roomManager as any).currentRoom = {
        id: "test-room",
        name: "Security Test Room",
        hostId: "host-user",
        users: [
          { id: "host-user", name: "Host", isHost: true },
          { id: "client-user", name: "Client", isHost: false },
        ],
        controlMode: "FREE_FOR_ALL" as ControlMode,
        createdAt: Date.now(),
      };

      (roomManager as any).currentUser = {
        id: "client-user",
        name: "Client",
        isHost: false,
      };

      // Initialize WebRTC bridge for client in FREE_FOR_ALL mode
      await (roomManager as any).webrtc.initialize("client-user", false);

      // Clear previous mocks
      vi.clearAllMocks();

      // Simulate adapter event from non-host participant in FREE_FOR_ALL mode (should be allowed)
      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "seeking",
        state: {
          isPaused: false,
          currentTime: 120,
          duration: 300,
          playbackRate: 1,
        },
        timestamp: Date.now(),
      };

      // Simulate adapter event using event dispatcher
      const event = new CustomEvent("adapter:event", { detail: adapterEvent });
      adapterEventTarget.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify sync message was sent (direct command was processed)
      // Should find at least one DIRECT_SEEK message from client-user
      const calls = mockChrome.runtime.sendMessage.mock.calls;
      const directSeekCall = calls.find(
        (call) =>
          call[0]?.type === "WEBRTC_SEND_SYNC_MESSAGE" &&
          call[0]?.data?.message?.type === "DIRECT_SEEK" &&
          call[0]?.data?.message?.userId === "client-user",
      );

      expect(directSeekCall).toBeDefined();
    });
  });
});
