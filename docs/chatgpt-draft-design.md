# Claude Code Watch Party Extension – Development Plan

## Overview

We propose a full-stack development plan for a **cross-site Watch Party browser extension** enabling synchronized video playback across major streaming platforms (YouTube, Netflix, Hulu, Disney+, HBO Max, Crunchyroll). The project will be implemented entirely by **Claude Code** (an AI coding assistant), following a monorepo structure using **pnpm** and **Turborepo** for efficient multi-package management. The extension will target Chrome (Manifest V3) initially, with a React + Tailwind popup UI and content scripts for video control. A Cloudflare Workers backend will coordinate watch-party sessions via WebSockets and act as a WebRTC signaling server for peer-to-peer sync when possible. Development will be guided by a `CLAUDE.md` file of instructions (serving as the AI’s onboarding manual) and utilize advanced Claude Code features like Context7 (for up-to-date docs) and Hooks (for automating tests, linting, and commit checkpoints) to ensure high code quality.

This plan details the project goals, system architecture, monorepo layout, and a Claude Code-driven workflow (including environment setup, prompt strategy, and automated tooling). By following this plan, the AI assistant will iteratively build a watch-party extension that synchronizes video playback across multiple platforms (similar to how **Teleparty** supports Netflix, YouTube, Disney+, etc.), with all code passing lint checks, unit tests, and end-to-end Playwright scenarios before finalization.

## Goals and Scope

- **Multi-Platform Video Sync:** Support all major video streaming sites (e.g. YouTube, Netflix, Hulu, Disney+, HBO Max, Crunchyroll) for synchronized playback. The extension should work on any site with an HTML5 video player, similar to existing “watch party” tools that synchronize playback across multiple services. Each participant streams their own copy of the video on their own account; the extension only syncs playback states (play/pause, seek, etc.) and navigates to the same content as the host.
- **Chrome Extension (MV3):** Focus on Google Chrome first, using Manifest V3. The extension will include a background service worker, content scripts injected into video pages, and a React-based popup UI styled with Tailwind CSS. Manifest permissions will allow the extension to run on the supported video domains and connect to our backend. (Later, the design can be extended to Firefox and others, but Chrome is the MVP target.)
- **Real-Time Sync via WebRTC Mesh:** Use peer-to-peer WebRTC data channels for synchronizing control signals among participants **when possible** to minimize latency and server load. The Cloudflare Workers backend will serve as a lightweight signaling server to exchange WebRTC offers/answers and ICE candidates, after which peers form a mesh network for direct communication. This approach follows best practices from similar projects – for example, an open-source sync extension initially used WebSocket rooms for basic syncing and planned to add P2P WebRTC for improved performance. Our goal is to incorporate WebRTC from the start for low-latency sync, with the WebSocket server as fallback and for initial coordination.
- **Cloudflare Workers Backend:** Implement the backend on Cloudflare’s serverless platform for global low-latency access. It will handle room management (create/join/leave/delete) and serve as the “single point of coordination” for each watch party room. Cloudflare Workers supports WebSocket servers for real-time messaging. We will likely use **Durable Objects** to coordinate multiple clients in a room – this provides a consistent instance to manage state and messages for each room. The backend will route signaling data (SDP offers, answers, ICE candidates) between peers for WebRTC, and also broadcast control events (play, pause, seek, link updates) via WebSockets to any clients that aren’t on a direct P2P link. In essence, the Worker + Durable Object ensures that all participants in a room stay in sync, even if they connect from different regions (the Durable Object will anchor the session in one location for consistency).
- **User Experience:** The extension’s **popup UI** should be clean and intuitive. It will allow users to create or join a watch party room by ID, show the current **Room ID**, list the **Members** connected, and provide controls: a **“Copy Link”** button to copy an invite link (or just the room code) for sharing, a **“Follow Host Link”** button (if the user is behind or not on the same page as host), an **“Auto-Follow” toggle,** and a **“Leave Room”** button. The “Auto-Follow” toggle determines whether the extension should automatically follow the host’s link changes (when the host navigates to a new video or episode) or whether it should only prompt the user to manually click “Follow Host Link.” This opt-in design ensures no unwanted navigation – members can choose to automatically be taken to whatever the host is watching, or handle it manually.
- **Synchronized Playback Controls:** Once in a room, participants’ video players will be controlled in sync. When the **host** plays, pauses, or seeks the video, all others should mirror those actions nearly simultaneously. The content script on each participant’s browser will listen for these sync commands (from either the WebRTC data channel or fallback WebSocket) and invoke the corresponding video element actions (e.g. call `video.play()`, `video.pause()`, or set the current time). Minor timing differences will be smoothed out by periodically syncing the playback position (the host can broadcast their current timestamp at intervals). The extension will _not_ stream or share video/audio content (each user must have access to the service independently); it only synchronizes control signals and navigational events.
- **No Inline Chat (MVP):** Text chat or voice chat is outside the scope of the MVP. The focus is on robust video synchronization. Users can use separate apps or devices for voice chat if desired (as some users do with Teleparty or similar). Omitting chat simplifies the extension for now – though the architecture (especially using WebRTC) could be extended later to add a text chat channel or even a Matrix/SignalR integration for messaging if needed.
- **Automated Testing with Playwright MCP:** End-to-end testing will be done using Playwright in **MCP (Model Context Protocol)** mode, which allows Claude (the AI) to control a real browser for testing the extension. We’ll write Playwright-based test scenarios (in the `tests` package) to simulate user actions: e.g. open two browser instances with the extension, have one create a room and start a video, ensure the second joins and syncs playback, test toggling auto-follow, etc. Claude Code can execute these via the Playwright MCP plugin – once configured, we can prompt it to open pages or even run automated scripts. For example, after installing the Playwright MCP, we can instruct, _“Use playwright mcp to open two browser instances, install the extension, and join the same room to verify sync”_, and a controlled Chrome window will launch to perform the test. These automated E2E tests ensure our extension works across scenarios and can be run repeatedly as the AI iterates on the code.
- **Claude-Only Implementation:** The entire project will be developed by Claude Code without human-written code. This means our planning must be extremely clear for the AI to follow. We will leverage Claude’s strengths (consistency, ability to follow instructions, and use of tools) to produce production-quality code. The `CLAUDE.md` will serve as the project’s guidelines and must explicitly detail how to set up the environment, how to break down tasks, and how to utilize tools. We will instruct Claude to use **Context7** for retrieving **up-to-date documentation** about any unfamiliar APIs (e.g. Chrome extension APIs, Cloudflare Workers APIs, WebRTC usage, etc.), to avoid relying on outdated training data. (Using Context7 means Claude can pull in fresh docs and code examples on the fly, preventing hallucinated or deprecated API usage.) We will also set up **Hooks** so that Claude automatically runs tests, linters, and even commits code at appropriate checkpoints. This automation will allow Claude to self-verify its output continuously: for instance, a Hook can trigger after file writes to run our lint script and report any issues, or run the test suite and feed results back to the AI. By integrating these into the workflow, we ensure that _“Claude-generated code passes linting, unit tests, and Playwright scenarios”_ as required, with the AI correcting any problems immediately.

## System Architecture

### Browser Extension (Front-End)

The extension consists of several MV3 components working together: a **content script** that runs on video streaming sites, a **background service worker** for centralized event handling and backend communication, and a **popup UI** (a React app) for user interaction.

- **Content Script:** The content script is injected into supported webpages (we will list match patterns in the manifest for URLs of YouTube, Netflix, hulu.com, disneyplus.com, etc., and possibly a catch-all for any page with an HTML5 video). Its role is to interface with the video player on the page. It will find the main `<video>` element (or relevant player API) and listen for events (play, pause, seek, volume change if we choose, etc.). If the local user (who may be the host or just a participant) triggers a video event, the content script will capture it and notify the background script (e.g. via `chrome.runtime.sendMessage` or through a shared context if using MV3 message passing). Conversely, when a sync message arrives (from another user via the backend), the content script will receive a command (from the background or directly if we connect from content script) to control the video element (e.g. pause or set currentTime). We’ll implement logic to prevent feedback loops (e.g. if we programmatically pause the video to sync with host, we should ignore that pause event locally to not rebroadcast).

- **Background Service Worker:** The background script (running as a service worker in MV3) will manage the extension’s core logic and communication. It will maintain the WebSocket (and help set up WebRTC) connection to the Cloudflare Worker backend. When the user creates or joins a room (via the popup UI), the background connects to the backend and sends a message to either create a new room or join an existing one. The background keeps track of the current room ID and the role (e.g. treat the first user as the “host” by default). All incoming messages from the backend will be handled here and dispatched to content scripts or popup as needed:
  - **Sync commands:** e.g. “play at 120s” or “pause” or “seek to 300s” – the background will forward these to the content script of the active tab (using `chrome.tabs.sendMessage` with the details), causing the video to update. If we have multiple participants controlling (could allow co-control, but MVP assume host-only control for simplicity), we might also handle if a non-host tries to control playback (we might either ignore or implement a simple mechanism to elect a new host if needed).
  - **Link/navigation updates:** If the host navigates to a new video or episode (e.g. goes to the next episode on Netflix), we need to inform other clients of the new URL. The content script or background can detect a URL change (perhaps via content script detecting a new video load, or the background using `tabs.onUpdated`). The host’s extension will send the new link (and perhaps title) to the backend, which broadcasts to others. If a member has “Auto-Follow” enabled, the background script on their side will programmatically open the new link (possibly via `chrome.tabs.update` to navigate the tab to that URL) so that their content script can attach to the new page’s video. If Auto-Follow is off, we instead signal the popup UI (e.g. via a message) to light up a “Follow Host” button indicating a new video is available, and the user can click it to trigger navigation. This ensures users aren’t forced into unexpected page loads without consent.
  - **Membership events:** The background can also handle events like new member joined or member left. The backend can broadcast a updated member list or count. We’ll forward that to the popup (which can display the list of members or at least the count). We might assign random usernames or just display part of their session ID – since no authentication, this could be very simple (e.g. “Host” and “Guest 2”, etc.). The popup’s **Members List** will show these. Managing usernames is optional (MVP could just show count or generic labels).

Because MV3 service workers are non-persistent, we must ensure any long-lived connection (WebSocket) is properly handled. MV3 allows persistent WebSocket connections as long as events keep it alive. We will use alarms or message keep-alive if needed to avoid the service worker going idle. (Alternatively, we might consider using the content script for the WebSocket/WebRTC connection to avoid service worker sleep issues; but using the background is cleaner logically. If needed, we’ll use `chrome.webNavigation` or periodic ping messages to keep the service worker alive during an active watch party session.)

- **Popup UI (React + Tailwind):** The popup is the face of the extension for the user. Built with React for rapid development, it will use Tailwind CSS for styling (we’ll include Tailwind in the build configuration for this package). The UI will have:
  - **Room ID display:** If the user is in a room, show the current room code (so they know what to share). Possibly make it copyable.
  - **“Copy Link” button:** This will copy a sharable link to clipboard. The link format could be something like `https://our-backend-domain/join?room=ABC123` or simply the room code text – since our extension must handle join, perhaps just copying the code and instructing the friend to enter it. (If we host a simple static page that can trigger the extension, maybe not needed; MVP can rely on manual code entry by the friend).
  - **Room join/create interface:** If not in a room yet, the popup should show an input to **Enter a Room Code** and a **“Join”** button, as well as an option to **Create New Room** (which generates a new code). After joining, these controls disappear or get replaced by the room info.
  - **Members List:** A simple list (or count) of participants. This can be just text for MVP (e.g. “Host (You), Guest1, Guest2…”).
  - **Auto-Follow toggle:** A checkbox or switch allowing the user to toggle automatic following of host navigation. If ON, whenever host updates the link, this client will auto-navigate. If OFF, the user remains on their current video until they manually click "Follow Host Link".
  - **Follow Host Link button:** Visible (or enabled) only when there is a pending link from host that the user hasn’t followed (i.e., auto-follow was off when host moved to a new video). Clicking it will navigate the user to the host’s current video URL (and then that button can hide again once synced).
  - **Leave Room button:** Allows the user to exit the watch party. This will close connections (WebSocket/RTC), inform the backend (so it can update member list or destroy room if host left), and reset the extension state so the user can potentially create/join another room. Possibly after leaving, the content script might also detach event listeners from the video to avoid stray sync commands. The UI should handle this cleanly (e.g. return to the join/create interface).

All UI components will be built in a modular React fashion (using functional components and hooks). Tailwind CSS will provide utility classes to quickly style the popup (which is essentially an HTML page loaded by Chrome when clicking the extension icon). We’ll configure Tailwind via a `tailwind.config.js` and use PostCSS or the Tailwind CLI to process the CSS during the build of the extension package.

In terms of extension packaging, we’ll ensure the **manifest.json** (MV3) is properly set up: declaring the background service worker script, content script matches and permissions (likely `"permissions": ["tabs", "scripting", "storage"]` for updating tabs and storing settings like auto-follow preference, plus host permissions for the video sites and possibly `"webRequest"` if needed for some sites – but probably not needed for basic functionality). We also need permission to connect to our Cloudflare Worker domain (either as an `<all_urls>` WebSocket connect permission or in content script as an external connectable if using `chrome.runtime.connect` – but simpler is using fetch/WebSocket directly from the extension scripts). If needed, we’ll add the backend URL in `externally_connectable` or use Content Security Policy to allow the wss connection.

Overall, the extension front-end is responsible for capturing user actions and controlling video playback, while delegating networking and coordination to the backend connection managed in the background script. This separation keeps the content scripts lightweight and focused on video control, which is important for maintainability since each streaming site might have slight differences (we might have to include site-specific logic if needed; e.g., YouTube’s video element can be controlled, but Netflix’s player might require a different hook – though usually Netflix uses a standard HTML5 video under the hood that we can control via `video` tag). We will abstract these differences in the content script if necessary so that adding new platforms is straightforward (for MVP, we handle the listed ones, possibly by targeting generic HTMLVideoElement events and seeing if that suffices).

### Cloudflare Worker Backend (Real-Time Signaling Server)

The backend will be a Cloudflare Worker script (written in TypeScript) that implements a WebSocket server and room coordination logic. Its responsibilities include: room creation and lookup, managing lists of clients in each room, forwarding messages between clients (for sync events), and facilitating WebRTC offer/answer exchange for peer connections.

**Room Management:** We will designate a unique identifier for each room (e.g. a short code like 6 alphanumeric characters). When a client wants to create a room, it sends a request (perhaps a special WebSocket message or an HTTP request to the Worker that returns a new room ID). The Worker will generate a room ID (ensuring no collision with an existing active room) and prepare a **Durable Object** instance to back that room. Cloudflare Durable Objects will let us have a singleton per room for coordinating all participants. We’ll implement a Durable Object class (e.g. `RoomDO`) with methods to handle WebSocket connections joining, storing the current state (e.g. current video URL and time), and broadcasting messages. The Worker script’s fetch handler will upgrade WebSocket connections and route each connecting client to the appropriate Room DO based on room ID (often done by including the room ID in the WebSocket URL or as a query param).

**Joining a Room:** When a client wants to join, it will open a WebSocket to the Worker’s URL (for example: `wss://<our-cloudflare-worker-domain>/ws?room={ROOM_ID}`). The Worker’s fetch event will check the `Upgrade: websocket` header and the room param, then forward the connection to the corresponding Room Durable Object. Inside the DO, we’ll accept the WebSocket (Cloudflare provides a `WebSocketPair` for this) and keep track of the connected client (we can store WebSocket objects in a set). We’ll likely assign each client a simple ID (or use a small random token or the WebSocket itself as key) for tracking. The DO can also broadcast a “new member joined” message to existing members (and similarly “member left” on disconnect). For a new joiner, if the room already has a current video (i.e., a host is present and has set a link), the DO should send the latest video URL and playback time to the new client immediately so they can sync to the current state. This ensures late joiners catch up with the host’s current video.

**Leaving & Room Deletion:** We’ll detect when a client’s WebSocket closes (on “close” event in the DO). Remove them from the member list and broadcast an update to remaining members. If a host leaves, we might designate the next person as host (or simply treat the room as ended – for MVP, it might be acceptable that if host leaves, the session ends for everyone). We could either inform others that the host left and they need to create a new session, or promote one of them. Since automatic promotion might cause confusion, MVP might just end the session if host disconnects (popups can handle this by alerting the user). If all clients leave, the DO can either self-delete or reset. Cloudflare will eventually garbage-collect an idle Durable Object, but we can proactively destroy any state if needed.

**Synchronization Messages:** The core function is to relay control commands. These include:

- **Play/Pause:** When the host plays or pauses their video, the content script or background will send a message through the WebSocket: e.g. `{type: "play", currentTime: 123.45}` or `{type: "pause", currentTime: 123.45}`. The DO receives this and broadcasts it to all other clients in the room. Upon receiving such a message, the clients (if not host) will execute the action on their video element. We include the current timestamp to allow clients to adjust precisely (especially for play – clients might need to jump to that timestamp then play, to account for any drift).
- **Seek:** If the host seeks to a new time (scrubbing or clicking a different point), send `{type: "seek", currentTime: X}`. Other clients will accordingly seek their video to X. We might throttle or debounce seeks if a user is scrubbing a lot; but typically, jumping in one go is fine.
- **Link Change:** If host navigates to a new video URL, send `{type: "link", url: "<new_link>", title: "...", currentTime: 0}` (or currentTime if continuing a video series). Other clients with auto-follow on will navigate. The DO could mark the new URL as the room’s current video state.
- **Meta updates:** Optionally volume change events if we choose to sync volume (not necessary, possibly intrusive – probably skip syncing volume in MVP). We also might ignore minor events like buffering status.
- **Chat messages:** (Out of scope for MVP, but the protocol could be extended with `{type:"chat", message:"..."}` later, and DO would broadcast to all, etc.)

All messages can be encoded as JSON strings for simplicity. We’ll define these message types and structures in the `shared` package so both extension and server agree on format.

**WebRTC Signaling:** This is the more complex part. To use WebRTC peer-to-peer mesh, peers need to exchange connection data through a signaling server (here, our Cloudflare Worker/DO). The flow will be roughly:

1. When a second participant joins the room (meaning we have at least two), the DO will facilitate a handshake between them. We can either have the **host** act as the initiator (offerer) and the new member as answerer, or vice versa. A simple approach: the DO, upon a new client joining, sends a message to the host (or to all existing clients) indicating a new peer (“need to connect to new peer ID X”). Then each existing client can start a WebRTC PeerConnection with the new one. Alternatively, the new client could initiate to everyone. Mesh means for N participants, each pair needs a connection; but we can simplify by doing incremental connections on each join event:
   - For example, new client joins, DO instructs _new client_ to start offers to each existing client (the DO will send the list of current peer IDs to the newcomer). The new client then creates a PeerConnection for each existing peer and generates an SDP offer. Each offer can be sent via the DO as a message targeted to the respective peer.
   - The existing peers receive the offer via DO, create their PeerConnection, set remote offer and create an answer, which is sent back via DO to the new peer.
   - Exchange ICE candidates similarly via DO until connections succeed.

2. To implement this, the extension background or content script will include a WebRTC handler. Likely, we implement it in the background script (since it can coordinate multiple peer connections and is not tied to a specific page). We will use the WebRTC Data Channel for our sync messages. For efficiency, perhaps only one data channel per connection is needed. All sync commands can be sent over it.
3. Once a mesh is established, when the host sends a command, instead of going to the server and then to peers, the host could directly send it over each data channel to each peer. However, to keep things simpler, we might _initially_ still broadcast via the server (especially if mesh logic is complex or in case mesh fails). But since the goal is “when possible, use WebRTC mesh,” we should implement at least basic P2P: for small groups the mesh network should work. Perhaps we do both – use WebRTC for actual sync messages, but still keep the WebSocket as a backup or for room management.
4. If a new peer joins later, a similar handshake must occur with all existing peers. Each pair of peers that haven’t connected must exchange offers. This can be an iterative process.
5. We should consider using a known library or approach. We might take inspiration from **P2PCF** (an open source library using Cloudflare Workers for WebRTC signaling) which uses minimal signaling messages and even can move some signaling through data channels after initial connect. We won’t use it directly (since Claude will implement from scratch), but the design can be similar:
   - Use a common STUN server (e.g. Google’s `stun.l.google.com:19302`) and possibly a fallback TURN (maybe a public one or allow configuration) for NAT traversal.
   - Each room acts like a “channel” where peers announce themselves and negotiate connections.
   - We ensure the Worker doesn’t have to relay all video sync traffic – once data channels are up, those messages go directly peer-to-peer, reducing server burden.

For MVP, we will implement WebRTC datachannels but also ensure if it fails or if a user’s environment doesn’t allow P2P (strict NAT, etc.), the WebSocket remains as a fallback path so sync still works (albeit with a bit more latency). In practice, given a small group, even pure WebSocket (centralized) would suffice (as that reddit author did initially), but our design aims to be forward-looking by using mesh for efficiency.

**Security & Privacy:** Our extension will not handle sensitive user data, but we should still design with privacy in mind:

- The content of synchronization messages is just timestamps and video URLs, which might contain video IDs (e.g. YouTube IDs or Netflix title IDs). We should treat room communications as ephemeral and not store them persistently on the server beyond what’s needed for realtime sync.
- Cloudflare DOs will keep data in memory only; once a room is over (no participants), we can discard the state.
- We will not implement authentication in MVP (rooms are protected by knowing the unique code). Codes should be sufficiently random to prevent guessing (6-8 character alphanumeric). We might implement simple rate-limiting or monitoring on the Worker to prevent abuse (like someone trying to brute-force room IDs).
- The extension should clearly indicate the room code and when it’s actively syncing (so user knows they are in a session). A future improvement could allow setting a nickname for better identification of members, but initially it’s not critical.

**Scalability:** Using Durable Objects means each room’s messages are routed through a specific Cloudflare data center location (where the DO instance lives). This is fine for small groups (the latency is still low, likely <50ms if regionally localized). Since video is not relayed, bandwidth usage is minimal (small JSON messages). Each WebSocket connection does count against Cloudflare limits, but they are reasonably high. We should ensure to close connections properly on leave to avoid leaks. Cloudflare Workers support thousands of concurrent sockets, and DOs can handle many, but realistically a watch party likely has maybe 2-10 people. Our design can handle that easily. If needed, multiple rooms naturally distribute across DO instances.

### Shared Code (Types & Utilities)

The `shared` package will house common TypeScript types, interfaces, and utility functions that are used by both the extension and the backend. By centralizing these, we ensure consistency (e.g., the shape of a sync message or the definition of a room ID, etc., is the same everywhere). Key contents include:

- **Message Interfaces:** Define TypeScript interfaces or type unions for the messages exchanged between client and server, and between peers. For example:

  ```ts
  interface PlayMessage { type: 'play'; currentTime: number; }
  interface PauseMessage { type: 'pause'; currentTime: number; }
  interface SeekMessage { type: 'seek'; currentTime: number; }
  interface LinkMessage { type: 'link'; url: string; title?: string; currentTime: number; }
  interface SignalOffer { type: 'offer'; from: string; to: string; sdp: string; }
  interface SignalAnswer { type: 'answer'; from: string; to: string; sdp: string; }
  interface SignalCandidate { type: 'candidate'; from: string; to: string; candidate: string; }
  // etc.
  type RoomMessage = PlayMessage | PauseMessage | SeekMessage | LinkMessage | SignalOffer | SignalAnswer | SignalCandidate | ...;
  ```

  Both the Worker and extension will use these types. The extension background will create these objects and serialize to JSON to send via WebSocket or DataChannel, and the Worker/DO will parse JSON back into these types. This reduces errors in message handling. We can also include helper functions, e.g. `isSignalMessage(msg: RoomMessage): msg is SignalOffer|SignalAnswer|SignalCandidate` to help route signaling vs sync.

- **Utility Functions:** For example, a function to generate a new room code (random string). Or a utility to format time or compare timestamps with some tolerance (maybe to decide if a resync is needed). We might also add a debug utility that logs messages in development mode (to help during testing). Another utility might be for the extension content script to find the main video element on a page – perhaps scanning for the largest `<video>` element or specific site logic (like on YouTube, use `document.querySelector('video.html5-main-video')`). These can be shared if multiple scripts need them (though likely mostly used in content script context).

- **Config Constants:** e.g. the backend WebSocket URL, default STUN server list for WebRTC, etc. It’s helpful to have these in one place. The extension might import the WS URL from shared, so that we don’t duplicate it. If the backend domain changes, we update in one spot.

- **Types for State:** We might define types for the extension’s internal state (like an interface for “RoomInfo” with fields like roomId, isHost, members list, currentVideoLink, etc.). Such types could be shared if in future we had multiple frontends or just to ensure consistency in how we handle state.

The `shared` package will be a simple library with no side effects. It can be built to CommonJS/ESM so that both Node (for Worker) and browser can import it. This package increases maintainability and is critical for Claude to avoid mismatched assumptions between different parts of the codebase.

### End-to-End Testing (Playwright MCP)

The `tests` package will contain our end-to-end test suite, primarily using Playwright. We will leverage the Playwright **MCP server** integration with Claude Code to automate browser interactions during development. By adding the Playwright MCP (e.g. via `claude mcp add playwright ...` as per Simon Willison’s guide), the AI can directly launch and control a browser to run our tests.

We will write test scripts (possibly as regular Playwright test files in TypeScript, using the Playwright Test runner) that cover key user flows:

- **Basic Sync Test:** Launch two browser contexts (or two separate user profiles to simulate different users). In one, go to YouTube and play a specific video, create a watch party (the extension returns a room code). In the other, open YouTube (or an arbitrary page), enter the code in the extension popup to join. Assert that the second browser navigates to the same YouTube video URL (if auto-follow on) or at least gets the prompt. Then assert that when the first user hits play, the second’s video starts playing within a short delay. Test pausing, seeking, and ensure the second follows. This test ensures the core functionality (play/pause seek sync) works.
- **Auto-Follow Toggle Test:** Test that when auto-follow is off, if the host changes video, the follower doesn’t automatically navigate, but once the “Follow Host Link” button is clicked, it then navigates. We can automate clicking the toggle in the popup (the extension’s UI might need to be interacted via the extension’s DOM – Playwright can click extension UI or possibly open the extension popup with some Chrome command. Alternatively, we might simulate the internal state by messaging the background directly, but better to test actual UI if possible).
- **Multi-user test:** Perhaps simulate three users to test the WebRTC mesh logic. E.g., create room with host, join with user2 and user3. Ensure all three receive play/pause events. This can test that messages aren’t just point-to-point but reaching everyone (the DO should broadcast to all, or the mesh should propagate to all).
- **Edge cases:** e.g. host leaves – ensure others handle it (maybe out of scope for automated test if we simply end session). Or test that non-host actions are either ignored or also broadcast properly if we allow (maybe we disallow non-host control for MVP).
- **Platform differences:** Ideally test on at least YouTube (public content) and maybe a second platform like a free video on Crunchyroll or a trailer on Disney+ (something not behind a login) to ensure content script works on different sites. However, many services require login. We might rely on manual testing for those, or allow the tester to log in manually (the MCP approach allows manual login – it opens a real browser, and we can instruct the tester to log in). For automated testing, YouTube is easiest because no login for general videos.

We will integrate these tests into the development flow. Claude, using MCP, can run them at will. For example, after implementing a feature, Claude can be prompted: _“Run the Playwright test suite to verify all scenarios pass.”_ The AI will then likely execute a command to run `pnpm test` or similar, and using Playwright MCP it can even open browsers to step through tests. If any test fails, the output will be fed back, and the AI should then debug and fix the code. This aligns with our goal of self-testing and iterative refinement. The use of MCP means that even if the AI needs to perform interactive steps (like logging into a streaming service for a test), we can handle that by having a human (the developer) intervene at that moment or by providing test accounts. However, since MVP doesn’t include automated login flows, we’ll stick to tests that don’t require credentials (YouTube public videos, or possibly use some public domain video site for generic testing).

In addition to E2E tests, we will have **unit tests** for critical functions. For example, in the `shared` package, if we have a utility function (say, one that finds the main video element given a variety of selectors), we can write a small Jest test for it. Or test that our message encoding/decoding works (though trivial). The extension’s React components can have simple rendering tests if desired, and the backend’s room logic (perhaps tested via a simulated Durable Object environment or just by calling methods). Those unit tests will live either in each package or in a combined `tests` package. To keep things simple, we might put unit tests alongside code (like `extension/src/__tests__/*.ts` and run via Turborepo), but for organization the `tests` package might also contain integration tests that spin up parts of the system.

By the end, **all tests must pass and all code must be lint-clean** before we consider the MVP complete. This criterion will be enforced by Claude Code’s workflow (discussed next) – using Hooks to run linting and tests automatically ensures that any regression is immediately caught and fixed, and only then will Claude commit the changes.

## Monorepo Structure

We will use a **pnpm workspace** and **Turborepo** for a structured monorepo, keeping all sub-projects in sync. The repository will be organized as follows:

```
watch-party-monorepo/
├─ turbo.json           # Turborepo configuration for build/test pipelines
├─ package.json         # Workspace root, with pnpm workspaces and dev dependencies (e.g. eslint, prettier, turborepo)
├─ pnpm-workspace.yaml  # Lists packages/*
└─ packages/
    ├─ extension/       # Browser extension (MV3) project
    │   ├─ src/
    │   │   ├─ content/               # Content script source files
    │   │   ├─ background/            # Background service worker source
    │   │   ├─ popup/                 # React components for popup UI
    │   │   ├─ styles/tailwind.css    # Tailwind base styles (if needed)
    │   │   └─ index.tsx              # Popup entry (React render)
    │   ├─ public/ or dist/           # Static files like icon, possibly an HTML for popup if not using React injection
    │   │   └─ manifest.json          # Extension manifest v3
    │   ├─ package.json              # extension package dependencies (React, Tailwind, etc.)
    │   └─ tsconfig.json             # TypeScript config for extension
    ├─ server/          # Cloudflare Worker backend
    │   ├─ src/
    │   │   ├─ index.ts              # Main Worker script (entry point, fetch handler)
    │   │   ├─ room.ts               # Durable Object class (Room coordinator)
    │   │   └─ types.ts              # (Could also import from shared, or define DurableObject types)
    │   ├─ wrangler.toml            # Cloudflare Wrangler config (for deploying and DO binding)
    │   ├─ package.json             # server package deps (maybe none beyond dev types)
    │   └─ tsconfig.json
    ├─ shared/          # Shared types & utilities
    │   ├─ src/
    │   │   └─ index.ts             # Exports all shared functions/types
    │   ├─ package.json             # possibly no deps, just for building types
    │   └─ tsconfig.json
    ├─ specs/           # Claude task specifications and prompts
    │   ├─ 01-extension-scaffold.md  # Example: spec for setting up extension baseline
    │   ├─ 02-backend-scaffold.md    # spec for backend baseline
    │   ├─ 03-video-sync-feature.md  # spec for implementing sync logic
    │   ├─ 04-ui-implementation.md   # spec for popup UI
    │   ├─ 05-webrtc-integration.md  # spec for WebRTC signaling
    │   ├─ 06-testing.md             # spec for writing tests
    │   └─ ... (etc., modular tasks)
    ├─ tests/           # End-to-end and integration tests
    │   ├─ e2e/
    │   │   └─ watchparty.spec.ts    # Playwright test scenarios
    │   ├─ unit/
    │   │   └─ someUtil.test.ts      # Example unit tests
    │   ├─ playwright.config.ts      # Playwright configuration
    │   ├─ package.json              # test runner deps (Playwright, etc.)
    │   └─ tsconfig.json
    └─ CLAUDE.md       # Project instructions for Claude (AI developer)
```

Some notes on this structure:

- We use one **Turborepo** to orchestrate builds. For example, we might define tasks: `build:extension`, `build:server`, `build:tests` and so on, and turborepo can run them in parallel or in order if dependencies exist (the extension might depend on shared, server depends on shared, tests depend on others). During development, we can run `pnpm dev` to watch changes in extension and rebuild, etc., though given MV3 extension, hot-reload is tricky; we may just rebuild and manually reload the extension in Chrome for testing.
- **PNPM workspaces** allow all packages to share node_modules efficiently and reference each other via symlinks. E.g. the extension code can import from `shared` as if it's an installed package (we ensure `shared` has a name and version in its package.json, and extension’s package.json lists it as a dependency).
- The `extension` package will include build tooling: likely Vite or webpack configuration to bundle the React popup and content scripts. We can use Vite since it’s fast and easily configures for Chrome extensions (with some plugins or custom config for manifest and multiple entry points). We will configure Vite to output the extension files (JS/CSS) into a `dist` folder that mirrors an extension directory structure. The manifest.json can be either static in `public/` or generated via a Vite plugin. Tailwind integration means adding the Tailwind PostCSS plugin and including the `tailwind.css` in the popup bundle.
- The `server` package might not need a bundler if Cloudflare Workers can use modules directly. However, Cloudflare’s build (via Wrangler or the newer `workerd` system) may expect a single bundle. We might just use esbuild or even rely on Wrangler to bundle the worker. In Claude’s context, we might have it use a simple build script or maybe use Vite here too (Vite can build for workers).
- We’ll have a **wrangler.toml** in server/ to define the Durable Object binding (e.g.:

  ```toml
  [[durable_objects]]
  bindings = [{ name = "ROOM_DO", class_name = "RoomDurableObject" }]
  ```

  and script name, account ID, etc. This is needed to run/deploy the worker on Cloudflare. For local development, we might use Miniflare (which simulates DOs and WS).

- The `specs` directory contains **Modular Claude task specs** – essentially this is our way of breaking down the development work for the AI. Each file will outline a task or milestone (for example, setting up project scaffolding, implementing a particular feature, etc.). Claude Code can be directed to open and follow these specs one by one, ensuring a structured approach. This modular strategy aligns with Claude Code’s strength in planning and executing stepwise. By reviewing and adjusting a plan upfront, then coding, we reduce mistakes and refactoring. Each spec can include acceptance criteria (like “tests X, Y should pass” or “code should build without errors”) which Claude will aim to satisfy before moving on. This is essentially our way of encoding the plan-first-code-second tip directly into the workflow.
- The `tests` package has its own Playwright config to launch browsers. We might configure it to use a persistent context if needed for extension (to load the unpacked extension into the test browser). Playwright can launch a Chromium instance with a given extension path (using `args: ['--disable-extensions-except=path/to/extension', '--load-extension=path/to/extension']`). We can have the build process output the extension to a known folder and then Playwright uses that. These details can be worked out in the test setup.

Finally, `CLAUDE.md` at the root is crucial: it contains the high-level instructions (much of what is written in this plan) for Claude. It will outline rules and custom guidance, effectively programming the AI’s behavior. This includes the development workflow rules (like “always run lint and tests after writing code” or “commit frequently with meaningful messages”). We will now discuss exactly what goes into `CLAUDE.md` and how Claude will utilize Context7 and Hooks.

## Claude Code Development Workflow

Developing this project with Claude Code requires careful setup of the AI’s environment and instructions. We will configure **Claude’s environment** with all necessary tools (Context7, Playwright MCP, etc.) and provide a detailed gameplan via CLAUDE.md. The workflow can be summarized in phases: _Environment Setup_, _Planning & Prompt Strategy_, _Implementation with Hooks & Iteration_, and _Testing & Quality Gates_.

### Environment Setup

To set Claude Code up for success, we need to ensure the development environment (which the AI agent perceives) is configured with the right tools and access:

- **Repository Initialization:** First, create the monorepo structure (as above) with an empty or template project. We will have Claude Code generate the initial scaffolding of files (using the specs or direct commands). After that, install dependencies:
  - Install Node.js (>= 18) and pnpm on the system.
  - Run `pnpm install` at root to install all package dependencies (this will also set up any postinstall, etc.). We’ll ensure packages have proper dependencies listed (e.g. extension needs React, ReactDOM, Tailwind, TypeScript; server needs `@cloudflare/workers-types` for types, etc.; tests need `@playwright/test`).

- **Claude Code CLI/IDE Setup:** We assume usage of either the Claude CLI or an IDE plugin (like Cursor or VSCode Claude extension). We should run the `/init` command in Claude Code to load our `CLAUDE.md` as the primary instruction set. This ensures Claude is aware of our custom rules. For example, lines in CLAUDE.md might include:
  - “Use IDE diagnostics to find and fix errors” (so Claude leverages any TypeScript errors shown).
  - “Always run tests and lint after implementation” – instructing it to self-verify.
  - “Follow the project architecture and specifications in this document closely.”
  - “If documentation is needed for unfamiliar APIs, use Context7 (e.g. write ‘use context7’ in prompt) to fetch latest docs”.
  - We effectively _onboard Claude as a team developer_, telling it our project vision and standards.

- **Adding MCP Tools:** We will enable:
  - **Context7 MCP**: Install or connect the Context7 server. For Cursor/Claude CLI, this might mean editing the MCP config or running a command. (E.g., `npx @smithery/cli@latest install @upstash/context7-mcp` as per Context7 docs, or using their one-click install if in Cursor UI). Once set up, whenever Claude sees "use context7" in a prompt, it can pull in updated library docs. We’ll instruct Claude to use this especially for things like Chrome extension API (Manifest V3 changes, etc.), Cloudflare Workers APIs, and WebRTC usage. By doing so, we avoid outdated information – _“Context7 fetches up-to-date, version-specific documentation and code examples straight from the source — and places them directly into the prompt”_. This is critical since streaming platform APIs and browser APIs can change.
  - **Playwright MCP**: As discussed, integrate Playwright so Claude can control a test browser. Following the example, run `claude mcp add playwright npx '@playwright/mcp@latest'` before starting Claude. Confirm that Claude can use it by a quick test (the example from Simon: _“Use playwright mcp to open a browser to example.com”_ should open Chrome). We might have to explicitly tell Claude to use the Playwright MCP in its first invocation to avoid any confusion. With this ready, Claude can execute our Playwright tests or just open a browser and simulate user actions step-by-step.

- **Project Configuration & Scripts:** Define npm scripts in root or packages for common tasks:
  - e.g. `"lint": "eslint . --max-warnings=0"` (with an ESLint config extending Airbnb or similar in root, including TypeScript plugins).
  - `"test": "turbo run test"` (which could run unit tests via jest and e2e via playwright).
  - `"build": "turbo run build"` etc.
  - In the extension package, a script `"build": "vite build"` and maybe `"dev": "vite build --watch"` or using a dev server if feasible (though for extension one usually rebuilds and reloads).
  - In the server package, a `"build": "wrangler publish"` or `"dev": "wrangler dev"` for local testing. We should configure `wrangler dev` with `--local` to use Miniflare for local, which can simulate Durable Objects and even allow local WebSocket testing at `localhost:8787`. Claude can run these to manually test the backend logic if needed.

- **Cloudflare Account:** For actual deployment, we’d need Cloudflare account and API keys in wrangler, but for development we can mostly use `wrangler dev`. We should put any keys in environment if needed (though not likely needed for dev if using `--local`). Since Claude Code might not handle external deployments itself (without credentials), we focus on local.
- **Dev Dependencies:** Install any needed codegen or lint tools (ESLint, Prettier, Typescript config). Possibly also install `@types/chrome` for Chrome extension types, etc. We will ensure these are part of the pnpm install so that when Claude runs TypeScript build or tsc, it catches type errors properly.

By completing the above, the environment is primed: all code, when written, can be immediately checked by compilers, linters, and executed in tests. Now we detail how Claude should approach the coding.

### Prompt Strategy and Planning

We will direct Claude Code to take a **plan-first, execute-second** approach for each major feature. Initially, we present the entire project plan (this document) to Claude so it has full context. We then use the modular specs to divide work. Likely workflow:

1. **Project Planning:** Ask Claude to summarize the plan and maybe generate a task breakdown if needed. (We already have specs, but Claude’s own planning feature can also verify if our breakdown is logical). Claude Code’s _planning mode_ can create a high-level roadmap by examining the repo and CLAUDE.md. We should verify the plan covers: scaffolding the extension, scaffolding the backend, implementing sync logic, implementing UI, adding WebRTC, writing tests, etc. We’ll adjust if needed. _“Every feature now starts with a plan. The 2 minutes spent planning saves 20 minutes of refactoring later.”_ – we will follow this advice. So before coding each segment, the AI should present what it’s going to do in that segment. We can enforce this by adding a note in CLAUDE.md: “Before writing code for a task, outline the steps/files to change.”
2. **Using Specs:** For each spec in `packages/specs`, we will likely open it with Claude and instruct it to fulfill that specification. For example, a `01-extension-scaffold.md` might say: _“Task: Set up a basic Chrome extension structure with manifest v3, a minimal content script, background script, and popup (placeholder). Ensure it builds and can be loaded into Chrome.”_ It might include some acceptance criteria like manifest fields, etc. Claude will then carry out this task – creating files and writing content. After it finishes, we verify that part (maybe even load extension to see if it appears, run `pnpm run build:extension`). Then move to next spec.
3. **Frequent referencing of docs with Context7:** As Claude works, whenever it’s unsure about something (like the exact manifest fields for MV3, or Cloudflare DO syntax, or WebRTC API usage), we encourage it to explicitly call _“use context7”_. For example, if implementing the manifest, it might do: _`use context7: "Chrome MV3 manifest example with content scripts and background service worker"`_, which would pull relevant documentation into context (like Chrome’s official docs). This ensures accuracy. In our instructions, we will explicitly tell Claude: _“When dealing with external APIs or config formats, retrieve the latest docs via context7”_. This should prevent mistakes such as using deprecated fields. (Recall how this prevents hallucinations.) In fact, we could set a Hook or rule that intercepts certain queries and automatically fetches context7. For instance, in Claude’s Hooks config we might intercept attempts to search code or docs and route to context7. A Reddit user noted _“you can block certain operations and tell it to use an MCP server instead (e.g., rather than searching a GitHub repo use context7)”_. We might not need to force it, but we will emphasize context7’s availability for Chrome extension docs, Cloudflare Workers examples, etc.
4. **Step-by-step Implementation:** Claude will create and edit files as needed. We want to ensure it doesn’t try to do everything in one go and get lost. The plan is to implement incrementally:
   - **Scaffold Phase:** Create the basic file structure and configs (manifest, package.json files, tsconfigs, etc.). Commit checkpoint.
   - **Core Feature Phase:** Implement actual sync logic: maybe start with pure WebSocket syncing first (easier), get that working.
   - **UI Phase:** Build out the React popup and any storage for settings (e.g. storing auto-follow pref in `chrome.storage.local`).
   - **WebRTC Phase:** Add the WebRTC signaling logic to backend and integration in extension (this might be the trickiest; possibly do it after basic sync is working so we have confidence in baseline).
   - **Testing Phase:** Write tests and fix any issues uncovered.
   - At each phase, ensure things compile and tests (if applicable) pass before proceeding.
   - Use context7 whenever needed, e.g., if implementing Durable Objects, fetch Cloudflare Workers DO usage examples (ensuring correct syntax to accept WebSocket in DO, which has some specifics).
   - Use small commits to save progress.

This strategy means Claude is effectively both coder and QA. We should encourage it to _act like it’s a careful developer_. The CLAUDE.md can include guidelines like _“Write code as if you will later read it – clear, commented where needed, and split into logical functions.”_ Claude can also be told to avoid certain pitfalls (like not to include secrets, not to break manifest rules, etc.).

### Hooks for Automation (Self-Testing & Linting)

Claude Code’s new **Hooks feature** will significantly enhance the development loop by automating repetitive checks. We will configure a few hooks in Claude’s settings (likely `~/.claude/settings.json` or in CLAUDE.md if possible via a special command):

- **Post-Edit Hook – Lint & Test:** After Claude uses a file-editing tool (like when it writes or modifies files), trigger our test commands. In the JSON configuration, this might look like:

  ```json
  {
    "hooks": {
      "PostToolUse": [
        {
          "matcher": "Write|Edit|MultiEdit",
          "hooks": [
            { "type": "command", "command": "pnpm run lint && pnpm run test" }
          ]
        }
      ]
    }
  }
  ```

  This means every time Claude finishes writing or editing files, it will automatically run the linter and tests. (We might narrow the matcher to only run tests after certain edits to avoid too frequent triggers, but generally this ensures nothing breaks without us knowing). A similar example was shown by a Claude user who ran a formatting task on every edit – we adapt that to our needs. The effect: Claude will immediately see if it introduced a syntax/style error or if a test fails. It can then address it before moving on. This hook essentially acts as a continuous integration step within the conversation loop.

- **Pre-Commit Hook – Checkpointing:** We want Claude to commit only code that is tested and linted (i.e., a stable checkpoint). We could use a hook to enforce this, or simply rely on the above hook making sure tests run. Another approach: use a **Stop hook** (when Claude finishes thinking or is ready to yield control) to run a quick `pnpm run test` again or alert us if something is pending. But given PostToolUse covers most, a Stop hook might not be necessary. Instead, we may instruct: _“Claude should only invoke the commit command when all tests pass. Otherwise, fix issues first.”_
- **Auto-Commit Suggestion:** We might not automate the commit itself via a hook (since a commit usually requires a message describing changes, which the AI should compose). Instead, we’ll have Claude perform commits as part of its normal operations with our prompting. For instance, after completing a spec and all checks pass, we prompt Claude: _“All tests pass. Please commit the changes with an appropriate message.”_ Claude Code can then use a tool to commit (the AI can generate a commit message summarizing the diff). There is possibly a way to auto-generate commit messages: one could intercept the commit tool use or diff. In fact, advanced Cursor rules mention _creating pre-commit checkpoints and diffing against last stable, auto-suggest rollbacks if coverage drops_. That implies some have automated the verification of code quality before commit. In our case, we’ll keep it simpler: commit only when green.
- **Notification Hooks:** (Optional) We might add a Stop hook to notify when Claude is done or waiting, but that’s more for user convenience (like a sound alert as shown in the Reddit thread). Not essential to development logic.
- **Context7 Hook:** If desired, a hook could intercept Claude’s attempts to search code and reroute to context7. But a gentler way is just to instruct it. Possibly not needed to implement as a hook right now.

These hooks make the development loop efficient: as soon as Claude writes code, it sees the results of running that code. It’s akin to having an always-on **test-driven development** assistant. If a test fails, Claude will analyze the failure (the test output will appear in its context) and then switch back to writing mode to fix it. This may repeat until tests are green. Similarly for lint: if ESLint flags anything, the output will guide Claude to fix style issues (though we will also have Prettier or formatting to minimize style deviations). The net effect is that by the time Claude says a feature is done, it’s already verified.

We should be mindful that running Playwright tests can be time-consuming or could require manual intervention (like login). For our automated tests, we’ll try to design them to run headlessly and quickly. If some tests are slow or require a real browser, maybe skip in hook and run them manually when needed. We could separate quick checks (unit tests, TypeScript type check) to run on every edit, and full E2E tests to run on demand or at commit time. Perhaps refine the hook to run `pnpm run lint && pnpm run test:unit` on every edit, but run full Playwright E2E only when specifically triggered (or via a manual prompt). This is a detail we can adjust as we see fit during development.

Finally, we will add a rule in CLAUDE.md emphasizing that if tests fail, fix them _before proceeding_. Also a rule that if new functionality is added, add corresponding tests (though the specs likely cover writing tests at the end).

### Git Commit and Iteration Workflow

Git will be used as our version control to store each “checkpoint” of the project. Because Claude is the sole implementer, we want a clear history of incremental progress. The workflow is:

- **Small Commits:** Implement each feature or task in a focused manner and commit it. For example, after setting up the initial project scaffold (manifest, basic structure), commit with message “Initialize Chrome extension and Cloudflare Worker project structure”. Then implement the play/pause sync -> commit “Implement basic play/pause sync via WebSocket (host to clients)”. This not only provides a good history, but also if something goes wrong later, we can `git revert` to a known good state. Claude can generate commit messages automatically by summarizing changes (some have even integrated commit message generation in their flow, but Claude can handle it in-proxy).
- **Meaningful Messages:** We instruct Claude to write commit messages that are descriptive of what was done (like a short changelog). Possibly enforce a format (e.g. conventional commits style: “feat(extension): added auto-follow toggle” or simply a sentence). This helps when reviewing the history.
- **Checkpoint Tagging:** Optionally, we could tag certain commits as milestones (like after MVP completion, tag v0.1). But not necessary right now.
- **Commit after Tests Pass:** We will have Claude follow the rule: no committing broken code. Commits represent a stable state (at least passing all current tests and lint). This way the main branch is always working. We can even keep all development on main for now since it’s single-developer (Claude) scenario.
- **Iterative Refinement:** After each commit, proceed to next spec or next part of the plan. If new issues are discovered later, fix and commit as bugfix. Because the AI can forget rules over long sessions, we might reiterate important CLAUDE.md points if needed.
- **Version Control in Claude:** Claude Code likely has internal awareness of the git state; using commands like `git diff` or `git status` might be possible for it to examine changes. We will allow it to use such tools (ensuring in settings that `git` commands are not blocked). In fact, a great practice is to have Claude review its diff before committing to double-check nothing is off. We could instruct it: “After completing a task, do `git diff` to verify changes align with the spec, then commit.”
- **Recovery Plan:** In case Claude goes down a wrong path (maybe implements something incorrectly), we can use git to rollback. Possibly we can set up a checkpoint branch or stash, but simplest is instructing to fix forward or do a `git reset` to last commit if truly needed (with caution). We saw advanced workflows where they suggest rollbacks if test coverage drops below threshold, which implies maintaining checkpoints. Our project isn’t large, so manual oversight is fine, but we mention it so Claude knows it can revert if necessary rather than piling hacks.

Throughout this iterative workflow, **Claude remains the driver** but we (as the user of Claude) supervise high-level direction by providing these instructions and intervening only if it goes seriously astray or needs clarifications.

## Conclusion and Next Steps

By following this comprehensive plan, Claude Code will develop a clean, extensible, and functioning Watch Party extension. The monorepo layout clearly separates concerns (frontend extension, backend server, shared logic, and tests), which not only aids maintainability but also helps the AI to focus on one part at a time. The use of **Context7** ensures Claude always has the latest reference material (no outdated Chrome extension or Cloudflare API usage), and **Hooks** automation ensures that code quality is continuously validated (auto-formatting after edits, running tests on the fly, etc.). Essentially, Claude will be _self-debugging_ its code with minimal human intervention beyond providing the initial specs and guidance.

Once the MVP is completed and all tests pass, the extension can be packaged (we’ll have an output `dist` with the extension files to load in Chrome for final manual testing on real streaming sites). We should manually try a few services (since automated tests for Netflix/Hulu would need auth) to ensure the content script works universally. Assuming success, the project could then be deployed: publish the extension to Chrome Web Store (requires some additional steps like an optimized build, icons, descriptions) and deploy the Cloudflare Worker (via `wrangler publish`). Deployment specifics are beyond development scope, but our design has facilitated it (the Worker is stateless except DO, so Cloudflare deployment should be straightforward).

Finally, the structured Claude.md and spec files we’ve created will serve as documentation for future Claude Code sessions or even for other developers. They describe not only _what_ the system is supposed to do, but _how_ it has been built and tested. This makes onboarding future contributors (human or AI) easier. In summation, this plan leverages state-of-the-art AI-assisted development practices to deliver a cross-site watch party extension that rivals popular solutions (like Teleparty) in capability, with the added benefit of being open and extensible.

**Sources:**

- Teleparty multi-service sync example
- Cloudflare Workers WebSocket coordination (Durable Object advice)
- Synclify (open source watch-party) discussion on WebSocket vs WebRTC approach
- Context7 for up-to-date coding references
- Claude Code Hooks usage examples
- Claude Code best practices (CLAUDE.md and planning)
- Playwright MCP usage in Claude Code
- Cursor rules for pre-commit checkpoints (inspiration for our workflow)
