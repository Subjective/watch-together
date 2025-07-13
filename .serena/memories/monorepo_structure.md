# Monorepo Structure Details

## Package Management

- **Workspace:** pnpm workspace with packages defined in `pnpm-workspace.yaml`
- **Workspaces:** `apps/*`, `packages/*`, `tests`
- **Internal Dependencies:** Use `workspace:*` protocol

## Turbo Configuration

Tasks defined in `turbo.json`:

- **build:** Depends on upstream builds, outputs to `dist/` or `build/`
- **dev:** No cache, persistent mode
- **lint:** Simple task with caching
- **typecheck:** Depends on upstream builds
- **test:** Depends on transit and vitest-config build
- **test:watch:** No cache, persistent mode
- **test:e2e:** Depends on builds, uses Playwright

## Shared Packages

- **@repo/types:** Shared TypeScript type definitions
- **@repo/adapters:** Video player adapters for different sites
- **@repo/vitest-config:** Centralized Vitest configuration
- **@repo/eslint-config:** Shared ESLint rules
- **@repo/typescript-config:** Base TypeScript configurations
- **@repo/test-utils:** Testing utilities, mocks, and helpers

## Development Workflow

1. Changes in shared packages trigger rebuilds in dependent packages
2. Use `--filter` flag to run commands for specific packages
3. Turbo caches build outputs for faster subsequent builds
4. Watch mode available for TDD development
