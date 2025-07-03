# **Design Document: Watch Together - Final Unified Design**

## **Section 1: Strategic & Architectural Vision**

This document provides the definitive architectural blueprint and execution strategy for Watch Together, a next-generation browser extension for synchronized media consumption. The primary audience for this document is the Claude Code AI development agent, with secondary utility for the human engineering lead overseeing the project. The specifications herein are designed to be exhaustive, precise, and directly translatable into code, ensuring a streamlined and efficient development lifecycle.

### **1.1 Project Mandate & Guiding Principles**

Watch Together is a browser extension designed to enable groups of users to experience video content across the web in perfect synchronization. The core functionality centers on creating a shared "room" where one user, the "host," controls the playback for all other participants, or "clients." The project's mandate extends beyond simple playback to include synchronized navigation, allowing an entire group to follow the host from one video to another seamlessly.

To navigate the complex and heterogeneous landscape of web-based video streaming, the project will be executed according to five fundamental guiding principles:

1. **Robustness over Features:** The foremost priority is the flawless and resilient synchronization of video playback (play, pause, seek) and navigation. Secondary features, such as integrated chat, are considered non-critical for the initial implementation and will only be addressed after the core experience is demonstrably stable and reliable across a wide range of scenarios.

2. **Universality through Adaptation:** Acknowledging that a single, monolithic solution cannot control the vast array of proprietary and standard video players on the web is a foundational premise of this project. The architecture will be built upon a modular "adapter" framework that isolates site-specific logic, allowing the extension to be resilient to front-end changes on streaming websites and extensible to support new sites over time.

3. **User-Controlled Navigation:** The system will provide users with both automatic and manual navigation options. A clear toggle allows users to choose between "Auto-follow" mode (where they automatically navigate with the host) and "Manual follow" mode (where they receive a "Follow Host Link" button for deliberate navigation choices). This addresses different user preferences and use cases.

4. **Flexible Control Modes:** The system supports two distinct control paradigms that can be toggled by the room host: "Host-Only Control" (default) where only the host can control playback, and "Free-For-All Control" where any participant can control playback. This flexibility accommodates different group dynamics and use cases while maintaining synchronization integrity.

5. **AI-Native Development:** The entire software development lifecycle is designed to be executed by a large language model agent, specifically Claude Code. This principle informs every aspect of the project's structure, from the monorepo architecture to the development workflow, emphasizing structured, granular prompts, automated feedback loops via testing and linting, and the establishment of deterministic guardrails through configuration files and hooks.

6. **Cost-Effective Scalability:** The system architecture must be capable of supporting a growing user base with minimal operational overhead and cost. This dictates a strategic preference for serverless technologies and peer-to-peer communication protocols, offloading high-frequency data exchange from centralized servers.

### **1.2 Core Architectural Pillars**

The Watch Together system is founded on three interdependent architectural pillars, each chosen to directly support the project's guiding principles:

- **Pillar 1: The AI-Governed Monorepo:** The entire codebase will be housed within a monorepo managed by pnpm as the package manager and Turborepo as the build orchestrator. This structure allows for the creation of shared internal packages for configurations (typescript-config, eslint), types, and utilities, preventing an AI agent from generating duplicative helper functions.

- **Pillar 2: The Serverless Signaling Backbone:** The initial connection and negotiation between peers require a central intermediary using Cloudflare Workers with WebSockets for real-time communication. Each "room" is managed by a dedicated Cloudflare Durable Object instance, providing a stateful context on the serverless edge.

- **Pillar 3: The Peer-to-Peer Data Fabric:** All subsequent high-frequency synchronization messages—play, pause, seek commands, and continuous time updates—will be transmitted directly between peers using WebRTC Data Channels, providing the lowest possible latency and cost-effective scalability.

### **1.3 The Universal Adapter Challenge & Solution**

The project's primary technical hurdle is achieving broad compatibility across streaming websites, each with its own unique and often undocumented video player implementation. The Watch Together solution is a **Multi-Tiered Adapter Framework** organized into a clear hierarchy:

1. **Tier 1: Proprietary API Adapter:** For high-value targets like Netflix, dedicated adapters interface directly with internal JavaScript objects discoverable through reverse engineering.

2. **Tier 2: iFrame API Adapter:** For sites like YouTube that embed players within iframes, adapters use documented APIs like the YouTube iFrame Player API.

3. **Tier 3: Generic HTML5 \<video\> Adapter:** A universal fallback that interfaces with standard HTML5 video elements using the HTMLMediaElement API.

4. **Tier 4: Graceful Failure:** Clear communication to users when a site is not supported, maintaining a high-quality user experience even in failure cases.

## **Section 2: System Architecture and Technology Stack**

### **2.1 High-Level System Diagram**

The Watch Together system comprises three main domains: the client-side Chrome Extension, the server-side Signaling Service, and the direct Peer-to-Peer (P2P) connection between clients.

The flow of information and control:

1. **Extension Components:**
   - A **Popup UI** (built with React) serves as the user's main interface
   - A persistent **Service Worker** manages state and communication
   - A **Content Script Loader** assesses the environment and injects appropriate adapters
   - **Adapter Scripts** interact directly with video players

2. **Signaling Server:** Cloudflare Worker routes WebSocket connections to room-specific Durable Object instances

3. **WebRTC P2P Connection:** Direct, encrypted data channels for high-frequency synchronization

### **2.2 Monorepo Architecture with pnpm & Turborepo**

The complete file and directory structure combines the best organizational patterns from both approaches:

```plaintext
watch-together/
├── .claude/
│   ├── settings.json          # Claude Code hooks configuration
│   ├── settings.local.json    # Local, uncommitted settings
│   └── specs/                 # Step-by-step Claude tasks and prompts
│       ├── phase-1-scaffolding.md
│       ├── phase-2-backend.md
│       ├── phase-3-extension-core.md
│       ├── phase-4-adapter-framework.md
│       ├── phase-5-sync-logic.md
│       ├── phase-6-navigation.md
│       └── phase-7-testing.md
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions for linting and testing
├── apps/
│   ├── extension/             # Chrome extension application
│   │   ├── public/           # Static assets (icons, manifest.json)
│   │   ├── src/
│   │   │   ├── background/   # Service Worker logic
│   │   │   │   └── main.ts
│   │   │   ├── content/      # Content script loader
│   │   │   │   └── main.ts
│   │   │   └── popup/        # React UI components
│   │   │       ├── main.tsx
│   │   │       ├── App.tsx
│   │   │       ├── RoomCreate.tsx
│   │   │       ├── RoomJoin.tsx
│   │   │       ├── RoomManager.tsx
│   │   │       └── ControlModeToggle.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── backend/               # Cloudflare Worker + Durable Objects
│       ├── src/
│       │   ├── index.ts       # Main worker script
│       │   └── roomState.ts   # Durable Object implementation
│       ├── wrangler.toml
│       └── package.json
├── packages/
│   ├── adapters/              # Site-specific video player adapters
│   │   ├── src/
│   │   │   ├── IPlayerAdapter.ts
│   │   │   ├── GenericHTML5Adapter.ts
│   │   │   ├── NetflixAdapter.ts
│   │   │   ├── YouTubeAdapter.ts
│   │   │   ├── VimeoAdapter.ts
│   │   │   └── index.ts       # Adapter factory and registry
│   │   └── package.json
│   ├── types/                 # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── events.ts      # Sync events, WebSocket messages
│   │   │   ├── room.ts        # Room state, user types, control modes
│   │   │   └── index.ts
│   │   └── package.json
│   ├── eslint-config/  # Shared ESLint configuration
│   │   ├── index.js
│   │   └── package.json
│   └── typescript-config/       # Shared TypeScript configuration
│       ├── base.json
│       └── package.json
├── tests/                     # Comprehensive test suite
│   ├── e2e/                   # End-to-end tests
│   │   ├── room.spec.ts
│   │   ├── sync.spec.ts
│   │   ├── navigation.spec.ts
│   │   └── control-modes.spec.ts
│   ├── integration/           # Integration tests
│   │   ├── signaling.spec.ts
│   │   └── webrtc.spec.ts
│   ├── adapters/              # Adapter-specific tests
│   │   ├── youtube.spec.ts
│   │   ├── netflix.spec.ts
│   │   └── generic.spec.ts
│   ├── fixtures/              # Test fixtures and utilities
│   │   ├── extension.ts
│   │   └── testPages.ts
│   ├── playwright.config.ts
│   └── package.json
├── .gitignore
├── package.json               # Root package.json with workspaces
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json                 # Turborepo pipeline configuration
└── CLAUDE.md                  # AI development constitution
```

### **2.3 Backend Design: Real-Time Signaling with Cloudflare Workers**

The backend architecture handles only the initial connection phase before handing off to the P2P data fabric:

- **Architecture:** A single Cloudflare Worker script functions as a WebSocket server. When users create or join rooms, the Worker instantiates or routes to the appropriate Durable Object for that room ID.

- **WebRTC Signaling Flow:** Standard WebRTC negotiation flow arbitrated by the Durable Object, handling offer/answer exchange and ICE candidate relay.

- **Signaling Message Schema:** All WebSocket messages adhere to a defined JSON schema in the @repo/types package.

### **2.4 Frontend Design: Chrome Extension with React UI**

The extension's frontend prioritizes performance and user experience:

- **Service Worker:** Central nervous system managing state, WebSocket connections, and internal communication routing.

- **Content Scripts & Adapters:** Lean loader scripts dynamically inject appropriate adapter scripts based on the current site.

- **Popup UI (React):** Modern, maintainable interface for room management. React is chosen for:
  - Mature ecosystem with extensive TypeScript support
  - Excellent developer experience with hooks and modern patterns
  - Strong compatibility with Chrome extension environment
  - Familiar development patterns and extensive community resources

- **Navigation Control:** The popup includes a clear toggle for Auto-follow vs Manual follow modes, with a "Follow Host Link" button appearing when the host navigates in manual mode.

## **Section 3: Implementation of Core Features**

### **3.1 The Universal Video Player Adapter Framework**

The adapter framework standardizes video player interaction through a strict interface:

```typescript
// packages/adapters/src/IPlayerAdapter.ts
export interface IPlayerAdapter {
  // Control methods
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;

  // State methods
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  isPaused(): Promise<boolean>;

  // Event subscription
  on(
    event: "play" | "pause" | "seeking" | "timeupdate",
    callback: (payload?: any) => void,
  ): void;
  off(
    event: "play" | "pause" | "seeking" | "timeupdate",
    callback: (payload?: any) => void,
  ): void;

  // Cleanup
  destroy(): void;
}
```

**Site-Specific Implementations:**

| Website     | Control Tier | Primary Method        | Key API/Object            | Event Strategy      |
| :---------- | :----------- | :-------------------- | :------------------------ | :------------------ |
| YouTube.com | Tier 2       | iFrame Player API     | YT.Player instance        | onStateChange event |
| Netflix.com | Tier 1       | Proprietary JS Object | window.netflix.appContext | Polling mechanism   |
| Vimeo.com   | Tier 2       | Player.js API         | Vimeo.Player instance     | API events          |
| Generic     | Tier 3       | HTML5 video element   | HTMLVideoElement          | Standard DOM events |

### **3.2 State Synchronization via WebRTC Data Channels**

The synchronization protocol supports two distinct control modes:

- **Host-Only Control (Default):** The room creator is the single source of truth for all playback state, with client requests routed through the host
- **Free-For-All Control:** Any participant can directly control playback, with a last-writer-wins conflict resolution strategy
- **Event Protocol:** Well-defined message types for all synchronization events in both control modes
- **Latency Compensation:** Timestamp-based compensation for network delays
- **Mode Switching:** The host can toggle between control modes at any time during the session

**Synchronization Event Schema:**

| Event Type           | Direction        | Payload                                                        | Description                              |
| :------------------- | :--------------- | :------------------------------------------------------------- | :--------------------------------------- |
| HOST_STATE_UPDATE    | Host → Clients   | { state: 'PLAYING'/'PAUSED', time: number, timestamp: number } | Authoritative state broadcast            |
| CLIENT_REQUEST_PLAY  | Client → Host    | {}                                                             | Request to play (Host-Only mode)         |
| CLIENT_REQUEST_PAUSE | Client → Host    | {}                                                             | Request to pause (Host-Only mode)        |
| CLIENT_REQUEST_SEEK  | Client → Host    | { time: number }                                               | Request to seek (Host-Only mode)         |
| DIRECT_PLAY          | Any → All Others | { userId: string, timestamp: number }                          | Direct play command (Free-For-All mode)  |
| DIRECT_PAUSE         | Any → All Others | { userId: string, timestamp: number }                          | Direct pause command (Free-For-All mode) |
| DIRECT_SEEK          | Any → All Others | { userId: string, time: number, timestamp: number }            | Direct seek command (Free-For-All mode)  |
| CONTROL_MODE_CHANGE  | Host → Clients   | { mode: 'HOST_ONLY'/'FREE_FOR_ALL' }                           | Control mode toggle notification         |
| HOST_NAVIGATE        | Host → Clients   | { url: string }                                                | Navigation command                       |

**Control Mode Implementation Details:**

**Host-Only Control Mode (Default):**

- All client playback actions (play/pause/seek) are sent as requests to the host
- Host processes requests and broadcasts authoritative state updates to all clients
- Provides consistent single-source-of-truth behavior
- Prevents conflicting actions from multiple users

**Free-For-All Control Mode:**

- Any participant can send direct control commands to all other participants
- Uses last-writer-wins conflict resolution with 500ms debounce window
- Commands include timestamp for conflict resolution
- Provides more interactive experience for close-knit groups

**Mode Switching Logic:**

- Only the room host can toggle between control modes
- Mode changes are broadcast to all participants immediately
- Existing pending requests are cleared when switching modes
- UI updates reflect the current control mode capabilities

### **3.3 User-Controlled 'Follow the Host' Navigation**

The navigation system provides user choice and security:

**Implementation:**

- **Auto-follow Mode:** Clients automatically navigate when the host changes pages
- **Manual Follow Mode:** Clients receive a notification with a "Follow Host Link" button
- **Security Validation:** Origin validation and domain whitelist prevent malicious redirects
- **Settings Persistence:** User preference saved in extension storage

**Navigation Flow:**

1. Host's Service Worker detects URL change via chrome.tabs.onUpdated
2. System checks user's follow preference setting
3. HOST_NAVIGATE message sent with new URL and follow mode flag
4. Clients respond based on their individual settings:
   - Auto-follow: Immediate navigation with security validation
   - Manual follow: Show notification with follow button

## **Section 4: The Claude Code Execution Strategy**

### **4.1 The CLAUDE.md Project Constitution**

The cornerstone of AI development is the CLAUDE.md file serving as the project's constitution:

```markdown
# **Watch Together: AI Development Constitution**

## **1. Mission Statement**

Your primary goal is to develop **Watch Together**, a robust, multi-site video synchronization browser extension. Build according to the official Design Document. Success is measured by synchronization reliability, flexible control modes, and code maintainability.

## **2. Architectural Principles**

Adhere to the three core architectural pillars:

1. **AI-Governed Monorepo:** Use pnpm + Turborepo structure with shared packages
2. **Serverless Signaling Backbone:** Cloudflare Worker with Durable Objects
3. **Peer-to-Peer Data Fabric:** WebRTC Data Channels for high-frequency sync

## **3. Technology Stack**

**Required Technologies:**

- **Package Manager:** pnpm
- **Build System:** Turborepo
- **Language:** TypeScript (strict mode)
- **UI Framework:** React 19 (with hooks and TypeScript)
- **Backend:** Cloudflare Workers with Durable Objects
- **P2P Communication:** WebRTC Data Channels
- **Testing Framework:** Playwright

## **4. Immutable Coding Conventions**

**Non-negotiable rules:**

- **Type Safety:** Strict TypeScript, use shared @repo/types, avoid `any`
- **Modularity:** Decompose complex problems, follow package structure
- **File Naming:**
  - React components: PascalCase (RoomManager.tsx)
  - TypeScript files: camelCase (syncLogic.ts)
  - Test files: \*.spec.ts (sync.spec.ts)
- **Module Format:** **All runtime code must be authored as ECMAScript modules** (ESM).
  - Use `import` / `export` syntax exclusively; **no CommonJS** `require`, `module.exports`, or `__dirname`.
  - Ensure every build target that needs it (Chrome MV3 service worker, Cloudflare Worker) is emitted as an ES module (`format: "es"` in Vite/Rollup).
- **Exports:** Named exports only, no default exports
- **Documentation:** JSDoc comments for all public APIs
- **Error Handling:** Try/catch for all async operations, graceful error logging
- **TDD Workflow:** Write tests first, implement to make them pass

## **5. React Specific Guidelines**

- **Hooks:** Use useState, useEffect, useMemo, useCallback for state and effects
- **Component Structure:** Props interface, hooks, handlers, then JSX return
- **Event Handling:** Use onClick={handler} syntax with proper TypeScript types
- **Styling:** CSS modules or styled-components with Tailwind for utilities
- **Performance:** Use React.memo, useMemo, useCallback to prevent unnecessary re-renders

## **6. Testing Requirements**

- **Test Categories:** E2E (user journeys), Integration (component interaction), Unit (adapter-specific)
- **TDD Process:** Red (failing test) → Green (passing implementation) → Refactor
- **Coverage:** All adapters must have corresponding Playwright tests
- **Fixtures:** Use shared test fixtures for extension setup

## **7. Interaction Protocol**

- **Clarity:** Ask for clarification on ambiguous or conflicting requirements
- **Updates:** Request CLAUDE.md updates when receiving new rules or corrections
- **Verification:** Use automated hooks for immediate feedback on code changes

## 8. External Knowledge via MCP Servers

- Always use enabled MCP servers (e.g., Context 7 at `https://context7.mcp`) to pull the latest API docs and reference code before working with third-party systems such as Cloudflare Workers, React 19, Chrome MV3, or WebRTC.
- Include links or reference tags from MCP in your code comments when relevant for maintainability.
- If documentation is missing or ambiguous, ask for clarification before proceeding.
```

### **4.2 Phased Development and Detailed Prompt Engineering**

The development process is structured into clear phases with specific, actionable prompts:

#### **Phase 1: Project Scaffolding**

**Goal:** Create complete monorepo structure and configuration

**Sample Prompt:**

```
Your first task is to scaffold the Watch Together project. Following the design document:

1. Initialize the monorepo with pnpm workspaces
2. Create the directory structure exactly as specified
3. Set up Turborepo with proper pipeline configuration
4. Create all package.json files with correct dependencies
5. Set up shared configuration packages (eslint-config, typescript-config)
6. Initialize the types package with basic TypeScript interfaces
7. Create the initial CLAUDE.md file with the constitution

Verify the setup by running `pnpm install` and `turbo build` successfully.
```

#### **Phase 2: React Extension UI**

**Goal:** Build the popup interface with React 19

**Sample Prompt:**

```
Now let's build the extension's React popup UI:

1. Set up Vite config for the extension build with proper React 19 configuration
2. Create the main App.tsx component with routing between Create/Join views
3. Implement RoomCreate.tsx with room creation form
4. Implement RoomJoin.tsx with room ID input
5. Create RoomManager.tsx for active room display with participant list
6. Add the navigation toggle (Auto-follow/Manual follow) to RoomManager
7. Add control mode toggle (Host-Only/Free-For-All) visible only to room host
8. Create ControlModeToggle.tsx component for host control mode switching
9. Implement proper React hooks for state management
10. Style with scoped CSS and Tailwind utilities

The popup should communicate with the service worker via chrome.runtime.sendMessage.
```

#### **Phase 3: Service Worker Core**

**Goal:** Implement the extension's central logic

**Sample Prompt:**

```
Implement the Service Worker (background/main.ts) as the extension's brain:

1. Set up WebSocket connection management to the signaling server
2. Implement room state management using chrome.storage for persistence
3. Create message routing between popup and content scripts
4. Handle WebRTC peer connection establishment and management
5. Implement the host/client hierarchy logic with control mode support
6. Add control mode switching logic (Host-Only/Free-For-All)
7. Handle both routed requests (Host-Only) and direct commands (Free-For-All)
8. Add navigation detection using chrome.tabs.onUpdated
9. Implement user preference handling for follow modes
10. Create proper error handling and logging throughout

Use the types from @repo/types for all interfaces and maintain strict type safety.
```

#### **Phase 4: Adapter Framework Foundation**

**Goal:** Build the video player control system

**Sample Prompt:**

```
Focus on the packages/adapters package:

1. Define the complete IPlayerAdapter interface as specified
2. Implement GenericHTML5Adapter.ts for standard video elements
3. Create the adapter factory pattern for dynamic adapter selection
4. Implement content script loader that detects site and injects correct adapter
5. Set up proper event emission from adapters to service worker
6. Add error handling for adapter failures and graceful fallbacks
7. Create adapter registry with site-to-adapter mapping

Test with a simple HTML page containing a video element.
```

#### **Phase 5: WebRTC Synchronization Logic**

**Goal:** Implement core video synchronization

**Sample Prompt:**

```
ultrathink. This is complex. Implement the core synchronization logic with dual control modes:

1. Complete WebRTC Data Channel setup in Service Worker
2. Implement host state broadcasting (HOST_STATE_UPDATE events)
3. Create client synchronization logic with latency compensation
4. Handle Host-Only mode: client requests (play/pause/seek) routing through host
5. Handle Free-For-All mode: direct commands with conflict resolution
6. Implement control mode switching and state management
7. Add sync tolerance to prevent jittery seeking
8. Add heartbeat mechanism for connection health
9. Handle reconnection logic when peers disconnect
10. Create proper state machine for connection states

Implement both control paradigms with seamless switching. Test with two browser instances.
```

#### **Phase 6: Navigation System**

**Goal:** Implement Follow the Host functionality

**Sample Prompt:**

```
Implement the navigation system with user control:

1. Add URL change detection in host's Service Worker
2. Implement navigation message broadcasting via WebRTC
3. Create client-side navigation handling with security validation
4. Add origin validation and domain whitelist security
5. Implement the Auto-follow/Manual follow toggle in popup
6. Create "Follow Host Link" button for manual mode
7. Add navigation notifications to users
8. Store user preferences in chrome.storage

Security is critical - validate all URLs before navigation.
```

#### **Phase 7: Site-Specific Adapters**

**Goal:** Add YouTube and Netflix support using TDD

**Sample Prompt:**

```
We'll add YouTube support using TDD workflow:

1. First, write youtube.spec.ts test:
   - Navigate to a YouTube video
   - Create a room with two users
   - Test host play/pause/seek commands sync to client
   - Assert client video state matches host within tolerance

2. Run the test - it should fail initially
3. Implement YouTubeAdapter.ts using iFrame Player API
4. Update content script to inject YouTube adapter on youtube.com
5. Iterate until the test passes

Follow the same pattern for NetflixAdapter.ts afterward.
```

### **4.3 Claude Code Hooks Configuration**

The project leverages Claude Code hooks for automated quality assurance:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "", // run for all tools
        "hooks": [
          {
            "type": "command",
            "command": "pnpm run lint",
            "description": "Run ESLint before every tool call"
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "", // run for all tools
        "hooks": [
          {
            "type": "command",
            "command": "pnpm run typecheck",
            "description": "Ensure TypeScript compiles after each tool call"
          },
          {
            "type": "command",
            "command": "bash -c 'if [[ \"$CLAUDE_LAST_TOOL\" == *\"spec.ts\"* ]]; then pnpm run test:playwright \"$CLAUDE_LAST_FILE\"; fi'",
            "description": "Run Playwright on any modified *.spec.ts file"
          }
        ]
      }
    ],

    "Stop": [
      // fires at end of conversation
      {
        "hooks": [
          {
            "type": "command",
            "command": "pnpm run build",
            "description": "Full build after each Claude session"
          }
        ]
      }
    ]
  }
}
```

### 4.4 External Knowledge via MCP Servers

Claude must stay current on fast-moving APIs (Cloudflare Workers, React 19 hooks, Chrome MV3, WebRTC).
Enable the following Model Context Protocol servers:

- **Context 7** – General up-to-date docs and canonical code examples (`https://context7.mcp`)
- **Sequential-Thinking** – Chain-of-thought scaffolds for complex refactors (`https://seq-think.mcp`)

Usage rules

1. Prepend `use context7` to any prompt that touches a third-party API.
2. Prefer `@context7:file://…` references for large docs to avoid token bloat.
3. If a resource is missing, ask for clarification **after** searching via MCP.
4. Keep MCP references out of final code comments unless they aid maintainability.

## **Section 5: Comprehensive Testing Strategy**

### **5.1 Test Environment Setup**

Playwright configuration for Chrome extension testing:

```typescript
// tests/fixtures/extension.ts
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve("apps/extension/dist");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }
    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});
```

### **5.2 Test Suite Organization**

**End-to-End Tests:**

- `room.spec.ts` - Complete user journey from creation to joining
- `sync.spec.ts` - Full synchronization testing across multiple users
- `navigation.spec.ts` - Follow the Host functionality with both modes

**Integration Tests:**

- `signaling.spec.ts` - WebSocket and WebRTC signaling flow
- `webrtc.spec.ts` - P2P connection establishment and data channel communication

**Adapter Tests:**

- `youtube.spec.ts` - YouTube-specific functionality
- `netflix.spec.ts` - Netflix adapter behavior
- `generic.spec.ts` - HTML5 video element control

### **5.3 TDD Workflow Implementation**

The Test-Driven Development workflow creates a self-correcting feedback loop:

1. **Define Feature Slice:** Identify small, testable unit of work
2. **Write Failing Test:** Create Playwright test that defines desired behavior
3. **Confirm Red State:** Run test to verify it fails as expected
4. **Implement Feature:** Write code to make the test pass
5. **Verify Green State:** Hooks automatically re-run tests
6. **Refactor:** Improve code while maintaining passing tests
7. **Commit:** Save working implementation with conventional commit message

This process is automated through Claude Code hooks, providing immediate feedback and preventing regressions.

## **Section 6: Execution Roadmap & Prompts**

### **6.1 Ordered Development Plan**

The following represents a complete, ordered execution plan with specific prompts for each phase:

#### **Setup Phase (Days 1-2)**

**Prompt 1 - Configuring Claude:**

```
Configure Claude Code for the Watch Together project:

1. Create initial CLAUDE.md with the development constitution (Section 4.1)
2. Set up Claude Code hooks in .claude/settings.json (Section 4.3)
3. Create .claude/specs/ directory for phase-specific prompts
4. Configure PreToolUse hooks for linting, PostToolUse hooks for typechecking, etc.
5. Set up MCP server configurations for Context7 and Sequential-Thinking
6. Verify Claude environment is properly configured for AI-native development

Focus on establishing the AI development guardrails and feedback loops.
```

**Prompt 2 - Initial Scaffolding:**

```
Create the complete Watch Together monorepo structure following the design document:

1. Initialize with pnpm workspaces and Turborepo
2. Create all directories and package.json files as specified in Section 2.2
3. Set up shared configuration packages (eslint-config, typescript-config, types)
4. Configure Turborepo pipeline in turbo.json
5. Create basic TypeScript interfaces in packages/types
6. Set up proper package dependencies and workspace references
7. Verify setup with `pnpm install` and basic build

Focus on exact adherence to the directory structure in the design doc.
```

**Prompt 3 - Basic Extension Structure:**

```
Set up the Chrome extension foundation in apps/extension:

1. Create manifest.json with Manifest V3 specifications
2. Set up Vite build configuration for React 19 + TypeScript
3. Create basic Service Worker stub in background/main.ts
4. Set up content script loader in content/main.ts
5. Create minimal React popup structure with main.tsx and App.tsx
6. Configure build process to output proper extension structure
7. Test extension loads in Chrome developer mode

Ensure all TypeScript configurations inherit from @repo/typescript-config.
```

#### **Backend Phase (Days 3-4)**

**Prompt 4 - Cloudflare Worker Signaling:**

```
Implement the complete backend signaling server:

1. Create Cloudflare Worker in apps/backend with TypeScript
2. Implement WebSocket handler for room management
3. Create RoomState Durable Object class for stateful room management
4. Implement WebRTC signaling message relay (offer/answer/candidate)
5. Add proper error handling and logging
6. Configure wrangler.toml for deployment
7. Use types from @repo/types for all message schemas

Test locally with wrangler dev and verify WebSocket connections work.
```

#### **UI Phase (Days 5-6)**

**Prompt 5 - React Popup Interface:**

```
Build the complete React 19 popup interface:

1. Create App.tsx with routing between different views
2. Implement RoomCreate.tsx with room creation form
3. Build RoomJoin.tsx with room ID input and validation
4. Create RoomManager.tsx showing active room state and participants
5. Add navigation control toggle (Auto-follow/Manual follow) to RoomManager
6. Implement "Follow Host Link" button for manual mode
7. Use React hooks (useState, useEffect, useMemo) for state management
8. Style with CSS modules or styled-components and integrate Tailwind utilities
9. Set up proper communication with Service Worker via chrome.runtime.sendMessage

Focus on clean component architecture and user experience.
```

**Prompt 6 - Service Worker Implementation:**

```
Implement the complete Service Worker as the extension's brain:

1. Set up WebSocket connection management to signaling server
2. Implement room state management with chrome.storage persistence
3. Create message routing system between popup and content scripts
4. Handle WebRTC peer connection setup and management
5. Implement host/client role management and state tracking
6. Add navigation change detection using chrome.tabs.onUpdated
7. Create user preference handling for follow modes
8. Implement proper error handling, logging, and reconnection logic

Use strict TypeScript and @repo/types throughout. Test with popup integration.
```

#### **Adapter Framework Phase (Days 7-9)**

**Prompt 7 - Adapter Foundation:**

```
Build the universal video player adapter framework:

1. Define complete IPlayerAdapter interface in packages/adapters
2. Implement GenericHTML5Adapter.ts for standard video elements
3. Create adapter factory/registry pattern for dynamic selection
4. Implement content script loader that detects sites and injects adapters
5. Set up event communication from adapters to Service Worker
6. Add error handling and graceful fallback mechanisms
7. Create adapter testing utilities for development

Test with a simple HTML page containing a video element to verify the framework works.
```

**Prompt 8 - YouTube Adapter (TDD):**

```
Add YouTube support using Test-Driven Development:

1. First, write tests/adapters/youtube.spec.ts:
   - Navigate to a YouTube video URL
   - Create room with host and client users
   - Test play/pause/seek synchronization
   - Assert client video state matches host within tolerance

2. Run the test - confirm it fails (Red state)
3. Implement YouTubeAdapter.ts using YouTube iFrame Player API
4. Update content script to inject YouTube adapter on youtube.com domain
5. Iterate implementation until youtube.spec.ts passes (Green state)

Follow TDD strictly: Red → Green → Refactor. Use Claude Code hooks for automation.
```

#### **Synchronization Phase (Days 10-12)**

**Prompt 9 - Core Sync Logic:**

```
ultrathink. Implement the core video synchronization system:

1. Complete WebRTC Data Channel setup in Service Worker
2. Implement host state broadcasting system (HOST_STATE_UPDATE events)
3. Create client synchronization logic with network latency compensation
4. Handle client requests (play/pause/seek) that route through host authority
5. Add sync tolerance buffers to prevent jittery seeking behavior
6. Implement connection health monitoring with heartbeat mechanism
7. Create reconnection logic for when peers disconnect
8. Build comprehensive state machine for connection lifecycle

The host must always be the single source of truth. Test with two browser instances.
```

**Prompt 10 - Navigation System:**

```
Implement the Follow the Host navigation with user control:

1. Add URL change detection in host's Service Worker
2. Implement navigation message broadcasting via WebRTC Data Channel
3. Create client-side navigation handling with security validation
4. Add origin validation and domain whitelist for security
5. Implement Auto-follow/Manual follow user preference system
6. Create "Follow Host Link" notification and button for manual mode
7. Add proper navigation state management and user feedback
8. Store user preferences persistently in chrome.storage

Security is critical - validate all URLs and origins before any navigation.
```

#### **Advanced Features Phase (Days 13-15)**

**Prompt 11 - Control Mode Implementation:**

```
Implement the dual control mode system:

1. Create ControlMode enum and types in @repo/types:
   - HOST_ONLY and FREE_FOR_ALL control modes
   - Room state interface with control mode field
   - Event types for direct commands and mode changes

2. Update Service Worker to handle dual control modes:
   - Implement mode switching logic (host-only capability)
   - Handle Host-Only: route client requests through host
   - Handle Free-For-All: process direct commands with conflict resolution
   - Add 500ms debounce window for conflict resolution

3. Update popup UI with control mode toggle:
   - Add ControlModeToggle.tsx component
   - Show toggle only to room host
   - Update RoomManager to display current control mode
   - Handle mode change events from Service Worker

4. Test both control modes with multiple browser instances
   - Verify Host-Only routing behavior
   - Test Free-For-All direct command handling
   - Confirm smooth mode switching without disconnection

Focus on seamless user experience and conflict resolution.
```

**Prompt 12 - Netflix Adapter (TDD):**

```
Add Netflix support following the TDD pattern:

1. Write comprehensive tests/adapters/netflix.spec.ts:
   - Navigate to Netflix video (use test account)
   - Test proprietary player control via window.netflix.appContext
   - Verify play/pause/seek synchronization with polling mechanism
   - Assert state changes are detected and reported correctly

2. Implement NetflixAdapter.ts:
   - Access window.netflix.appContext.state.playerApp.getAPI().videoPlayer
   - Implement robust try/catch blocks for proprietary API access
   - Use polling mechanism for state change detection
   - Handle API changes gracefully with fallback behavior

3. Update content script injection for netflix.com domain
4. Iterate until netflix.spec.ts passes completely

This adapter represents Tier 1 (most fragile) - handle breaking changes gracefully.
```

#### **Testing & Polish Phase (Days 16-18)**

**Prompt 13 - Comprehensive E2E Testing:**

```
Create the complete end-to-end test suite:

1. Implement tests/e2e/room.spec.ts:
   - Full user journey from extension installation to room joining
   - Multi-user scenarios with host and multiple clients
   - Room creation, joining, participant management

2. Create tests/e2e/sync.spec.ts:
   - Comprehensive synchronization testing across different video sites
   - Latency compensation verification
   - Edge cases like network interruptions and reconnection

3. Build tests/e2e/navigation.spec.ts:
   - Both Auto-follow and Manual follow modes
   - Security validation of navigation URLs
   - Cross-site navigation scenarios

4. Create tests/e2e/control-modes.spec.ts:
   - Host-Only control mode with client request routing
   - Free-For-All mode with direct command handling
   - Control mode switching and conflict resolution
   - Multi-user scenarios in both control modes

5. Add proper test fixtures, utilities, and CI integration
6. Ensure all tests run reliably in headless mode for CI/CD

Focus on real-world usage scenarios and edge case handling.
```

**Prompt 14 - Error Handling & Polish:**

```
Implement comprehensive error handling and user experience polish:

1. Add graceful error handling throughout the Service Worker
2. Implement user-friendly error messages in the popup UI
3. Create proper loading states and connection status indicators
4. Add retry mechanisms for failed connections
5. Implement proper cleanup when users leave rooms
6. Add connection quality indicators and diagnostic information
7. Create user onboarding flow and help documentation within the popup
8. Optimize performance and reduce bundle size

Ensure the extension handles all failure scenarios gracefully with clear user communication.
```

### **6.2 Success Criteria**

Each phase has clear success criteria:

- **Setup Phase:** Monorepo builds successfully, all packages install correctly
- **Backend Phase:** Signaling server deploys and handles WebSocket connections
- **UI Phase:** Popup interface is functional and communicates with Service Worker
- **Adapter Framework:** Generic HTML5 adapter controls video elements successfully
- **Synchronization Phase:** Two browser instances can sync video playback reliably
- **Advanced Features:** Multiple streaming sites work with appropriate adapters
- **Testing Phase:** Comprehensive test suite passes in both development and CI environments

## **Section 7: Quality Assurance & Deployment**

### **7.1 Code Quality Standards**

The project enforces strict quality standards through:

- **TypeScript Strict Mode:** No `any` types, comprehensive type coverage
- **ESLint Configuration:** Shared rules across all packages
- **Automated Testing:** Playwright E2E, integration, and unit tests
- **Claude Code Hooks:** Automated linting, type checking, and test execution
- **Continuous Integration:** GitHub Actions for automated quality checks

### **7.2 Performance Optimization**

Key performance considerations:

- **Bundle Size:** React's tree-shaking and modern build tools minimize bundle size
- **Memory Usage:** Service Worker lifecycle management prevents memory leaks
- **Network Efficiency:** WebRTC P2P reduces server load and latency
- **Battery Life:** Efficient polling and event-driven architecture

### **7.3 Security Measures**

Security is paramount for a browser extension:

- **Content Security Policy:** Full MV3 compliance with no eval usage
- **Origin Validation:** All navigation URLs validated against whitelist
- **Minimal Permissions:** Request only necessary Chrome extension permissions
- **Data Privacy:** No user data stored on servers, P2P communication
- **Input Validation:** All user inputs and external data properly sanitized

## **Section 8: Future Enhancements**

### **8.1 Immediate Roadmap**

Post-launch enhancements in priority order:

1. **Firefox Support:** Port extension to Firefox with WebExtensions API
2. **Mobile Companion:** React Native app for mobile room management
3. **Chat Integration:** Text chat over existing WebRTC Data Channel
4. **More Adapters:** Hulu, Disney+, Amazon Prime Video support

### **8.2 Advanced Features**

Longer-term enhancements:

- **Host Transfer:** Dynamic host role reassignment
- **Playback Rate Control:** Synchronized speed adjustments
- **Watch Parties:** Public rooms with moderation features
- **Analytics Dashboard:** Usage metrics and room statistics

### **8.3 Community Contributions**

The modular adapter framework enables community-driven expansion:

- **Adapter Marketplace:** Community-submitted adapters for niche streaming sites
- **Documentation:** Comprehensive adapter development guide
- **Testing Framework:** Standardized testing patterns for new adapters
- **Code Reviews:** Community review process for contributed adapters

## **Conclusion**

This design document represents a comprehensive, expert-level blueprint for Watch Together that combines the strongest elements from multiple architectural approaches. The system is designed for reliability, scalability, and maintainability while being perfectly suited for AI-driven development through Claude Code.

The phased development approach, comprehensive testing strategy, and automated quality assurance create a robust framework for delivering a production-ready browser extension. The modular architecture ensures the system can evolve and expand while maintaining stability and performance.

Most importantly, the detailed prompt engineering and TDD workflow provide a clear path for autonomous AI development, turning this design document into an actionable implementation plan that can be executed systematically and reliably.
