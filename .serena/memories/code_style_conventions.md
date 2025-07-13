# Code Style and Conventions

## TypeScript Conventions

- **Strict Mode:** Always enabled
- **Type Safety:** Use shared @repo/types, avoid `any`
- **Module Format:** ESM only - use `import`/`export` syntax
- **Exports:** Named exports only, no default exports

## File Naming Conventions

- **React Components:** PascalCase (e.g., `RoomManager.tsx`)
- **TypeScript Files:** camelCase (e.g., `syncLogic.ts`)
- **Test Files:**
  - Unit/Integration: `*.test.ts` (Vitest)
  - E2E: `*.spec.ts` (Playwright)

## React Guidelines

- **Hooks:** Use useState, useEffect, useMemo, useCallback
- **Component Structure:** Props interface → hooks → handlers → JSX return
- **Event Handling:** Use `onClick={handler}` with proper TypeScript types
- **Performance:** Use React.memo, useMemo, useCallback to prevent re-renders

## General Practices

- **Documentation:** JSDoc comments for all public APIs
- **Error Handling:** Try/catch for all async operations with graceful logging
- **Modularity:** Decompose complex problems, follow package structure
- **No Comments:** Do not add comments unless explicitly requested

## Testing Conventions

- **TDD Workflow:** Write tests first, implement to make them pass
- **Test Coverage:** Minimum 80% lines/functions, 70% branches
- **Test Organization:**
  - Unit tests in package directories
  - Integration tests in `/tests/integration/`
  - E2E tests with Playwright
