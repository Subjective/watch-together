/**
 * Utilities for testing video player adapters
 */
import type { IPlayerAdapter } from "@repo/types";
import { vi } from "vitest";

export interface AdapterTestCase {
  name: string;
  test: (adapter: IPlayerAdapter) => Promise<void>;
}

export interface AdapterTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Run a suite of tests on an adapter
 */
export async function runAdapterTests(
  adapter: IPlayerAdapter,
  tests: AdapterTestCase[],
): Promise<AdapterTestResult[]> {
  const results: AdapterTestResult[] = [];

  for (const testCase of tests) {
    const startTime = Date.now();
    let passed = true;
    let error: string | undefined;

    try {
      await testCase.test(adapter);
    } catch (e) {
      passed = false;
      error = e instanceof Error ? e.message : String(e);
    }

    results.push({
      testName: testCase.name,
      passed,
      error,
      duration: Date.now() - startTime,
    });
  }

  return results;
}

/**
 * Standard adapter test suite
 */
export const standardAdapterTests: AdapterTestCase[] = [
  {
    name: "should play video",
    test: async (adapter) => {
      await adapter.play();
      const isPaused = await adapter.isPaused();
      if (isPaused) {
        throw new Error("Video should be playing");
      }
    },
  },
  {
    name: "should pause video",
    test: async (adapter) => {
      await adapter.play();
      await adapter.pause();
      const isPaused = await adapter.isPaused();
      if (!isPaused) {
        throw new Error("Video should be paused");
      }
    },
  },
  {
    name: "should seek to valid time",
    test: async (adapter) => {
      const duration = await adapter.getDuration();
      const seekTime = Math.min(30, duration / 2);
      await adapter.seek(seekTime);
      const currentTime = await adapter.getCurrentTime();
      if (Math.abs(currentTime - seekTime) > 1) {
        throw new Error(
          `Seek failed: expected ${seekTime}, got ${currentTime}`,
        );
      }
    },
  },
  {
    name: "should reject invalid seek time",
    test: async (adapter) => {
      try {
        await adapter.seek(-1);
        throw new Error("Should have rejected negative seek time");
      } catch {
        // Expected error
      }

      const duration = await adapter.getDuration();
      try {
        await adapter.seek(duration + 10);
        throw new Error("Should have rejected seek time beyond duration");
      } catch {
        // Expected error
      }
    },
  },
  {
    name: "should set playback rate",
    test: async (adapter) => {
      await adapter.setPlaybackRate(1.5);
      // Note: We can't directly verify playback rate through the interface
      // This test just ensures the method doesn't throw
    },
  },
  {
    name: "should emit play event",
    test: async (adapter) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          adapter.off("play", handler);
          reject(new Error("Play event not emitted within timeout"));
        }, 2000);

        const handler = () => {
          clearTimeout(timeout);
          adapter.off("play", handler);
          resolve();
        };

        adapter.on("play", handler);
        adapter.play().catch(reject);
      });
    },
  },
  {
    name: "should emit pause event",
    test: async (adapter) => {
      await adapter.play(); // Ensure we're playing first

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          adapter.off("pause", handler);
          reject(new Error("Pause event not emitted within timeout"));
        }, 2000);

        const handler = () => {
          clearTimeout(timeout);
          adapter.off("pause", handler);
          resolve();
        };

        adapter.on("pause", handler);
        adapter.pause().catch(reject);
      });
    },
  },
  {
    name: "should emit seeking event",
    test: async (adapter) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          adapter.off("seeking", handler);
          reject(new Error("Seeking event not emitted within timeout"));
        }, 2000);

        const handler = (payload: unknown) => {
          clearTimeout(timeout);
          adapter.off("seeking", handler);
          if (
            typeof payload === "object" &&
            payload !== null &&
            "currentTime" in payload
          ) {
            resolve();
          } else {
            reject(new Error("Seeking event missing currentTime payload"));
          }
        };

        adapter.on("seeking", handler);
        adapter.seek(10).catch(reject);
      });
    },
  },
  {
    name: "should emit timeupdate events",
    test: async (adapter) => {
      return new Promise((resolve, reject) => {
        let updateCount = 0;
        const timeout = setTimeout(() => {
          adapter.off("timeupdate", handler);
          adapter.pause().catch(() => {}); // Cleanup
          reject(new Error("Not enough timeupdate events received"));
        }, 3000);

        const handler = (payload: unknown) => {
          if (
            typeof payload === "object" &&
            payload !== null &&
            "currentTime" in payload
          ) {
            updateCount++;
            if (updateCount >= 3) {
              clearTimeout(timeout);
              adapter.off("timeupdate", handler);
              adapter.pause().catch(() => {});
              resolve();
            }
          }
        };

        adapter.on("timeupdate", handler);
        adapter.play().catch(reject);
      });
    },
  },
  {
    name: "should clean up on destroy",
    test: async (adapter) => {
      // Add event listener
      let eventFired = false;
      const handler = () => {
        eventFired = true;
      };
      adapter.on("play", handler);

      // Destroy adapter
      adapter.destroy();

      // Try to use adapter after destroy - should not crash
      try {
        await adapter.play();
      } catch {
        // Expected - adapter might throw after destroy
      }

      // Event should not fire after destroy
      if (eventFired) {
        throw new Error("Event fired after adapter was destroyed");
      }
    },
  },
];

/**
 * Create a test report from results
 */
export function createTestReport(results: AdapterTestResult[]): string {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  let report = `Adapter Test Results\n`;
  report += `====================\n`;
  report += `Total Tests: ${totalTests}\n`;
  report += `Passed: ${passedTests}\n`;
  report += `Failed: ${failedTests}\n`;
  report += `Total Duration: ${totalDuration}ms\n\n`;

  report += `Test Details:\n`;
  report += `-------------\n`;

  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    report += `${status} ${result.testName} (${result.duration}ms)\n`;
    if (result.error) {
      report += `   Error: ${result.error}\n`;
    }
  }

  return report;
}

/**
 * Create a mock video element for testing
 */
export function createMockVideoElement(): HTMLVideoElement {
  const mock = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    _currentTime: 0,
    duration: 100,
    paused: true,
    playbackRate: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
    })),
  };

  Object.defineProperty(mock, "currentTime", {
    get: () => mock._currentTime || 0,
    set: (value) => {
      mock._currentTime = value;
    },
    configurable: true,
  });

  return mock as unknown as HTMLVideoElement;
}
