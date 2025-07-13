# Tech Stack

**Package Manager:** pnpm (v8.15.6)

**Build System:** Turborepo

**Core Technologies:**

- **Language:** TypeScript (v5.6.0) with strict mode enabled
- **UI Framework:** React 19 with hooks
- **Runtime:** Chrome Extension (Manifest V3)
- **Backend:** Cloudflare Workers with Durable Objects
- **P2P Communication:** WebRTC Data Channels
- **Styling:** Tailwind CSS with CSS modules or styled-components

**Testing Stack:**

- **Primary Framework:** Vitest (v2.0.0)
- **E2E Testing:** Playwright
- **Testing Libraries:**
  - @testing-library/react (v16.0.0)
  - @testing-library/jest-dom (v6.5.0)
  - @testing-library/user-event (v14.5.0)
- **Coverage:** Istanbul with nyc for reporting
- **Mock Environment:** jsdom for browser APIs

**Development Tools:**

- **Linting:** ESLint (v8.57.0)
- **Formatting:** Prettier (v3.2.5)
- **Build Tool:** Vite (v6.0.0)

**Module Format:** ESM (ECMAScript modules) exclusively - no CommonJS
