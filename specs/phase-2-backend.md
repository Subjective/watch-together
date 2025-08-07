# Phase 2: Networking Layer Refactoring

## Objective
Refactor the WebSocket and WebRTC networking layers to be robust, self-contained, and self-healing. This involves creating a dedicated service for room connections and pushing reconnection logic down into the respective managers.

## Rationale
The current networking logic is brittle and spread across the `RoomManager`. Reconnection attempts, peer lifecycle management, and error handling are tangled with other business logic, leading to complex and fragile code. Encapsulating this logic will improve reliability and make the system more resilient to network interruptions.

## Key Actions
1.  **Create `RoomConnectionService.ts`:**
    *   This service will encapsulate the high-level logic for creating, joining, and leaving a room.
    *   It will have a single entry point, like `connectToRoom(roomId, userName, asHost)`, unifying the currently duplicated `createRoom` and `joinRoom` flows.
    *   It will coordinate the `WebSocketManager` and `WebRTCManager` to establish a full connection.

2.  **Refine `WebSocketManager.ts`:**
    *   Implement robust, internal auto-reconnect logic using an exponential backoff strategy.
    *   The manager should handle socket drops transparently and attempt to reconnect without requiring intervention from higher-level services.
    *   It must emit clear, consistent status events (`CONNECTING`, `CONNECTED`, `DISCONNECTED`) that other services can subscribe to.

3.  **Refine `WebRTCManager.ts`:**
    *   Push peer reconnection logic (e.g., ICE restarts) down into the manager. It should internally handle retries for failed connections.
    *   Implement the `TODO` to queue ICE candidates that arrive while the WebSocket is disconnected. The queue should be flushed automatically upon WebSocket reconnection.

4.  **Implement Graceful Auto-Rejoin:**
    *   The `RoomConnectionService` will listen for the `CONNECTED` event from `WebSocketManager`.
    *   Upon reconnection, it will trigger a clean "re-join" sequence: re-authenticate with the server, fetch fresh TURN credentials, and trigger `WebRTCManager` to renegotiate all peer connections.

5.  **Eliminate Offscreen Document Race Condition:**
    *   Ensure the offscreen document required for WebRTC is created and ready *before* any room connection is attempted. This will be part of the extension's startup sequence, eliminating the "port closed" error and the need for a retry queue that was never implemented.

## Acceptance Criteria
- A new `RoomConnectionService` exists and manages the room connection lifecycle.
- The extension can automatically recover from temporary network outages, rejoining the room and re-establishing all P2P connections without user intervention.
- The "port closed" error is no longer possible because the offscreen document is initialized proactively.
- ICE candidates are queued and sent upon reconnection, preventing P2P connection failures during brief network interruptions.
- The main background script's responsibility is simplified to orchestrating the `RoomConnectionService`.
