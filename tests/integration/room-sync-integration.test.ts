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

    it("should send client request when client tries to control", async () => {
      // Switch to client perspective
      (roomManager as any).currentUser = {
        id: "client-user",
        name: "Client",
        isHost: false,
      };

      const adapterEvent: AdapterEventDetail = {
        tabId: 1,
        event: "pause",
        state: {
          currentTime: 150,
          duration: 600,
          isPaused: true,
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
              type: "CLIENT_REQUEST_PAUSE",
              userId: "client-user",
              time: 150,
              timestamp: expect.any(Number),
            }),
          }),
        }),
        expect.any(Function),
      );
    });

    it("should handle seeking events", async () => {
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
  });
});
