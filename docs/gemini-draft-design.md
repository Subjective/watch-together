# **Design Document: Watch Together**

## **Section 1: Strategic & Architectural Vision**

This document provides the definitive architectural blueprint and execution strategy for Watch Together, a next-generation browser extension for synchronized media consumption. The primary audience for this document is the Claude Code AI development agent, with secondary utility for the human engineering lead overseeing the project. The specifications herein are designed to be exhaustive, precise, and directly translatable into code, ensuring a streamlined and efficient development lifecycle.

### **1.1 Project Mandate & Guiding Principles**

Watch Together is a browser extension designed to enable groups of users to experience video content across the web in perfect synchronization. The core functionality centers on creating a shared "room" where one user, the "host," controls the playback for all other participants, or "clients." The project's mandate extends beyond simple playback to include synchronized navigation, allowing an entire group to follow the host from one video to another seamlessly.

To navigate the complex and heterogeneous landscape of web-based video streaming, the project will be executed according to four fundamental guiding principles:

1. **Robustness over Features:** The foremost priority is the flawless and resilient synchronization of video playback (play, pause, seek) and navigation. Secondary features, such as integrated chat, are considered non-critical for the initial implementation and will only be addressed after the core experience is demonstrably stable and reliable across a wide range of scenarios. This focus ensures that the primary user value proposition is delivered with exceptional quality.
2. **Universality through Adaptation:** Acknowledging that a single, monolithic solution cannot control the vast array of proprietary and standard video players on the web is a foundational premise of this project. Research confirms that major streaming platforms like Netflix, Hulu, and Disney+ do not offer public, stable APIs for controlling their video players.1 Therefore, the architecture will be built upon a modular "adapter" framework. This approach isolates site-specific logic, allowing the extension to be resilient to front-end changes on streaming websites and extensible to support new sites over time.
3. **AI-Native Development:** The entire software development lifecycle is designed to be executed by a large language model agent, specifically Claude Code. This principle informs every aspect of the project's structure, from the monorepo architecture to the development workflow. The process emphasizes structured, granular prompts, automated feedback loops via testing and linting, and the establishment of deterministic guardrails through configuration files and hooks.4 This approach treats the AI not as a simple code generator but as an integral team member, whose unique capabilities and limitations are accounted for in the project's methodology.6
4. **Cost-Effective Scalability:** The system architecture must be capable of supporting a growing user base with minimal operational overhead and cost. This dictates a strategic preference for serverless technologies and peer-to-peer communication protocols. By offloading high-frequency data exchange from centralized servers, the system can scale to a large number of concurrent sessions while maintaining low latency and near-zero marginal cost per user.

### **1.2 Core Architectural Pillars**

The Watch Together system is founded on three interdependent architectural pillars, each chosen to directly support the project's guiding principles.

- **Pillar 1: The AI-Governed Monorepo:** The entire codebase will be housed within a monorepo managed by pnpm as the package manager and Turborepo as the build orchestrator. This is a strategic choice designed to maximize development velocity and code quality when working with an AI agent. A monorepo enforces a single, consistent version of dependencies, preventing version conflicts across packages. pnpm's use of a content-addressable store and symlinks provides significant performance gains and disk space efficiency compared to alternatives.7  
  Turborepo introduces intelligent task scheduling and caching, which dramatically reduces build and test times, enabling a rapid, iterative feedback loop for the AI.8 Most importantly, this structure allows for the creation of shared internal packages for configurations (  
  tsconfig, eslint), types, and utilities. This is critical for preventing an AI agent from "vibe-coding" or repeatedly generating duplicative helper functions, a known pattern that can degrade code quality over time.4 By providing these shared resources, we guide the AI to write more consistent, modular, and maintainable code.
- **Pillar 2: The Serverless Signaling Backbone:** The initial connection and negotiation between peers require a central intermediary, known as a signaling server. For Watch Together, this role will be fulfilled by a backend built on Cloudflare Workers. This serverless platform offers a highly scalable, low-latency, and extremely cost-effective solution.10 Specifically, the architecture will leverage WebSockets for real-time communication, with each "room" being managed by a dedicated Cloudflare Durable Object instance.11 Durable Objects provide a stateful context on the serverless edge, allowing the system to maintain a list of participants in a room and broker the necessary signaling messages without the overhead of a traditional, always-on server. This "signaling" phase is temporary; once peers are connected, the server's job is largely done.
- **Pillar 3: The Peer-to-Peer Data Fabric:** While the serverless backend handles the initial handshake, all subsequent high-frequency synchronization messages—play, pause, seek commands, and continuous time updates—will be transmitted directly between peers using WebRTC Data Channels.12 This is the cornerstone of the cost-effective scalability principle. Offloading this continuous stream of data from our central server to direct peer-to-peer connections means that the operational cost does not scale linearly with user engagement. It also provides the lowest possible latency for synchronization events, as messages do not need to make a round trip through a central server. This hybrid client-server/peer-to-peer model provides the best of both worlds: the reliability of a central server for connection setup and the efficiency and low latency of P2P for the core synchronization task.

### **1.3 The Universal Adapter Challenge & Solution**

The project's primary technical hurdle is achieving broad compatibility across streaming websites, each with its own unique and often undocumented video player implementation. A naive approach attempting to control all players with a single script is doomed to fail due to the heterogeneity of the web.

The Watch Together solution is a **Multi-Tiered Adapter Framework**. This design pattern acknowledges the reality of the web and builds a resilient, extensible system for video player control. Instead of a single content script, the extension will dynamically inject the appropriate "adapter" based on the website the user is on. This strategy is organized into a clear hierarchy of preference:

1. **Tier 1: Proprietary API Adapter:** For high-value, popular targets like Netflix, a dedicated adapter will be developed. This adapter will interface directly with the site's internal, non-public JavaScript objects, which are discoverable through reverse engineering. For example, the Netflix player can be controlled with high fidelity via the window.netflix.appContext.state.playerApp.getAPI().videoPlayer object.14 This tier offers the most robust and seamless control but is the most fragile, as it is susceptible to breaking when the target site updates its front-end code.
2. **Tier 2: iFrame API Adapter:** Many websites, including the world's largest video platform, YouTube, embed their players within an \<iframe\>. These players often expose a formal JavaScript API for control, communicating via the window.postMessage mechanism. For these sites, a specific adapter will be implemented to use the documented API, such as the YouTube iFrame Player API.16 This tier is more stable than Tier 1, as it relies on a semi-public contract.
3. **Tier 3: Generic HTML5 \<video\> Adapter:** As a universal fallback, a generic adapter will be implemented to interface with the standard HTML5 \<video\> element. This adapter will search the page's DOM for a \<video\> tag and use the standard HTMLMediaElement API for control (e.g., .play(), .pause(), .currentTime) and to listen for standard events (play, pause, seeking).18 This provides a baseline level of compatibility for a vast number of smaller or less complex websites.
4. **Tier 4: Graceful Failure:** In cases where no adapter can identify a controllable video element, the extension will not fail silently. It will clearly and gracefully communicate this limitation to the user through its UI, explaining that the current site is not supported. This prevents user frustration and manages expectations, maintaining a high-quality user experience even in failure cases.

This adapter pattern is a core resilience strategy. By isolating site-specific logic into modular, independent packages, the system is protected from cascading failures. If Netflix deploys a change that breaks the Tier 1 adapter, only the netflix-adapter.ts file needs to be debugged and updated. The rest of the system, and its functionality on other sites, remains entirely unaffected. This modularity is also perfectly suited for the AI-native development process. It allows the human operator to issue highly specific, scoped-down prompts, such as, "The YouTube adapter is failing to detect pause events. Analyze YouTubeAdapter.ts and the Playwright test in youtube.spec.ts and provide a fix." This aligns perfectly with the observation that Claude Code excels at well-defined, primary tasks rather than broad, ambiguous ones.6

## **Section 2: System Architecture and Technology Stack**

This section provides a detailed breakdown of the system's components, their interactions, and the specific technologies chosen for implementation.

### **2.1 High-Level System Diagram**

The Watch Together system comprises three main domains: the client-side Chrome Extension, the server-side Signaling Service, and the direct Peer-to-Peer (P2P) connection between clients.

The flow of information and control can be visualized as follows:

1. **Extension Components:** The browser extension itself is composed of several key parts operating under Manifest V3 guidelines.
   - A **Popup UI** serves as the user's main interface for creating and joining rooms.
   - A persistent **Service Worker** acts as the extension's brain, managing state, handling all communication with the backend, and orchestrating actions between other extension components.
   - A **Content Script Loader** is injected into web pages to assess the environment.
   - An **Adapter Script**, chosen by the loader, is then injected into the page's main world to directly interact with the video player.
2. **Signaling Server (Cloudflare Worker & Durable Object):** When a user initiates or joins a session, the Service Worker establishes a WebSocket connection to a Cloudflare Worker. This worker routes the connection to a specific **Durable Object** instance, unique to that session's room ID. This Durable Object is responsible for managing the room's roster and relaying the initial WebRTC signaling messages (offers, answers, ICE candidates) between the peers.
3. **WebRTC Peer-to-Peer Connection:** After the initial signaling phase is complete, a direct, encrypted **WebRTC Data Channel** is established between the host and all clients. All subsequent, high-frequency synchronization data (play/pause/seek commands, time updates) and navigation commands flow through this direct channel, bypassing the server entirely.

The 'Follow the Host' feature originates from the host's Service Worker detecting a URL change. A navigation command is sent over the WebRTC Data Channel to all clients. The clients' Service Workers receive this command and instruct their respective browser tabs to navigate to the new URL.

### **2.2 Monorepo Architecture with pnpm & Turborepo**

The project's foundation is a monorepo, a single repository containing multiple distinct packages. This structure is managed by pnpm for dependency and workspace management, and Turborepo for build orchestration. The rationale for this choice is rooted in efficiency and consistency, particularly for an AI-driven workflow.7

pnpm provides superior performance during installation and more efficient disk usage through its non-flat node_modules structure and use of a global content-addressable store.8 This speed is critical for maintaining a fast development cycle.

Turborepo complements this by providing intelligent, remote-cachable build pipelines. It understands the dependency graph within the monorepo, ensuring that a change in a low-level package (like @repo/types) triggers a rebuild of only the packages that depend on it, not the entire repository.9 This avoids unnecessary work and provides near-instantaneous feedback during development and in CI/CD environments.

The complete file and directory structure for the AI agent is specified as follows:

```Plaintext

sync-stream/
├──.claude/
│ ├── settings.json \# Claude Code hooks configuration for automated quality checks
│ └── settings.local.json \# Local, uncommitted settings (e.g., for experimental hooks)
├──.github/
│ └── workflows/
│ └── ci.yml \# GitHub Actions workflow for running linting and Playwright tests
├── apps/
│ └── extension/ \# The primary Chrome extension application package
│ ├── public/ \# Static assets (icons, etc.)
│ ├── src/
│ │ ├── background/ \# Service Worker logic for state and communication management
│ │ │ └── main.ts
│ │ ├── content/ \# Content script loader responsible for adapter injection
│ │ │ └── main.ts
│ │ ├── popup/ \# Svelte UI components for the extension popup
│ │ │ ├── main.ts
│ │ │ └── Popup.svelte
│ │ └── manifest.json
│ └── package.json
├── packages/
│ ├── adapters/ \# Site-specific video player adapters
│ │ ├── src/
│ │ │ ├── IPlayerAdapter.ts \# The abstract interface all adapters must implement
│ │ │ ├── GenericHTML5Adapter.ts
│ │ │ ├── NetflixAdapter.ts
│ │ │ └── YouTubeAdapter.ts
│ │ └── package.json
│ ├── eslint-config-custom/ \# Shared ESLint configuration package
│ │ └── index.js
│ ├── tsconfig-custom/ \# Shared TypeScript configuration package
│ │ └── base.json
│ └── types/ \# Shared TypeScript types and interfaces for the entire system
│ ├── src/
│ │ └── index.ts \# e.g., RoomState, SyncEvent, User, WebSocketMessage
│ └── package.json
├──.gitignore
├── package.json \# Root package.json defining workspaces and turbo scripts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml \# pnpm configuration defining workspace locations
└── turbo.json \# Turborepo pipeline configuration
```

To prevent ambiguity for the AI agent, the role and responsibility of each package within the monorepo are explicitly defined. This serves as a "map" of the codebase, guiding the agent on where to place new code and how packages relate to one another.

| Package Name         | Location                      | Description                                                                                                                                                                | Key Dependencies            |
| :------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| extension            | apps/extension                | The main Chrome extension application. This package consumes and integrates all other packages to create the final, user-facing product.                                   | @repo/adapters, @repo/types |
| adapters             | packages/adapters             | Contains the modular, site-specific logic for discovering and controlling video players. Each file represents an adapter for a specific streaming service.                 | @repo/types                 |
| types                | packages/types                | Defines all shared TypeScript interfaces and types (e.g., SyncEvent, RoomState) used across the frontend and backend to ensure type safety and consistent data structures. | \-                          |
| eslint-config-custom | packages/eslint-config-custom | A shared ESLint configuration package to enforce a consistent code style and quality across the entire monorepo.                                                           | eslint, typescript-eslint   |
| tsconfig-custom      | packages/tsconfig-custom      | Contains shared TypeScript compiler options (tsconfig.json) that are extended by all other packages to ensure consistent compilation settings.                             | typescript                  |

### **2.3 Backend Design: Real-Time Signaling with Cloudflare Workers**

The backend architecture is designed for extreme cost-efficiency and scalability, handling only the initial connection phase before handing off to the P2P data fabric.

- **Architecture:** The entire backend is a single Cloudflare Worker script that functions as a WebSocket server. When the first user in a session sends a create*room message, the Worker instantiates a **Durable Object** for that room, generating a unique room ID. The Durable Object is a single-threaded, stateful environment that will persist as long as it is needed. The creating user's WebSocket is then forwarded to this object. When subsequent users attempt to join with that room ID, their WebSockets are routed to the \_exact same* Durable Object instance. This object becomes the central, temporary hub for that specific room, managing its list of participants and brokering the WebRTC signaling messages required to establish peer connections.11 Once all peers are disconnected, the Durable Object is eventually evicted from memory, incurring no further cost.
- **WebRTC Signaling Flow:** The process of establishing a P2P connection follows a standard WebRTC negotiation flow, arbitrated by the Durable Object.12
  1. **Client A (Host)** connects to the Worker via WebSocket.
  2. The Host sends a {"type": "create_room"} message. The Worker creates a Durable Object, returns a unique roomId to the Host, and connects the Host's WebSocket to the object.
  3. **Client B (Friend)** is given the roomId out-of-band (e.g., via a messaging app).
  4. The Friend connects to the Worker and sends {"type": "join_room", "roomId": "..."}. The Worker validates the roomId and connects the Friend's WebSocket to the same Durable Object.
  5. The Durable Object notifies the Host (and all other connected peers) that a new peer has joined.
  6. Upon receiving this notification, the **Host** initiates the P2P connection by creating a WebRTC "offer" (an SDP description) and sends it to the Durable Object with the message {"type": "signal", "target": "friend_id", "payload": {"type": "offer", "sdp":...}}.
  7. The **Durable Object** relays this message to the specified target, the Friend.
  8. The **Friend** receives the offer, creates a WebRTC "answer," and sends it back: {"type": "signal", "target": "host_id", "payload": {"type": "answer", "sdp":...}}.
  9. The **Durable Object** relays the answer back to the Host.
  10. The **Host and Friend** now begin exchanging ICE candidates (network path information) through the Durable Object, using the same signaling message format, until a direct P2P path is found and the RTCPeerConnection state becomes connected.
  11. At this point, the WebRTC Data Channel is open, and all further synchronization happens directly between peers. The WebSocket connection remains open for presence management (detecting disconnects) and potential re-signaling if needed.
- **Signaling Message Schema:** To ensure strict and reliable communication, all messages sent over the WebSocket will adhere to a defined JSON schema. This prevents ambiguity and simplifies parsing logic on both the client and server. The schema will be defined in the @repo/types package.

### **2.4 Frontend Design: Chrome Extension Internals (Manifest V3)**

The extension's frontend is architected with a clear separation of concerns, adhering to Manifest V3 best practices to enhance security, performance, and maintainability.

- **Service Worker (background/main.ts):** This is the extension's central nervous system. As a non-terminating script (within the limits of Manifest V3's lifecycle), it is responsible for maintaining the core application state, such as the current roomId, the list of users in the session, and the user's role (host or client). It manages the persistent WebSocket connection to the signaling server and acts as the sole router for all internal communication between the popup and content scripts. All significant logic resides here.
- **Content Scripts (content/main.ts & packages/adapters):** The content script's role is intentionally minimal. A lean loader script (content/main.ts) is injected into all pages. Its only responsibilities are to read the current URL, determine which site-specific adapter script is required, and dynamically inject that adapter script from the packages/adapters directory into the page's main execution world. This injection into the main world is crucial, as it grants the adapter script access to the page's window object, which is necessary to hook into proprietary player APIs like Netflix's.14 The loader itself remains in an isolated world, enhancing security.
- **Popup UI (popup/Popup.svelte):** The popup is the user's control panel, built with Svelte for its performance and simplicity. It is a "dumb" component; it does not contain any complex state or business logic. Its role is to display state information that it requests from the Service Worker (e.g., "Who is in the room?") and to send user-initiated commands to the Service Worker (e.g., "Create a new room").
- **Internal Communication Protocol:** All communication between these isolated components will use the standard Chrome extension messaging APIs: chrome.runtime.sendMessage and chrome.tabs.sendMessage. A strict message-passing interface, with types defined in the @repo/types package, will be used to ensure that all components speak the same language. For example, the popup will send a {type: 'GET_ROOM_STATE'} message to the service worker, which will respond with the current state.

This decoupled architecture is a key design decision. Placing the majority of the logic in the Service Worker creates a single, reliable source of truth for the application's state. It prevents the kind of state desynchronization issues that can arise when multiple content scripts or popups try to manage their own state. This separation of concerns makes the system significantly easier to debug, more secure by limiting the privileges of scripts running in the page context, and more aligned with the event-driven model of Manifest V3.

## **Section 3: Implementation of Core Features**

This section details the implementation strategy for the project's core functionalities, focusing on the adapter framework, the synchronization mechanism, and the navigation feature.

### **3.1 The Universal Video Player Adapter Framework**

The heart of the extension's cross-site compatibility lies in its adapter framework. This framework is built upon a strict interface that standardizes how the extension interacts with any video player, regardless of its underlying technology.

- **The IPlayerAdapter Interface (packages/adapters/src/IPlayerAdapter.ts):** This TypeScript interface defines the contract that every site-specific adapter must implement. It abstracts the player's specific methods and events into a common language that the rest of the extension can understand.

```TypeScript
  // packages/adapters/src/IPlayerAdapter.ts
  export interface IPlayerAdapter {
   // Methods for controlling the player
   play(): Promise\<void\>;
   pause(): Promise\<void\>;
   seek(time: number): Promise\<void\>;
   setPlaybackRate(rate: number): Promise\<void\>;

  // Methods for getting player state
   getCurrentTime(): Promise\<number\>;
   getDuration(): Promise\<number\>;
   isPaused(): Promise\<boolean\>;

  // Event subscription
   on(event: 'play' | 'pause' | 'seeking' | 'timeupdate', callback: (payload?: any) \=\> void): void;
   off(event: 'play' | 'pause' | 'seeking' | 'timeupdate', callback: (payload?: any) \=\> void): void;

  // Cleanup method
   destroy(): void;
  }
```

- **Site-Specific Implementations:**
  - **YouTubeAdapter.ts:** This adapter will be responsible for detecting and controlling YouTube's embedded video player. It will leverage the official YouTube iFrame Player API.16 The adapter will wait for the  
    onYouTubeIframeAPIReady callback, then instantiate a YT.Player object targeting the video's \<iframe\>. Player actions like play() and pause() will be mapped to the API's player.playVideo() and player.pauseVideo() methods. Crucially, it will listen to the onStateChange event from the API to detect user-initiated actions (e.g., the user clicking the native pause button) and report them back to the extension's Service Worker.23
  - **NetflixAdapter.ts:** This adapter represents a Tier 1 implementation. It will not have a public API to rely on. Instead, it will attempt to access the proprietary JavaScript object window.netflix.appContext.state.playerApp.getAPI().videoPlayer.14 The implementation must include robust  
    try...catch blocks and type guards, as this object path could change at any time without warning. Player control methods like seek() will be mapped directly to the discovered player.seek() method. Since reliable events may not be available from this internal object, the adapter will need to implement a polling mechanism (e.g., using setInterval) to frequently call player.getCurrentTime() and player.isPaused() to detect state changes and emit its own timeupdate and pause/play events.
  - **GenericHTML5Adapter.ts:** This is the universal fallback adapter. Its primary task is to find the most likely candidate for the main video on a page, typically by running document.querySelector('video'). Once an HTMLVideoElement is found, the adapter will directly use the standard HTMLMediaElement API.18 Control methods are a direct mapping (e.g.,  
    videoElement.play()). Event listening is also straightforward, using videoElement.addEventListener for standard media events like 'play', 'pause', 'seeking', and 'timeupdate'.24 This adapter ensures a baseline level of functionality on any site that uses standard web technologies for its video playback.

The following table provides a clear reference for the control strategy on various platforms, guiding development and debugging.

| Website      | Control Tier | Primary Control Method | Fallback Method       | Key API/Object               | Event Listening Strategy                              |
| :----------- | :----------- | :--------------------- | :-------------------- | :--------------------------- | :---------------------------------------------------- |
| YouTube.com  | Tier 2       | iFrame Player API      | Generic HTML5 Adapter | YT.Player instance           | onStateChange event from API                          |
| Netflix.com  | Tier 1       | Proprietary JS Object  | Generic HTML5 Adapter | window.netflix.appContext... | Polling player.getCurrentTime() and player.isPaused() |
| Vimeo.com    | Tier 2       | Player.js API          | Generic HTML5 Adapter | Vimeo.Player instance        | API events: play, pause, timeupdate                   |
| Generic Site | Tier 3       | Generic HTML5 Adapter  | None                  | HTMLVideoElement             | Standard DOM events: play, pause, seeking, timeupdate |

### **3.2 State Synchronization via WebRTC Data Channels**

The core synchronization logic relies on a well-defined protocol over a peer-to-peer WebRTC Data Channel. This choice is deliberate to achieve low latency and low server cost.13

- **Host-Client Hierarchy:** To prevent state divergence and "sync battles" where two users' actions conflict, the system employs a strict host-client hierarchy. The first user to create the room is designated the "host," and their player state is the single source of truth.
  - The host's adapter continuously reports its state (e.g., PLAYING at time 1:23.45) to its Service Worker.
  - The host's Service Worker broadcasts this authoritative state to all clients via the WebRTC Data Channel in a HOST_STATE_UPDATE message.
  - Clients' Service Workers receive this message and command their local adapters to match the host's state (e.g., by calling adapter.play() and adapter.seek(83.45)). A small buffer (e.g., \~0.5 seconds) is used in the client-side logic to ignore minor time discrepancies and prevent jittery seeking.
  - If a _client_ performs an action (e.g., clicks pause), their adapter fires a pause event. This is sent up to their Service Worker, which then sends a CLIENT*REQUEST_PAUSE message to the \_host* over the data channel.
  - The host's Service Worker receives this request, commands its _own_ player to pause, and then broadcasts the new authoritative PAUSED state to all clients. This ensures the host always remains the source of truth and all state changes are serialized through it.
- **Synchronization Event Protocol Schema:** The "language" spoken between peers over the data channel is defined by the following strict schema. All messages are JSON objects with a type and payload. These types will be defined in the @repo/types package.

| Event Type           | Direction         | Payload            | Description                                                                 |
| :------------------- | :---------------- | :----------------- | :-------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| HOST_STATE_UPDATE    | Host \-\> Clients | { state: 'PLAYING' | 'PAUSED', time: number, timestamp: number }                                 | The host's current authoritative state. timestamp is a Date.now() value used by clients to calculate and compensate for latency. |
| CLIENT_REQUEST_PLAY  | Client \-\> Host  | {}                 | A client requests that the host plays the video for everyone.               |
| CLIENT_REQUEST_PAUSE | Client \-\> Host  | {}                 | A client requests that the host pauses the video for everyone.              |
| CLIENT_REQUEST_SEEK  | Client \-\> Host  | { time: number }   | A client requests that the host seeks the video to a new time for everyone. |
| HOST_NAVIGATE        | Host \-\> Clients | { url: string }    | The host has navigated to a new page. Clients should follow.                |

### **3.3 'Follow the Host' Navigation Protocol**

This feature provides a seamless experience for moving between videos as a group.

- **Implementation:** The host's Service Worker will use the chrome.tabs.onUpdated event listener. When it detects a completed navigation in the host's active tab (changeInfo.status \=== 'complete'), it will capture the new URL.
- The Service Worker will then broadcast a HOST_NAVIGATE message, containing the new URL, to all connected clients via the WebRTC Data Channel.
- On the client side, their Service Workers will be listening for this message. Upon receiving a HOST_NAVIGATE event, the client's Service Worker will use the chrome.tabs.update(tabId, { url: newUrl }) API to programmatically change the URL of the tab where the session is active. This will cause the client's browser to automatically navigate to the same page as the host.
- **Security and Robustness:** A critical part of this implementation is a security check within the client's Service Worker. Before executing the chrome.tabs.update command, the worker must validate the incoming URL. At a minimum, it should check that the new URL's origin (e.g., https://www.youtube.com) matches the previous URL's origin. This prevents a malicious or compromised host from redirecting clients to an arbitrary or harmful website. The logic can also be expanded to only allow navigation to a pre-approved whitelist of known streaming service domains, providing an additional layer of security.

## **Section 4: The Claude Code Execution Strategy**

This section outlines the methodology for directing the Claude Code AI agent to build Watch Together. The strategy is designed to maximize the agent's effectiveness by providing clear goals, structured tasks, and automated feedback, mitigating known failure modes of LLM-based coding.6

### **4.1 The CLAUDE.md Project Constitution**

The cornerstone of the AI development process is the CLAUDE.md file, which will be placed in the root of the repository. This file serves as the project's "constitution" or persistent system prompt, providing the AI with foundational knowledge and immutable rules for the entire duration of the project.4 The agent will be instructed to consult this file for guidance.

The verbatim content of CLAUDE.md shall be as follows:

# **Watch Together: AI Development Constitution**

## **1\. Mission Statement**

Your primary goal is to develop and deploy **Watch Together**, a robust, multi-site video synchronization browser extension. You will build this project according to the official Design Document. Your success is measured by the robustness and reliability of the core synchronization features and the modularity and maintainability of the code you produce.

## **2\. Architectural Principles**

You must adhere to the three core architectural pillars defined in the Design Document:

1. **AI-Governed Monorepo:** All code must exist within the pnpm \+ Turborepo monorepo structure. You must use the shared packages (@repo/types, @repo/eslint-config-custom, @repo/tsconfig-custom) to ensure consistency.
2. **Serverless Signaling Backbone:** The backend must be a Cloudflare Worker using Durable Objects for WebSocket-based WebRTC signaling.
3. **Peer-to-Peer Data Fabric:** All high-frequency sync and navigation events must be sent over a direct WebRTC Data Channel between peers, not through the server.

## **3\. Technology Stack**

You must use only the following technologies for their specified purposes:

- **Package Manager:** pnpm
- **Build System:** Turborepo
- **Language:** TypeScript (for all logic)
- **UI Framework:** Svelte (for the popup UI)
- **Backend:** Cloudflare Workers with Durable Objects and WebSockets
- **P2P Communication:** WebRTC Data Channels
- **Testing Framework:** Playwright

## **4\. Immutable Coding Conventions**

These rules are non-negotiable.

- **Code Language:** All JavaScript/TypeScript code must be written in TypeScript.
- **Type Safety:** Strive for strict type safety. Use the shared types from @repo/types. Avoid using any unless absolutely necessary and justified.
- **Modularity:** You MUST NOT write all logic in a single file or function. Decompose complex problems into smaller, single-responsibility functions and modules. Adhere strictly to the package structure defined in the design doc.
- **File Naming:**
  - Svelte components: PascalCase (e.g., RoomManager.svelte)
  - TypeScript files (non-components): camelCase (e.g., syncLogic.ts)
  - Playwright test files: \*.spec.ts (e.g., sync.spec.ts)
- **Exports:** Do not use default exports. Use named exports exclusively to improve clarity and refactorability.
- **Documentation:** All public functions, classes, and complex type definitions must have JSDoc comments explaining their purpose, parameters, and return values.
- **Error Handling:** Never let a promise be unhandled. Use try/catch blocks for all asynchronous operations that can fail, such as chrome API calls, network requests, and player adapter interactions. Log errors gracefully.
- **Test-Driven Development (TDD):** For any new feature or bug fix, you must first ask the user to provide the Playwright test that defines the desired behavior. You will then write the implementation code to make that test pass.

## **5\. Interaction Protocol**

- **Clarity and Uncertainty:** If a task is ambiguous, too complex, or conflicts with these rules, you MUST state your uncertainty and ask for clarification. Do not invent a solution or "reward hack" to complete a task you do not understand.6 It is better to stop and ask than to produce incorrect code.
- **Self-Correction:** If I, the user, provide a correction or a new rule, you must ask if you should update this CLAUDE.md file to remember it for the future.4 This is how you will learn and adapt to the project's needs.

### **4.2 Phased Development and Prompt Engineering**

A single, high-level prompt like "build the watch party extension" is likely to cause the AI to produce low-quality or incomplete code.6 The development process will therefore be broken down into distinct, sequential phases. Each phase will represent a new "primary task" for the agent, providing a clear and achievable goal. This approach mimics an agile development process, building the application on a stable, tested foundation at each step.5

For particularly complex tasks within a phase, such as implementing the WebRTC state machine, the prompt will include keywords like "think harder" or "ultrathink" to allocate more computational budget to the agent, encouraging it to evaluate alternatives more thoroughly.27

The following table outlines the phased development plan and provides sample prompts for the human operator to use.

| Phase                        | Goal                                                                | Sample Prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :--------------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1\. Scaffolding**          | Create the complete monorepo structure and all configuration files. | "Your first task is to scaffold the project. Following the design document, use pnpm and Turborepo to create the monorepo structure. Create all specified directories and packages (apps/extension, packages/adapters, etc.). Initialize each package with a package.json file and install the initial dependencies. Create the shared @repo/tsconfig-custom and @repo/eslint-config-custom packages and the root turbo.json file."                                               |
| **2\. Backend**              | Implement the complete WebRTC signaling server on Cloudflare.       | "Now, let's build the backend. Create a new Cloudflare Worker project. Write the code for a WebSocket server. Implement a Durable Object class named RoomState that manages WebSocket connections for a single room. This object must be able to receive signaling messages and relay them to the correct target peer, according to the WebRTC signaling flow in the design doc."                                                                                                 |
| **3\. Extension Core**       | Build the non-functional skeleton of the Chrome extension.          | "Begin work on the apps/extension package. Create the manifest.json file with the necessary permissions. Implement the Service Worker (background/main.ts) to manage the WebSocket connection to the signaling server we just built. Create a basic Svelte popup that allows a user to input a room ID and click a 'Connect' button which sends a message to the Service Worker."                                                                                                 |
| **4\. Adapter Framework**    | Build the foundational video control system.                        | "Now, focus on the packages/adapters package. First, define the IPlayerAdapter TypeScript interface as specified in the design doc. Next, implement the GenericHTML5Adapter.ts. This adapter should find a standard \<video\> element on a page and implement all methods of the IPlayerAdapter interface using the standard HTMLMediaElement API."                                                                                                                               |
| **5\. Feature Logic**        | Implement the core video synchronization logic.                     | "ultrathink. This is a complex task. Let's implement the core synchronization logic. In the Service Worker, write the logic to establish a full WebRTC peer-to-peer connection using the signaling server. Implement the host/client hierarchy. The host should use the GenericHTML5Adapter to get its state and broadcast HOST_STATE_UPDATE events over the WebRTC data channel. Clients must listen for these events and command their own adapters to match the host's state." |
| **6\. Testing & Refinement** | Add a new adapter using the TDD workflow.                           | "We will now add support for Netflix using our TDD workflow. First, write a new Playwright test file netflix.spec.ts. The test should navigate to a Netflix video, have two users join a room, and assert that when the host seeks the video, the client's video also seeks to the same time. This test MUST fail initially. Run the test to confirm failure."                                                                                                                    |
| **7\. Implementation**       | Make the failing test pass.                                         | "The test netflix.spec.ts has failed as expected. Now, create and implement the NetflixAdapter.ts file. Use the window.netflix.appContext object to control the player. Modify the content script loader to inject this new adapter on netflix.com. Your implementation is complete when the netflix.spec.ts test passes."                                                                                                                                                        |

### **4.3 Automating Quality with Claude Code Hooks**

To enforce rules deterministically and provide immediate, automated feedback to the AI agent, the project will leverage Claude Code hooks.29 These are user-defined shell commands that execute at specific points in the agent's lifecycle, turning suggestions from the

CLAUDE.md file into enforced, app-level behavior.30

The project's hook configuration will be defined in .claude/settings.json:

JSON

{  
 "hooks":  
}

The second hook in this configuration establishes the critical **TDD Feedback Loop**. When the AI agent is prompted to implement or fix an adapter (e.g., NetflixAdapter.ts), it will edit the file. Immediately upon completion of the edit, the PostToolUse hook will trigger. It will identify the corresponding test file (e.g., tests/netflix.spec.ts) and execute it using Playwright. The output of the test run—whether it passes or fails, along with any error messages—is automatically fed back into the conversation with the agent. This creates a tight, self-correcting loop where the AI writes code, receives immediate, objective feedback on its correctness, and can iterate until the tests pass, all without manual intervention from the human operator. This automates the "verification" step of the TDD cycle.

## **Section 5: Comprehensive Testing with Playwright**

A robust automated testing suite is non-negotiable for a project of this complexity, especially one developed by an AI. Playwright is selected for its powerful features, including cross-browser support, excellent debugging tools like the Trace Viewer, and first-class support for testing Chrome extensions.31

### **5.1 Test Environment and Configuration**

Testing a Chrome extension requires a specific setup to launch a browser instance with the extension pre-loaded. This will be managed using Playwright's test fixtures, which provide a reusable setup context for tests.31

A tests/fixtures.ts file will be created to define a custom test object that handles this setup automatically for every test case.

```TypeScript

// tests/fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export const test \= base.extend\<{
 context: BrowserContext;
 extensionId: string;
}\>({
 context: async ({}, use) \=\> {
 const pathToExtension \= path.resolve('apps/extension/dist'); // Assumes a build step places the extension here
 const context \= await chromium.launchPersistentContext('', {
 headless: false, // Set to true for CI environments
 args:,
 });
 await use(context);
 await context.close();
 },
 extensionId: async ({ context }, use) \=\> {
 // For Manifest V3, the background script is a service worker.
 let \[background\] \= context.serviceWorkers();
 if (\!background) {
 background \= await context.waitForEvent('serviceworker');
 }

    const extensionId \= background.url().split('/');
    await use(extensionId);

},
});

export const expect \= test.expect;
```

This fixture ensures that every test has access to a browser context with the extension loaded and the unique extensionId, which is necessary for navigating to extension pages like the popup.

### **5.2 Test Suite Design**

The test suite will be organized into three categories to cover all aspects of the application's functionality.

- **End-to-End (E2E) Tests:** These tests simulate a full user journey from start to finish.
  - room.spec.ts: This test will launch two separate browser contexts. User A will create a room. User B will join that room using the ID. The test will then inspect the popup UI in both contexts to assert that each user can see the other in the participant list.
  - sync.spec.ts: This is the most critical E2E test. It will load two users into a session on a local test page containing a standard \<video\> element. It will then programmatically control the host's video (play, pause, seek) and assert that the client's video element's state (paused property, currentTime property) matches the host's state within an acceptable tolerance.
- **Integration Tests:** These tests verify the interaction between different parts of the system.
  - navigation.spec.ts: This test will focus exclusively on the 'Follow the Host' feature. The host will navigate from a local test-page-1.html to test-page-2.html. The test will assert that the client's browser context also receives the command and successfully navigates to test-page-2.html.
  - signaling.spec.ts: This test will mock the WebSocket connection and verify that the Service Worker sends the correct sequence of signaling messages (offer, answer, candidate) when attempting to establish a WebRTC connection.
- **Adapter-Specific Tests:** These are highly targeted tests that run against live (or carefully mocked) versions of streaming websites to validate individual adapters.
  - youtube.spec.ts: This test will navigate to a specific YouTube video URL. It will use Playwright locators to interact with the YouTube player (e.g., clicking the play button) and assert that the YouTubeAdapter correctly fires the onPlay event.
  - netflix.spec.ts: This test will navigate to a Netflix video. It will execute JavaScript in the page context to call the seek method on the NetflixAdapter and then use locators to verify that the player's time display has updated correctly. These tests form the core of the TDD loop for adapter development.

### **5.3 AI-Driven Test-Driven Development (TDD) Workflow**

The synergy between the AI agent, the human operator, and the automated testing suite is realized through a specific TDD workflow. This process ensures that code is written against a clear, testable specification and is verified automatically.5

The step-by-step workflow for the human developer managing the AI is as follows:

1. **Define the Feature Slice:** The operator identifies a small, testable unit of work. For example: "Implement the 'pause' functionality for the YouTube adapter."
2. **Prompt for the Test:** The operator issues a prompt to the AI to write the test first.
   - **Prompt:** "Claude, using our Playwright fixtures, please add a new test case to youtube.spec.ts. This test should simulate a client sending a CLIENT_REQUEST_PAUSE message to the host. It should then assert that the host's YouTubeAdapter calls the pauseVideo() method on the YouTube player. This test should fail because the logic is not yet implemented."
3. **Run and Confirm Failure:** The operator runs the new test (or lets the hook do it automatically if the file was just created). The test fails as expected, which confirms the test itself is valid. The failure output is visible to the AI.
4. **Prompt for the Implementation:** The operator now prompts the AI to write the code to make the test pass.
   - **Prompt:** "The test has failed as expected. Now, modify the Service Worker and the YouTubeAdapter.ts to correctly handle the CLIENT_REQUEST_PAUSE message and implement the pause functionality. Your goal is to make the test in youtube.spec.ts pass."
5. **Verify with Hooks:** The AI edits the necessary files. The PostToolUse hook automatically re-runs the youtube.spec.ts test. The result is fed back to the AI. If it fails again, the AI can use the error message to debug and try again. This loop continues until the test passes.
6. **Commit the Work:** Once the test passes, the operator issues the final command.
   - **Prompt:** "The test is now passing. Excellent. Please commit the changes to YouTubeAdapter.ts, the service worker, and youtube.spec.ts with the conventional commit message: 'feat(youtube): implement pause synchronization via host'." 4

This workflow transforms the development process from a simple instruction-execution model into a robust, self-correcting system where the AI is guided by objective, automated verification at every step.

## **Section 6: Conclusion and Future Enhancements**

### **6.1 Summary**

This document has laid out a comprehensive and expert-level architectural blueprint for Watch Together. The proposed design directly addresses the core challenges of building a robust, cross-platform watch party extension by leveraging a sophisticated, multi-tiered approach. The **Universal Adapter Framework** provides a resilient and extensible solution for video player control, mitigating the risks associated with the lack of public APIs on major streaming platforms. The hybrid backend architecture, combining **Serverless Signaling** with a **Peer-to-Peer Data Fabric**, ensures a highly scalable, low-latency, and exceptionally cost-effective system.

Crucially, the entire project is designed around an **AI-Native Development** methodology. The combination of a structured monorepo, a detailed CLAUDE.md constitution, a phased development plan, and an automated TDD feedback loop using Claude Code hooks and Playwright provides a novel and powerful paradigm for software construction. This approach is engineered to maximize the capabilities of an AI coding agent while implementing guardrails to ensure code quality, consistency, and correctness. The resulting system will not only meet the user's immediate requirements for video and navigation synchronization but will also be built on a foundation that is maintainable, scalable, and prepared for future evolution.

### **6.2 Roadmap for Future Work**

The modular architecture of Watch Together provides a clear path for future enhancements. The following items represent a logical roadmap for expanding the extension's capabilities after the initial version is complete.

- **Expanded Browser Support (Firefox):** The next logical step is to port the extension to Firefox. This will involve creating a separate build target in the monorepo. The primary technical challenge will be adapting the chrome.\* API calls to Firefox's browser.\* namespace. The core logic within the Service Worker, adapters, and UI components should be largely reusable. A dedicated Playwright configuration for Firefox will be required to ensure full test coverage on the new platform.
- **Integrated Chat Feature:** A simple text chat can be implemented with minimal architectural changes. A new message type, such as CHAT_MESSAGE, can be added to the WebRTC Data Channel protocol. Messages sent by any peer would be broadcast to all other peers over the existing P2P connection. The popup UI would be updated with a message display area and an input field to support this functionality.
- **Community-Driven Adapter Expansion:** The adapter framework is inherently extensible. A clear contribution guide can be created, outlining the process for developing new adapters for other streaming sites (e.g., Hulu, Disney+, Amazon Prime Video). This process would involve reverse-engineering the target site's player, implementing the IPlayerAdapter interface, and submitting a corresponding Playwright test. This would allow the community to help expand the extension's compatibility.
- **Advanced UI/UX Refinements:**
  - **Host Transfer:** Implement a mechanism to transfer the "host" role to another user in the room without disconnecting the session.
  - **Playback Rate Controls:** Allow users to set their own local playback speed, or enable a "host-controlled" speed mode.
  - **Latency Compensation:** Implement a more sophisticated latency detection and compensation algorithm to further improve synchronization accuracy, especially for users with disparate network conditions.
  - **UI Polish:** A full design pass on the popup UI to improve aesthetics and user experience, potentially including user avatars, clearer status indicators, and an improved onboarding flow.

#### **Works cited**

1. Netflix API: Exploring Data Integration and Streaming Solutions \- Itexus, accessed July 2, 2025, [https://itexus.com/netflix-api-exploring-data-integration-and-streaming-solutions/](https://itexus.com/netflix-api-exploring-data-integration-and-streaming-solutions/)
2. Unraveling the Hulu API for Developers: Fact or Fiction? \- Reelgood for Business, accessed July 2, 2025, [https://data.reelgood.com/hulu-api-for-developers/](https://data.reelgood.com/hulu-api-for-developers/)
3. The Disney+ API: An Enigma for Developers \- Reelgood for Business, accessed July 2, 2025, [https://data.reelgood.com/disney-api-for-developers/](https://data.reelgood.com/disney-api-for-developers/)
4. Claude Code Top Tips: Lessons from the First 20 Hours | by Waleed ..., accessed July 2, 2025, [https://waleedk.medium.com/claude-code-top-tips-lessons-from-the-first-20-hours-246032b943b4](https://waleedk.medium.com/claude-code-top-tips-lessons-from-the-first-20-hours-246032b943b4)
5. Claude Code: Best practices for agentic coding \- Anthropic, accessed July 2, 2025, [https://www.anthropic.com/engineering/claude-code-best-practices](https://www.anthropic.com/engineering/claude-code-best-practices)
6. Claude Code Best Practices : r/ClaudeAI \- Reddit, accessed July 2, 2025, [https://www.reddit.com/r/ClaudeAI/comments/1lbyyqh/claude_code_best_practices/](https://www.reddit.com/r/ClaudeAI/comments/1lbyyqh/claude_code_best_practices/)
7. Building a Monorepo with pnpm and Turborepo: A Journey to Efficiency | by Vinayak Hegde, accessed July 2, 2025, [https://vinayak-hegde.medium.com/building-a-monorepo-with-pnpm-and-turborepo-a-journey-to-efficiency-cfeec5d182f5](https://vinayak-hegde.medium.com/building-a-monorepo-with-pnpm-and-turborepo-a-journey-to-efficiency-cfeec5d182f5)
8. How we configured pnpm and Turborepo for our monorepo | Nhost, accessed July 2, 2025, [https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo)
9. Modernize Monorepo Structure with pnpm Workspaces and Turborepo · Issue \#278 · openai/codex \- GitHub, accessed July 2, 2025, [https://github.com/openai/codex/issues/278](https://github.com/openai/codex/issues/278)
10. Cloudflare Workers vs Fly.io | srvrlss, accessed July 2, 2025, [https://www.srvrlss.io/compare/cloudflare-vs-fly/](https://www.srvrlss.io/compare/cloudflare-vs-fly/)
11. Introducing WebSockets Support in Cloudflare Workers, accessed July 2, 2025, [https://blog.cloudflare.com/introducing-websockets-in-workers/](https://blog.cloudflare.com/introducing-websockets-in-workers/)
12. Signaling and video calling \- WebRTC API \- MDN Web Docs, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
13. Using WebRTC data channels \- Web APIs | MDN, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)
14. Control Netflix Playback · GitHub, accessed July 2, 2025, [https://gist.github.com/JacobRBlomquist/5bf6b046334ed84bac030260a93567ba](https://gist.github.com/JacobRBlomquist/5bf6b046334ed84bac030260a93567ba)
15. javascript \- Netflix video player in Chrome \- how to seek? \- Stack ..., accessed July 2, 2025, [https://stackoverflow.com/questions/42105028/netflix-video-player-in-chrome-how-to-seek](https://stackoverflow.com/questions/42105028/netflix-video-player-in-chrome-how-to-seek)
16. YouTube Player API Reference for iframe Embeds \- Google for Developers, accessed July 2, 2025, [https://developers.google.com/youtube/iframe_api_reference](https://developers.google.com/youtube/iframe_api_reference)
17. YouTube Iframe API \- nutbread, accessed July 2, 2025, [https://nutbread.github.io/yia/](https://nutbread.github.io/yia/)
18. Video and audio APIs \- Learn web development | MDN, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Video_and_audio_APIs](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Video_and_audio_APIs)
19. HTMLVideoElement \- Web APIs | MDN, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)
20. HTMLMediaElement \- Web APIs | MDN, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
21. Structuring a repository \- Turborepo, accessed July 2, 2025, [https://turborepo.com/docs/crafting-your-repository/structuring-a-repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
22. WebRTC Signaling Overview \- Tutorialspoint, accessed July 2, 2025, [https://www.tutorialspoint.com/webrtc/webrtc_signaling.htm](https://www.tutorialspoint.com/webrtc/webrtc_signaling.htm)
23. Embed a YouTube Video Player using YouTube Iframe API and JavaScript \- Medium, accessed July 2, 2025, [https://medium.com/@raviashar94/embed-a-youtube-video-player-using-youtube-iframe-api-and-javascript-989fe87ee496](https://medium.com/@raviashar94/embed-a-youtube-video-player-using-youtube-iframe-api-and-javascript-989fe87ee496)
24. HTMLMediaElement: play event \- Web APIs | MDN, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play_event)
25. HTML5 Video Events and API, accessed July 2, 2025, [https://www.w3.org/2010/05/video/mediaevents.html](https://www.w3.org/2010/05/video/mediaevents.html)
26. A simple RTCDataChannel sample \- Web APIs \- MDN Web Docs, accessed July 2, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Simple_RTCDataChannel_sample](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Simple_RTCDataChannel_sample)
27. Claude Code: Best practices for agentic coding \- Hacker News, accessed July 2, 2025, [https://news.ycombinator.com/item?id=43735550](https://news.ycombinator.com/item?id=43735550)
28. Claude Code: Best practices for agentic coding \- Simon Willison's Weblog, accessed July 2, 2025, [https://simonwillison.net/2025/Apr/19/claude-code-best-practices/](https://simonwillison.net/2025/Apr/19/claude-code-best-practices/)
29. docs.anthropic.com, accessed July 2, 2025, [https://docs.anthropic.com/en/docs/claude-code/hooks\#:\~:text=Claude%20Code%20hooks%20are%20user,to%20choose%20to%20run%20them.](https://docs.anthropic.com/en/docs/claude-code/hooks#:~:text=Claude%20Code%20hooks%20are%20user,to%20choose%20to%20run%20them.)
30. Hooks \- Anthropic \- Anthropic API, accessed July 2, 2025, [https://docs.anthropic.com/en/docs/claude-code/hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
31. Chrome extensions | Playwright, accessed July 2, 2025, [https://playwright.dev/docs/chrome-extensions](https://playwright.dev/docs/chrome-extensions)
32. What Is Playwright: A Tutorial on How to Use Playwright \- LambdaTest, accessed July 2, 2025, [https://www.lambdatest.com/playwright](https://www.lambdatest.com/playwright)
33. Playwright Tutorial: Experience Testing Browser Extensions \- Testomat.io, accessed July 2, 2025, [https://testomat.io/blog/playwright-tutorial-experience-testing-browser-extensions/](https://testomat.io/blog/playwright-tutorial-experience-testing-browser-extensions/)
34. Setup for Testing Chrome Extensions with Playwright \- DEV Community, accessed July 2, 2025, [https://dev.to/christinepinto/embarking-on-a-playwright-journey-testing-chrome-extensions-9p](https://dev.to/christinepinto/embarking-on-a-playwright-journey-testing-chrome-extensions-9p)
