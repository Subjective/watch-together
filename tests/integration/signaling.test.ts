import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupWebRTCMocks,
  MockRTCPeerConnection,
} from "../../test-utils/webrtc-mock";

describe("WebRTC Signaling Integration", () => {
  beforeEach(() => {
    setupWebRTCMocks();
  });

  afterEach(() => {
    // Clean up any connections
  });

  it("should create peer connections", () => {
    const pc1 = new RTCPeerConnection();
    const pc2 = new RTCPeerConnection();

    expect(pc1).toBeInstanceOf(MockRTCPeerConnection);
    expect(pc2).toBeInstanceOf(MockRTCPeerConnection);
  });

  it("should handle offer/answer exchange", async () => {
    const pc1 = new RTCPeerConnection() as unknown as MockRTCPeerConnection;
    const pc2 = new RTCPeerConnection() as unknown as MockRTCPeerConnection;

    // Create offer
    const offer = await pc1.createOffer();
    expect(offer.type).toBe("offer");
    expect(offer.sdp).toBe("mock-sdp");

    // Set local description on pc1
    await pc1.setLocalDescription(offer);
    expect(pc1.setLocalDescription).toHaveBeenCalledWith(offer);

    // Set remote description on pc2
    await pc2.setRemoteDescription(offer);
    expect(pc2.setRemoteDescription).toHaveBeenCalledWith(offer);

    // Create answer
    const answer = await pc2.createAnswer();
    expect(answer.type).toBe("answer");

    // Complete the handshake
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    expect(pc1.setRemoteDescription).toHaveBeenCalledWith(answer);
  });

  it("should handle connection state changes", () => {
    const pc = new RTCPeerConnection() as unknown as MockRTCPeerConnection;

    let connectionState: RTCPeerConnectionState | null = null;
    pc.onconnectionstatechange = () => {
      connectionState = pc.connectionState;
    };

    // Simulate connection state change
    pc.setConnectionState("connected");
    expect(connectionState).toBe("connected");

    pc.setConnectionState("disconnected");
    expect(connectionState).toBe("disconnected");
  });

  it("should create data channels", () => {
    const pc = new RTCPeerConnection();

    const channel = pc.createDataChannel("test-channel");
    expect(channel).toBeDefined();
    expect(channel.label).toBe("test-channel");
    expect(typeof channel.send).toBe("function");
    expect(typeof channel.close).toBe("function");
  });
});
