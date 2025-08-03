# Phase 1: Core Scaffolding & State Management

## Objective

Isolate all extension state management from the monolithic `RoomManager` background script into a dedicated, single-responsibility `RoomStateManager`. This will create a single source of truth for state and lay a clean foundation for subsequent refactoring.

## Rationale

The current `RoomManager` mixes state persistence, business logic, and network handling, making it difficult to maintain. Extracting state management is the first step towards clear separation of concerns. A dedicated state manager simplifies testing, reduces bugs from inconsistent state, and makes the overall architecture easier to reason about.

## Key Actions

1.  **Create `RoomStateManager.ts`:**
    - Define a `RoomStateManager` class.
    - This class will manage all shared extension state, including `currentRoom`, `currentUser`, `isHost`, `followMode`, `controlMode`, etc.
    - It will hold the state in-memory for fast access.

2.  **Implement State Persistence:**
    - The `RoomStateManager` will be solely responsible for reading from and writing to `chrome.storage.local`.
    - Implement a `loadState()` method to initialize state from storage when the extension starts.
    - Implement a `saveState()` method (or use a subscription model) to persist state changes automatically. This should be debounced to avoid excessive writes.

3.  **Define a Clear API:**
    - Provide getter methods for accessing state (e.g., `getCurrentRoom()`, `isHost()`).
    - Provide setter methods for updating state (e.g., `setRoom(room)`, `setFollowMode(mode)`).
    - Implement a subscription mechanism (e.g., `subscribe(callback)`) that allows other modules to react to state changes without direct coupling.

4.  **Refactor Background Script:**
    - Instantiate a single instance of `RoomStateManager` in the main background script.
    - Remove all direct `chrome.storage` calls from the existing `RoomManager`.
    - Replace all direct state property access (`this.currentRoom`) with calls to the new `RoomStateManager` instance.

## Acceptance Criteria

- A new file `packages/extension/src/background/state/roomStateManager.ts` (or similar path) exists and contains the `RoomStateManager` class.
- The `RoomStateManager` handles all serialization and deserialization of state to and from `chrome.storage.local`.
- The main background script no longer contains any direct state management logic and instead delegates all state operations to the `RoomStateManager`.
- All existing unit and integration tests related to state are updated and continue to pass, verifying that functionality (like restoring a session) remains intact.
