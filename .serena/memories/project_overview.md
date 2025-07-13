# Watch Together Project Overview

**Project Name:** Watch Together

**Purpose:** A robust, multi-site video synchronization browser extension that allows users to watch videos together in sync across different browser instances.

**Architecture:**

- AI-Governed Monorepo using pnpm + Turborepo
- Serverless Signaling Backbone with Cloudflare Workers and Durable Objects
- Peer-to-Peer Data Fabric using WebRTC Data Channels for high-frequency sync

**Core Features:**

- Multi-site video synchronization
- Flexible control modes
- Browser extension for Chrome (MV3)
- Real-time video sync via WebRTC

**Project Structure:**

- `/apps` - Main applications
  - `/apps/extension` - Chrome browser extension
  - `/apps/backend` - Cloudflare Worker backend
- `/packages` - Shared packages
  - `/packages/types` - Shared TypeScript types
  - `/packages/adapters` - Video player adapters
  - `/packages/vitest-config` - Shared Vitest configuration
  - `/packages/eslint-config` - Shared ESLint configuration
  - `/packages/typescript-config` - Shared TypeScript configurations
  - `/packages/test-utils` - Testing utilities and mocks
- `/tests` - Integration and E2E tests
- `/docs` - Documentation

**System:** Darwin (macOS)
