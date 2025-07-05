# **Testing Strategy for Watch Together: Comprehensive Implementation Plan**

## **Executive Summary**

This document outlines a comprehensive testing strategy for the Watch Together project based on research of Turborepo, Vitest, and Cloudflare Workers testing best practices. The strategy implements a hybrid approach using Vitest for unit/integration tests and maintaining Playwright for E2E tests, optimized for TDD workflow and monorepo caching.

## **1. Architecture Overview**

### **Testing Framework Selection**

- **Primary**: Vitest (unit, integration, Workers tests)
- **Secondary**: Playwright (E2E tests, keep existing setup)
- **Rationale**: Vitest provides excellent Turborepo integration, fast execution, and native Workers support

### **Test Categories**

1. **Unit Tests**: Individual functions, components, adapters
2. **Integration Tests**: Cross-package communication, WebRTC, signaling
3. **E2E Tests**: Full user journeys (existing Playwright setup)

## **2. Directory Structure**

```
watch-together/
├── vitest.workspace.ts              # Root workspace config
├── packages/
│   ├── vitest-config/               # NEW: Shared test configurations
│   │   ├── src/
│   │   │   ├── base.ts              # Base Vitest config
│   │   │   ├── browser.ts           # Browser/DOM testing config
│   │   │   ├── workers.ts           # Cloudflare Workers config
│   │   │   └── index.ts             # Export all configs
│   │   └── package.json
│   ├── types/                       # Extend with test types
│   │   └── src/
│   │       └── testing.ts           # Test-specific types
│   ├── adapters/
│   │   ├── src/
│   │   └── __tests__/               # Unit tests
│   │       ├── GenericHTML5Adapter.test.ts
│   │       ├── YouTubeAdapter.test.ts
│   │       └── NetflixAdapter.test.ts
├── apps/
│   ├── extension/
│   │   ├── src/
│   │   │   ├── background/__tests__/
│   │   │   ├── content/__tests__/
│   │   │   └── popup/__tests__/
│   │   └── vitest.config.ts
│   └── backend/
│       ├── src/
│       │   └── __tests__/
│       └── vitest.config.ts
└── tests/
    ├── integration/                 # Cross-package integration
    │   ├── signaling.test.ts        # WebSocket/WebRTC flow
    │   ├── sync-logic.test.ts       # Video sync integration
    │   └── navigation.test.ts       # Host navigation flow
    ├── e2e/                        # Keep existing Playwright
    └── vitest.config.ts            # Integration test config
```

## **3. Configuration Strategy**

### **3.1 Root Workspace Configuration**

**File**: `vitest.workspace.ts`

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace(["packages/*", "apps/*", "tests"]);
```

### **3.2 Shared Configuration Package**

**Package**: `packages/vitest-config/`

**Base Config** (`src/base.ts`):

```typescript
import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
    },
  },
});
```

**Browser Config** (`src/browser.ts`):

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./base";

export const browserConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/browser-setup.ts"],
    },
  }),
);
```

**Workers Config** (`src/workers.ts`):

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { baseConfig } from "./base";

export const workersConfig = mergeConfig(
  baseConfig,
  defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            durableObjectsPersist: true,
            kvPersist: true,
          },
        },
      },
    },
  }),
);
```

### **3.3 Package-Specific Configurations**

**Backend** (`apps/backend/vitest.config.ts`):

```typescript
import { defineProject, mergeConfig } from "vitest/config";
import { workersConfig } from "@repo/vitest-config";

export default mergeConfig(
  workersConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.ts"],
      environment: "workers-cloudflare",
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
        },
      },
    },
  }),
);
```

**Extension** (`apps/extension/vitest.config.ts`):

```typescript
import { defineProject, mergeConfig } from "vitest/config";
import { browserConfig } from "@repo/vitest-config";

export default mergeConfig(
  browserConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.ts"],
      setupFiles: ["./src/test-setup.ts"],
      globals: {
        chrome: "chrome-extension-mock",
      },
    },
  }),
);
```

## **4. Turborepo Integration**

### **4.1 Updated turbo.json**

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
      "outputs": ["coverage/**"]
    },
    "test:unit": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "__tests__/**", "**/*.test.ts"],
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build", "test:unit"],
      "inputs": ["tests/integration/**", "src/**"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "inputs": ["tests/e2e/**", "dist/**"],
      "outputs": ["test-results/**", "playwright-report/**"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### **4.2 Root package.json Scripts**

```json
{
  "scripts": {
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e",
    "test:watch": "turbo run test:watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## **5. Cloudflare Workers Testing Strategy**

### **5.1 Dependencies**

```json
{
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "vitest": "^2.0.0",
    "miniflare": "^3.0.0"
  }
}
```

### **5.2 Durable Objects Testing**

```typescript
// apps/backend/src/__tests__/roomState.test.ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { RoomState } from "../roomState";

describe("RoomState Durable Object", () => {
  let roomId: DurableObjectId;
  let room: DurableObjectStub;

  beforeEach(async () => {
    roomId = env.ROOM_STATE.idFromName("test-room");
    room = env.ROOM_STATE.get(roomId);
  });

  it("should create room successfully", async () => {
    const response = await room.fetch("http://room/create", {
      method: "POST",
      body: JSON.stringify({ hostId: "user-1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.roomId).toBe("test-room");
  });

  it("should handle WebRTC signaling", async () => {
    // Test offer/answer/ICE candidate flow
    const offer = { type: "offer", sdp: "test-sdp" };

    const response = await room.fetch("http://room/signal", {
      method: "POST",
      body: JSON.stringify({
        type: "webrtc-offer",
        data: offer,
        fromUserId: "user-1",
        toUserId: "user-2",
      }),
    });

    expect(response.status).toBe(200);
  });
});
```

### **5.3 Worker Integration Testing**

```typescript
// apps/backend/src/__tests__/worker.test.ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Worker", () => {
  it("should handle WebSocket upgrade", async () => {
    const response = await SELF.fetch("http://worker/ws", {
      headers: { Upgrade: "websocket" },
    });

    expect(response.status).toBe(101);
    expect(response.headers.get("upgrade")).toBe("websocket");
  });

  it("should route to correct Durable Object", async () => {
    const roomId = "test-room-123";
    const response = await SELF.fetch(`http://worker/room/${roomId}`);

    expect(response.status).toBe(200);
  });
});
```

## **6. Chrome Extension Testing Strategy**

### **6.1 Service Worker Testing**

```typescript
// apps/extension/src/background/__tests__/main.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockChrome } from "../../../test-utils/chrome-mock";

// Mock Chrome APIs
global.chrome = MockChrome;

describe("Service Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle room creation", async () => {
    const { createRoom } = await import("../main");

    const roomData = await createRoom("user-1");

    expect(roomData).toMatchObject({
      roomId: expect.any(String),
      hostId: "user-1",
    });
  });

  it("should establish WebRTC connection", async () => {
    const { setupWebRTC } = await import("../main");

    const connection = await setupWebRTC("room-123", "user-1");

    expect(connection.connectionState).toBe("connecting");
  });
});
```

### **6.2 React Component Testing**

```typescript
// apps/extension/src/popup/__tests__/RoomManager.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoomManager } from '../RoomManager'

describe('RoomManager', () => {
  it('should display room information', () => {
    const roomData = {
      roomId: 'room-123',
      hostId: 'user-1',
      participants: ['user-1', 'user-2']
    }

    render(<RoomManager room={roomData} />)

    expect(screen.getByText('Room: room-123')).toBeInTheDocument()
    expect(screen.getByText('2 participants')).toBeInTheDocument()
  })

  it('should toggle control mode', async () => {
    const onControlModeChange = vi.fn()

    render(
      <RoomManager
        room={mockRoom}
        onControlModeChange={onControlModeChange}
      />
    )

    fireEvent.click(screen.getByText('Free-For-All Mode'))

    expect(onControlModeChange).toHaveBeenCalledWith('FREE_FOR_ALL')
  })
})
```

### **6.3 Adapter Testing**

```typescript
// packages/adapters/src/__tests__/YouTubeAdapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { YouTubeAdapter } from "../YouTubeAdapter";

// Mock YouTube Player API
global.YT = {
  Player: vi.fn().mockImplementation(() => ({
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(120),
    getPlayerState: vi.fn().mockReturnValue(1), // PLAYING
  })),
};

describe("YouTubeAdapter", () => {
  let adapter: YouTubeAdapter;

  beforeEach(() => {
    adapter = new YouTubeAdapter();
  });

  it("should initialize with YouTube player", async () => {
    await adapter.initialize();

    expect(global.YT.Player).toHaveBeenCalled();
  });

  it("should control playback", async () => {
    await adapter.initialize();

    await adapter.play();
    expect(adapter.player.playVideo).toHaveBeenCalled();

    await adapter.pause();
    expect(adapter.player.pauseVideo).toHaveBeenCalled();
  });

  it("should seek to specific time", async () => {
    await adapter.initialize();

    await adapter.seek(300);
    expect(adapter.player.seekTo).toHaveBeenCalledWith(300);
  });
});
```

## **7. Integration Testing Strategy**

### **7.1 WebRTC Signaling Integration**

```typescript
// tests/integration/signaling.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { setupTestWorker, teardownTestWorker } from "./test-utils";

describe("WebRTC Signaling Integration", () => {
  let workerUrl: string;
  let hostWs: WebSocket;
  let clientWs: WebSocket;

  beforeEach(async () => {
    workerUrl = await setupTestWorker();
  });

  afterEach(async () => {
    hostWs?.close();
    clientWs?.close();
    await teardownTestWorker();
  });

  it("should complete WebRTC handshake", async () => {
    // Create room as host
    hostWs = new WebSocket(`${workerUrl}/ws`);
    await waitForOpen(hostWs);

    hostWs.send(
      JSON.stringify({
        type: "create-room",
        userId: "host-1",
      }),
    );

    const roomCreated = await waitForMessage(hostWs);
    expect(roomCreated.type).toBe("room-created");

    // Join as client
    clientWs = new WebSocket(`${workerUrl}/ws`);
    await waitForOpen(clientWs);

    clientWs.send(
      JSON.stringify({
        type: "join-room",
        roomId: roomCreated.roomId,
        userId: "client-1",
      }),
    );

    // Verify WebRTC signaling flow
    const offer = await waitForMessage(clientWs);
    expect(offer.type).toBe("webrtc-offer");

    // Send answer
    clientWs.send(
      JSON.stringify({
        type: "webrtc-answer",
        data: { type: "answer", sdp: "test-answer-sdp" },
      }),
    );

    const answer = await waitForMessage(hostWs);
    expect(answer.type).toBe("webrtc-answer");
  });
});
```

### **7.2 Video Sync Integration**

```typescript
// tests/integration/sync-logic.test.ts
import { describe, it, expect } from "vitest";
import { SyncManager } from "@repo/sync-logic";
import { MockAdapter } from "./mocks/MockAdapter";

describe("Video Sync Integration", () => {
  it("should sync play/pause between host and client", async () => {
    const hostAdapter = new MockAdapter();
    const clientAdapter = new MockAdapter();

    const hostSync = new SyncManager("host", hostAdapter);
    const clientSync = new SyncManager("client", clientAdapter);

    // Connect sync managers
    hostSync.addPeer("client", clientSync.receiveMessage.bind(clientSync));
    clientSync.addPeer("host", hostSync.receiveMessage.bind(hostSync));

    // Host plays video
    await hostSync.play();

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hostAdapter.isPlaying()).toBe(true);
    expect(clientAdapter.isPlaying()).toBe(true);
    expect(
      Math.abs(hostAdapter.getCurrentTime() - clientAdapter.getCurrentTime()),
    ).toBeLessThan(1);
  });
});
```

## **8. Test Utilities and Mocks**

### **8.1 Chrome Extension Mocks**

```typescript
// apps/extension/test-utils/chrome-mock.ts
export const MockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(),
      clear: vi.fn().mockResolvedValue(),
    },
  },
  tabs: {
    query: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};
```

### **8.2 WebRTC Mocks**

```typescript
// test-utils/webrtc-mock.ts
export class MockRTCPeerConnection {
  private _connectionState = "new";

  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp" });
  createAnswer = vi.fn().mockResolvedValue({ type: "answer", sdp: "mock-sdp" });
  setLocalDescription = vi.fn().mockResolvedValue();
  setRemoteDescription = vi.fn().mockResolvedValue();
  addIceCandidate = vi.fn().mockResolvedValue();

  get connectionState() {
    return this._connectionState;
  }
}

global.RTCPeerConnection = MockRTCPeerConnection;
```

## **9. TDD Workflow Implementation**

### **9.1 Test-First Development Process**

1. **Red**: Write failing test
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve code while maintaining tests
4. **Commit**: Save working implementation

### **9.2 Watch Mode Setup**

```json
{
  "scripts": {
    "dev:test": "vitest --watch",
    "dev:test:ui": "vitest --ui --watch"
  }
}
```

### **9.3 Pre-commit Hooks**

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "turbo run test:unit lint typecheck"
    }
  }
}
```

## **10. Performance and Optimization**

### **10.1 Test Isolation**

- Each test runs in isolated environment
- Cleanup after each test
- No shared state between tests

### **10.2 Parallel Execution**

- Unit tests run in parallel by default
- Integration tests run sequentially when needed
- E2E tests run with controlled concurrency

### **10.3 Caching Strategy**

- Turbo caches test results based on inputs
- Coverage reports cached separately
- Test fixtures cached appropriately

## **11. CI/CD Integration**

### **11.1 GitHub Actions Workflow**

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run test:unit
      - run: pnpm run test:integration
      - run: pnpm run test:e2e
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## **12. Coverage Requirements**

### **12.1 Minimum Coverage Thresholds**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/test-utils/**",
        "**/mocks/**",
      ],
    },
  },
});
```

## **13. Implementation Phases**

### **Phase 1: Foundation**

1. Create `packages/vitest-config`
2. Set up root workspace configuration
3. Configure basic Turborepo tasks

### **Phase 2: Unit Tests**

1. Implement adapter unit tests
2. Service worker unit tests
3. React component tests

### **Phase 3: Integration Tests**

1. WebRTC signaling integration
2. Video sync integration
3. Cross-package communication

### **Phase 4: Workers Testing**

1. Durable Objects tests
2. Worker integration tests
3. End-to-end Workers flow

### **Phase 5: Optimization**

1. Performance tuning
2. CI/CD integration
3. Coverage optimization

## **14. Migration from Existing Setup**

1. **Preserve**: Keep existing Playwright E2E tests
2. **Extend**: Add Vitest configurations alongside
3. **Migrate**: Gradually move unit tests to Vitest
4. **Optimize**: Improve caching and parallelization

## **15. Monitoring and Maintenance**

- Regular dependency updates
- Performance monitoring
- Coverage tracking
- Test reliability metrics

This comprehensive testing strategy provides a robust foundation for TDD development while maintaining compatibility with existing tools and optimizing for the monorepo structure.
