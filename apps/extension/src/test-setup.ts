import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Chrome Extension APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(),
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// @ts-expect-error - Chrome API mock
global.chrome = mockChrome;

// Mock WebRTC APIs - simplified approach
Object.defineProperty(global, "RTCPeerConnection", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp" }),
    createAnswer: vi
      .fn()
      .mockResolvedValue({ type: "answer", sdp: "mock-sdp" }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    createDataChannel: vi.fn().mockReturnValue({
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    }),
    close: vi.fn(),
    connectionState: "new" as RTCPeerConnectionState,
    iceConnectionState: "new" as RTCIceConnectionState,
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
    ondatachannel: null,
  })),
});

Object.defineProperty(global, "RTCSessionDescription", {
  writable: true,
  value: vi.fn().mockImplementation((init: RTCSessionDescriptionInit) => ({
    type: init.type,
    sdp: init.sdp,
  })),
});

Object.defineProperty(global, "RTCIceCandidate", {
  writable: true,
  value: vi.fn().mockImplementation((init: RTCIceCandidateInit) => ({
    candidate: init.candidate,
    sdpMLineIndex: init.sdpMLineIndex,
    sdpMid: init.sdpMid,
  })),
});
