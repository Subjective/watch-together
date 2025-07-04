# Phase 2: Backend Signaling Server Implementation

## Objective

Implement the complete Cloudflare Worker-based signaling server with WebSocket support and Durable Objects for stateful room management.

## Key Requirements

- Create Cloudflare Worker with Durable Objects for room state management
- Implement WebSocket connections for real-time communication
- Design room lifecycle management (creation, joining, leaving)
- Implement peer discovery and signaling protocol
- Set up proper error handling and logging

## Detailed Implementation Plan

### 1. Main Worker Script (`apps/backend/src/index.ts`)

- **Replace basic stub** with complete WebSocket-enabled worker
- **Handle WebSocket upgrade requests** using `request.headers.get("Upgrade") === "websocket"`
- **Route connections to Durable Objects** based on room ID from URL path
- **Implement CORS headers** for cross-origin requests from browser extension
- **Add proper error handling** with structured error responses
- **Add request logging** for debugging and monitoring

### 2. RoomState Durable Object (`apps/backend/src/roomState.ts`)

- **Extend DurableObject class** with proper TypeScript types
- **WebSocket connection management**:
  - Accept WebSocket connections via `state.acceptWebSocket()`
  - Maintain active connections map with user metadata
  - Handle connection cleanup on disconnect
- **Room state management**:
  - Track participants (host + clients)
  - Maintain room metadata (ID, name, created timestamp)
  - Handle control mode switching (HOST_ONLY/FREE_FOR_ALL)
- **WebRTC signaling relay**:
  - Route offer/answer/ICE candidate messages between peers
  - Validate message targets and sources
  - Ensure proper message delivery
- **Room lifecycle**:
  - Handle room creation when first user joins
  - Clean up room when last user leaves
  - Implement room timeout for inactive rooms

### 3. Enhanced wrangler.toml Configuration

- **Verify Durable Objects binding** is properly configured
- **Add WebSocket support** in compatibility settings
- **Configure proper build command** and output paths
- **Set environment-specific variables** for dev/prod

### 4. Type System Updates (`packages/types/src/`)

- **Add WebSocket response message types** for server → client communication
- **Add room status response types** (user joined, user left, room created)
- **Add error response types** with proper error codes and messages
- **Ensure all signaling message types** are properly exported

### 5. Error Handling & Resilience

- **Structured error responses** with consistent format
- **Connection timeout handling** for inactive WebSocket connections
- **Rate limiting** for message sending to prevent spam
- **Input validation** for all incoming messages
- **Graceful degradation** when Durable Object is unavailable

## Success Criteria

- ✅ WebSocket connections establish successfully
- ✅ Room creation and joining work properly
- ✅ WebRTC signaling messages relay correctly between peers
- ✅ Proper cleanup when users leave rooms
- ✅ Error handling provides clear feedback
- ✅ Local testing with `wrangler dev` passes
- ✅ TypeScript compilation succeeds with strict mode
- ✅ All message types from @repo/types are properly used

## Implementation Order

1. Update main worker script with WebSocket handling
2. Create RoomState Durable Object with basic connection management
3. Implement WebRTC signaling message relay
4. Add comprehensive error handling
5. Update type definitions as needed
6. Test locally with multiple connections
7. Validate complete room lifecycle functionality

## Key Cloudflare Workers Features Used

- **WebSocket API** for real-time bidirectional communication
- **Durable Objects** for stateful room management
- **Request/Response API** for HTTP endpoints
- **Storage API** for persistent room state if needed
- **Alarm API** for room cleanup timeouts (if implemented)

## Integration Points

- Must work with extension Service Worker WebSocket client
- Must handle all @repo/types SignalingMessage union types
- Must provide foundation for WebRTC P2P connection establishment
- Must support both HOST_ONLY and FREE_FOR_ALL control modes planned for later phases
