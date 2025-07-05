import { vi } from "vitest";

export class MockRTCPeerConnection {
  private _connectionState: RTCPeerConnectionState = "new";
  private _iceConnectionState: RTCIceConnectionState = "new";

  public onconnectionstatechange: ((event: Event) => void) | null = null;
  public oniceconnectionstatechange: ((event: Event) => void) | null = null;
  public ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;

  createOffer = vi.fn().mockResolvedValue({
    type: "offer" as RTCSdpType,
    sdp: "mock-sdp",
  });

  createAnswer = vi.fn().mockResolvedValue({
    type: "answer" as RTCSdpType,
    sdp: "mock-sdp",
  });

  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  addIceCandidate = vi.fn().mockResolvedValue(undefined);

  createDataChannel = vi.fn().mockReturnValue({
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    readyState: "connecting" as RTCDataChannelState,
    label: "test-channel",
  });

  close = vi.fn();

  get connectionState(): RTCPeerConnectionState {
    return this._connectionState;
  }

  get iceConnectionState(): RTCIceConnectionState {
    return this._iceConnectionState;
  }

  // Helper methods for testing
  setConnectionState(state: RTCPeerConnectionState) {
    this._connectionState = state;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange(new Event("connectionstatechange"));
    }
  }

  setIceConnectionState(state: RTCIceConnectionState) {
    this._iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange(new Event("iceconnectionstatechange"));
    }
  }
}

export const setupWebRTCMocks = () => {
  Object.defineProperty(global, "RTCPeerConnection", {
    writable: true,
    value: MockRTCPeerConnection,
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
};
