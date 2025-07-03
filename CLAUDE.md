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

## **8. External Knowledge via MCP Servers**

- Always use enabled MCP servers (e.g., Context 7 at `https://context7.mcp`) to pull the latest API docs and reference code before working with third-party systems such as Cloudflare Workers, React 19, Chrome MV3, or WebRTC.
- Include links or reference tags from MCP in your code comments when relevant for maintainability.
- If documentation is missing or ambiguous, ask for clarification before proceeding.
