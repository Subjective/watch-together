import { describe, it, expect, beforeEach } from "vitest";
import { MockAdapter } from "../../test-utils/mock-adapter";

// Mock sync manager class for testing
class MockSyncManager {
  private adapter: MockAdapter;
  private peers: Map<string, (message: any) => void> = new Map();
  private role: "host" | "client";

  constructor(role: "host" | "client", adapter: MockAdapter) {
    this.role = role;
    this.adapter = adapter;
  }

  addPeer(peerId: string, messageHandler: (message: any) => void): void {
    this.peers.set(peerId, messageHandler);
  }

  async play(): Promise<void> {
    await this.adapter.play();
    if (this.role === "host") {
      this.broadcastToAllPeers({
        type: "HOST_STATE_UPDATE",
        state: "PLAYING",
        time: await this.adapter.getCurrentTime(),
        timestamp: Date.now(),
      });
    }
  }

  async pause(): Promise<void> {
    await this.adapter.pause();
    if (this.role === "host") {
      this.broadcastToAllPeers({
        type: "HOST_STATE_UPDATE",
        state: "PAUSED",
        time: await this.adapter.getCurrentTime(),
        timestamp: Date.now(),
      });
    }
  }

  async seek(time: number): Promise<void> {
    await this.adapter.seek(time);
    if (this.role === "host") {
      this.broadcastToAllPeers({
        type: "HOST_STATE_UPDATE",
        state: (await this.adapter.isPaused()) ? "PAUSED" : "PLAYING",
        time,
        timestamp: Date.now(),
      });
    }
  }

  receiveMessage(message: any): void {
    if (message.type === "HOST_STATE_UPDATE" && this.role === "client") {
      // Client receives host state update
      if (message.state === "PLAYING") {
        this.adapter.play();
      } else if (message.state === "PAUSED") {
        this.adapter.pause();
      }

      // Sync time with tolerance
      this.adapter.getCurrentTime().then((currentTime) => {
        const timeDiff = Math.abs(message.time - currentTime);
        if (timeDiff > 1) {
          // 1 second tolerance
          this.adapter.seek(message.time);
        }
      });
    }
  }

  private broadcastToAllPeers(message: any): void {
    this.peers.forEach((handler) => handler(message));
  }
}

describe("Video Sync Integration", () => {
  let hostAdapter: MockAdapter;
  let clientAdapter: MockAdapter;
  let hostSync: MockSyncManager;
  let clientSync: MockSyncManager;

  beforeEach(() => {
    hostAdapter = new MockAdapter();
    clientAdapter = new MockAdapter();

    hostSync = new MockSyncManager("host", hostAdapter);
    clientSync = new MockSyncManager("client", clientAdapter);

    // Connect sync managers
    hostSync.addPeer("client", clientSync.receiveMessage.bind(clientSync));
    clientSync.addPeer("host", hostSync.receiveMessage.bind(hostSync));
  });

  it("should sync play/pause between host and client", async () => {
    // Initial state - both paused
    expect(hostAdapter.isPlaying()).toBe(false);
    expect(clientAdapter.isPlaying()).toBe(false);

    // Host plays video
    await hostSync.play();

    // Wait for sync (simulate async message passing)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Both should be playing
    expect(hostAdapter.isPlaying()).toBe(true);
    expect(clientAdapter.isPlaying()).toBe(true);

    // Host pauses video
    await hostSync.pause();

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Both should be paused
    expect(hostAdapter.isPlaying()).toBe(false);
    expect(clientAdapter.isPlaying()).toBe(false);
  });

  it("should sync seek operations", async () => {
    // Set initial times
    hostAdapter.setCurrentTime(0);
    clientAdapter.setCurrentTime(0);

    // Host seeks to 60 seconds
    await hostSync.seek(60);

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Both should be at the same time
    const hostTime = await hostAdapter.getCurrentTime();
    const clientTime = await clientAdapter.getCurrentTime();

    expect(hostTime).toBe(60);
    expect(clientTime).toBe(60);
  });

  it("should maintain sync tolerance", async () => {
    // Set slightly different times (within tolerance)
    hostAdapter.setCurrentTime(100);
    clientAdapter.setCurrentTime(100.5);

    // Host seeks to 150 seconds
    await hostSync.seek(150);

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Client should sync to host time
    const clientTime = await clientAdapter.getCurrentTime();
    expect(clientTime).toBe(150);
  });

  it("should handle state consistency", async () => {
    // Start with host playing at specific time
    hostAdapter.setCurrentTime(30);
    await hostSync.play();
    await hostSync.seek(45);

    // Wait for all sync messages
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Verify client matches host state
    expect(clientAdapter.isPlaying()).toBe(true);
    expect(await clientAdapter.getCurrentTime()).toBe(45);
  });
});
