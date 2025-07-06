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
- **Testing Framework:** Vitest (primary) + Playwright (E2E)

## **4. Immutable Coding Conventions**

**Non-negotiable rules:**

- **Type Safety:** Strict TypeScript, use shared @repo/types, avoid `any`
- **Modularity:** Decompose complex problems, follow package structure
- **File Naming:**
  - React components: PascalCase (RoomManager.tsx)
  - TypeScript files: camelCase (syncLogic.ts)
  - Test files: _.test.ts (Vitest unit/integration), _.spec.ts (Playwright E2E)
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

**Testing Framework Hierarchy:**

- **Primary:** Vitest for unit and integration tests
- **Secondary:** Playwright for comprehensive E2E user journeys
- **Configuration:** Shared `@repo/vitest-config` package for consistency

**Test Categories:**

- **Unit Tests (Vitest):** Individual functions, components, adapters
- **Integration Tests (Vitest):** Cross-package communication, WebRTC signaling, video sync
- **E2E Tests (Playwright):** Complete user journeys across browser instances

**Testing Environments:**

- **Node.js:** Backend logic, utilities, shared packages
- **jsdom:** React components, DOM interactions, browser APIs
- **Cloudflare Workers:** Durable Objects, Worker scripts with `@cloudflare/vitest-pool-workers`

**Mock Strategy:**

- **Chrome Extension APIs:** Complete mock implementations in test-utils
- **WebRTC APIs:** Mock RTCPeerConnection with state management
- **Video Player APIs:** Mock adapters for controlled testing scenarios
- **Browser APIs:** jsdom environment with custom global mocks

**TDD Workflow:**

- **Red:** Write failing test with clear expectations
- **Green:** Implement minimal code to pass test
- **Refactor:** Improve code while maintaining test coverage
- **Watch Mode:** Use `pnpm run test:watch` for immediate feedback

**Coverage Requirements:**

- **Minimum Thresholds:** 80% lines, 80% functions, 70% branches
- **Reporting:** HTML, JSON, and text coverage reports
- **Exclusions:** Test files, mocks, node_modules, dist folders

**Shared Infrastructure:**

- **Configuration:** Use `@repo/vitest-config` for consistent setup
- **Utilities:** Leverage test-utils for mocks and helpers
- **Fixtures:** Standardized test data and setup patterns

## **7. Interaction Protocol**

- **Clarity:** Ask for clarification on ambiguous or conflicting requirements
- **Updates:** Request CLAUDE.md updates when receiving new rules or corrections
- **Verification:** Use automated hooks for immediate feedback on code changes

## **8. External Knowledge via MCP Servers**

- Always use enabled MCP servers (e.g., Context 7 at `https://context7.mcp`) to pull the latest API docs and reference code before working with third-party systems such as Cloudflare Workers, React 19, Chrome MV3, or WebRTC.
- Include links or reference tags from MCP in your code comments when relevant for maintainability.
- If documentation is missing or ambiguous, ask for clarification before proceeding.

## **9. Testing Workflow**

**Development Commands:**

```bash
# TDD development with watch mode
pnpm run test:watch

# Run all tests
pnpm run test

# Specific test categories
pnpm run test:unit          # Unit tests only (apps/packages)
pnpm run test:integration   # Integration tests only (tests/)
pnpm run test:e2e           # E2E tests with Playwright

# Coverage and analysis
pnpm run test:coverage      # Generate merged coverage reports
pnpm run test:ui            # Interactive Vitest UI

# Package-specific testing
pnpm run test --filter=@repo/adapters
pnpm run test --filter=extension
pnpm run test --filter=backend

# Development workflow
pnpm run test:projects:watch # Watch mode across all packages
```

**TDD Development Cycle:**

1. **Red Phase:** Write failing test that defines expected behavior
2. **Green Phase:** Implement minimal code to make test pass
3. **Refactor Phase:** Improve code while maintaining test coverage
4. **Commit:** Save working implementation with descriptive message

**Testing Infrastructure Usage:**

- **Shared Config:** Always extend from `@repo/vitest-config` configurations
- **Mock Utilities:** Use established mocks from `test-utils/` directory
- **Environment Selection:** Node.js (backend), jsdom (browser), workers (Cloudflare)
- **Integration Tests:** Place cross-package tests in `tests/integration/`

**Quality Gates:**

- All tests must pass before commits
- Maintain minimum 80% code coverage (lines, functions), 70% branches
- Coverage thresholds enforced in @repo/vitest-config
- Use TypeScript strict mode throughout
- Follow established mocking patterns for external APIs
