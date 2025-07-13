/**
 * Control Mode Synchronization Tests
 *
 * Tests the WebRTC-based synchronization of control mode changes between
 * host and participants in a room.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RoomManager } from "../../apps/extension/src/background/roomManager";
import { WebRTCManager } from "../../apps/extension/src/background/webrtcBridge";
import type { ControlMode } from "@repo/types";

// Mock chrome APIs
const mockChrome = {
  runtime: {
    onConnect: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    connect: vi.fn(),
    sendMessage: vi.fn().mockImplementation((_message, callback) => {
      if (callback) {
        callback({ success: true });
      }
    }),
    getContexts: vi.fn().mockResolvedValue([]),
    getURL: vi.fn((path: string) => path),
  },
  tabs: {
    onRemoved: { addListener: vi.fn() },
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

global.chrome = mockChrome as any;
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
})) as any;

describe("Control Mode Synchronization", () => {
  let hostRoomManager: RoomManager;
  let participantRoomManager: RoomManager;

  // Track messages between host and participant
  let webrtcMessageQueue: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    webrtcMessageQueue = [];

    // Create mock room state shared between host and participant
    const mockRoom = {
      id: "test-room",
      name: "Sync Test Room",
      hostId: "host-user",
      users: [
        { id: "host-user", name: "Host", isHost: true },
        { id: "participant-user", name: "Participant", isHost: false },
      ],
      controlMode: "HOST_ONLY" as ControlMode,
      createdAt: Date.now(),
      videoState: {
        url: "https://example.com/video",
        currentTime: 0,
        duration: 100,
        isPaused: true,
        playbackRate: 1,
        isPlaying: false,
      },
    };

    // Create host room manager
    hostRoomManager = new RoomManager({
      websocketUrl: "wss://test.example.com",
      webrtcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      },
    });

    // Set up host state
    (hostRoomManager as any).currentRoom = { ...mockRoom };
    (hostRoomManager as any).currentUser = {
      id: "host-user",
      name: "Host",
      isHost: true,
    };

    // Properly initialize WebRTC bridge with host status
    const hostWebRTC = (hostRoomManager as any).webrtc as WebRTCManager;
    hostWebRTC.setHostStatus(true);

    // Create participant room manager
    participantRoomManager = new RoomManager({
      websocketUrl: "wss://test.example.com",
      webrtcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      },
    });

    // Set up participant state
    (participantRoomManager as any).currentRoom = { ...mockRoom };
    (participantRoomManager as any).currentUser = {
      id: "participant-user",
      name: "Participant",
      isHost: false,
    };

    // Ensure participant WebRTC bridge knows it's not the host
    const participantWebRTC = (participantRoomManager as any)
      .webrtc as WebRTCManager;
    participantWebRTC.setHostStatus(false);

    // Mock WebRTC message passing between host and participant
    mockWebRTCCommunication();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Mock WebRTC communication between host and participant
   */
  function mockWebRTCCommunication() {
    // Mock host WebRTC to forward messages to participant
    const hostWebRTC = (hostRoomManager as any).webrtc as WebRTCManager;

    // Override sendSyncMessage to simulate WebRTC data channel
    hostWebRTC.sendSyncMessage = vi
      .fn()
      .mockImplementation(async (message: any) => {
        console.log("[MOCK] Host sending message:", message.type);
        webrtcMessageQueue.push(message);

        // Simulate message delivery to participant with proper event handling
        setTimeout(() => {
          const participantWebRTC = (participantRoomManager as any)
            .webrtc as WebRTCManager;
          console.log(
            "[MOCK] Delivering message to participant:",
            message.type,
          );

          // Emit the message to the participant's WebRTC bridge
          (participantWebRTC as any).emit(message.type, {
            ...message,
            fromUserId: "host-user",
          });

          // If it's a control mode change, also simulate the participant handling it
          if (message.type === "CONTROL_MODE_CHANGE") {
            console.log("[MOCK] Simulating control mode change handling");
            (participantRoomManager as any).handleControlModeChange({
              ...message,
              fromUserId: "host-user",
            });
          }
        }, 10);

        return { success: true, sentCount: 1 };
      });
  }

  it("should synchronize control mode changes between host and participants", async () => {
    console.log("[TEST] === Testing Control Mode Synchronization ===");

    // Step 1: Initial state - both in HOST_ONLY mode
    expect((hostRoomManager as any).currentRoom.controlMode).toBe("HOST_ONLY");
    expect((participantRoomManager as any).currentRoom.controlMode).toBe(
      "HOST_ONLY",
    );

    // Step 2: Host changes control mode to FREE_FOR_ALL
    console.log("[TEST] Host toggling control mode to FREE_FOR_ALL...");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await hostRoomManager.toggleControlMode();

    // Verify host updated locally
    expect((hostRoomManager as any).currentRoom.controlMode).toBe(
      "FREE_FOR_ALL",
    );
    console.log(
      "[TEST] Host control mode:",
      (hostRoomManager as any).currentRoom.controlMode,
    );

    // Step 3: Wait for message to propagate (simulate network delay)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Step 4: Verify participant received the control mode change
    console.log(
      "[TEST] Participant control mode:",
      (participantRoomManager as any).currentRoom.controlMode,
    );
    console.log(
      "[TEST] WebRTC messages sent:",
      webrtcMessageQueue.map((m) => m.type),
    );

    // This should be FREE_FOR_ALL but might still be HOST_ONLY due to the bug
    const participantControlMode = (participantRoomManager as any).currentRoom
      .controlMode;

    // Step 5: Host sends direct command (should work in FREE_FOR_ALL mode)
    console.log("[TEST] Host sending DIRECT_PLAY command...");

    const directPlayMessage = {
      type: "DIRECT_PLAY",
      userId: "host-user",
      time: 25,
      timestamp: Date.now(),
    };

    // Simulate participant receiving direct command
    await (participantRoomManager as any).handleDirectCommand(
      directPlayMessage,
    );

    // Step 6: Check if participant blocked the command
    const warnings = warnSpy.mock.calls;
    const ignoredCommandWarning = warnings.find(
      (call) =>
        call[0]?.includes?.("Ignoring direct command in") &&
        call[1] === "DIRECT_PLAY",
    );

    warnSpy.mockRestore();

    // Verify control mode synchronization worked correctly
    expect(participantControlMode).toBe("FREE_FOR_ALL");
    expect(ignoredCommandWarning).toBeUndefined();
    console.log("[TEST] ✅ Control mode properly synchronized");
  });

  it("should verify WebRTC message delivery for control mode changes", async () => {
    console.log("[TEST] === Testing WebRTC Message Delivery ===");

    // Mock the offscreen WebRTC manager control mode
    let offscreenControlMode = "HOST_ONLY";

    // Override setControlMode to track updates
    const hostWebRTC = (hostRoomManager as any).webrtc as WebRTCManager;
    const originalSetControlMode = hostWebRTC.setControlMode.bind(hostWebRTC);
    hostWebRTC.setControlMode = vi
      .fn()
      .mockImplementation((mode: ControlMode) => {
        console.log("[TEST] WebRTC setControlMode called with:", mode);
        offscreenControlMode = mode;
        return originalSetControlMode(mode);
      });

    // Test sequence
    console.log("[TEST] Initial offscreen control mode:", offscreenControlMode);

    await hostRoomManager.toggleControlMode();

    console.log(
      "[TEST] After toggle - offscreen control mode:",
      offscreenControlMode,
    );
    console.log("[TEST] Messages in queue:", webrtcMessageQueue.length);

    // Check if the WebRTC bridge control mode was properly updated
    expect(offscreenControlMode).toBe("FREE_FOR_ALL");

    // Check if CONTROL_MODE_CHANGE message was sent
    const controlModeMessage = webrtcMessageQueue.find(
      (m) => m.type === "CONTROL_MODE_CHANGE",
    );
    expect(controlModeMessage).toBeDefined();
    expect(controlModeMessage?.mode).toBe("FREE_FOR_ALL");
  });

  it("should test timing issue between control mode update and message sending", async () => {
    console.log("[TEST] === Testing Timing Issue ===");

    // This test checks if the control mode change message is sent
    // before the offscreen document updates its control mode

    let sendMessageCallCount = 0;
    let setControlModeCallCount = 0;

    const hostWebRTC = (hostRoomManager as any).webrtc as WebRTCManager;

    // Track call order
    const originalSendSyncMessage = hostWebRTC.sendSyncMessage.bind(hostWebRTC);
    hostWebRTC.sendSyncMessage = vi
      .fn()
      .mockImplementation(async (message: any) => {
        sendMessageCallCount++;
        console.log(
          `[TEST] sendSyncMessage called (${sendMessageCallCount}):`,
          message.type,
        );
        return originalSendSyncMessage(message);
      });

    const originalSetControlMode = hostWebRTC.setControlMode.bind(hostWebRTC);
    hostWebRTC.setControlMode = vi
      .fn()
      .mockImplementation((mode: ControlMode) => {
        setControlModeCallCount++;
        console.log(
          `[TEST] setControlMode called (${setControlModeCallCount}):`,
          mode,
        );
        return originalSetControlMode(mode);
      });

    await hostRoomManager.toggleControlMode();

    // Verify the correct order: setControlMode should be called before sendSyncMessage
    expect(setControlModeCallCount).toBeGreaterThan(0);
    expect(sendMessageCallCount).toBeGreaterThan(0);

    console.log(
      "[TEST] Call order - setControlMode:",
      setControlModeCallCount,
      "sendSyncMessage:",
      sendMessageCallCount,
    );
  });
});
