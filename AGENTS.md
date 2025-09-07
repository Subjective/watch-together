# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed by pnpm + Turborepo.
- Apps: `apps/backend` (Cloudflare Worker), `apps/extension` (browser extension, Vite), `apps/website` (Next.js).
- Packages: shared libs and configs under `packages/` (`adapters`, `types`, `eslint-config`, `typescript-config`, `vitest-config`, `logo`, `test-utils`).
- Tests: integration/e2e under `tests/`; unit tests live with sources (`__tests__/` or `*.test.ts`).

## Build, Test, and Development Commands

- `pnpm dev` — run all app dev tasks (watch mode via Turborepo).
- `pnpm build` — build all packages/apps.
- `pnpm lint` / `pnpm typecheck` — ESLint and TypeScript across workspace.
- `pnpm test` — run all tests; `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` for subsets.
- Targeted filters: `pnpm extension:dev`, `pnpm extension:build`, `pnpm backend:build`, `pnpm backend:deploy`.
- Coverage report: `pnpm test:coverage` (merges and opens NYC report in `coverage/report`).

## Coding Style & Naming Conventions

- Language: TypeScript (Node 20.x). Package manager: pnpm 9.x.
- Formatting: Prettier (2‑space indent) via Husky + lint‑staged. Run `pnpm format` / `pnpm format:check`.
- Linting: shared config `@repo/eslint-config`; fix with `pnpm lint`.
- Naming: `camelCase` for vars/functions, `PascalCase` for React 19 components/types, `UPPER_SNAKE_CASE` for constants. File names kebab- or lowerCamel; tests as `*.test.ts` or under `__tests__/`.

## Testing Guidelines

- Unit/integration: Vitest; browser env via JSDOM where needed.
- E2E: Playwright in `tests/` (`pnpm test:headed` / `pnpm test:debug` helpful locally).
- Prefer colocated unit tests; use `tests/` for cross-project integration.
- Aim for meaningful coverage; verify with `pnpm test:coverage`.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `refactor(scope): ...`.
- PRs: concise description, linked issues, testing notes; include screenshots/GIFs for UI changes (website/extension). Update docs in `docs/` when architecture or behavior changes.

## Security & Configuration Tips

- Do not commit secrets. Backend uses Cloudflare Wrangler (`apps/backend/wrangler.toml`); extension uses `.env.*` in `apps/extension/`. Website deploys via Vercel.
- Run `pnpm install` once with Node 20.x; use `mise`/Corepack if configured.

## IMPORTANT

- Try to keep things in one function unless composable or reusable
- DO NOT do unnecessary destructuring of variables
- DO NOT use `else` statements unless necessary
- DO NOT use `try`/`catch` if it can be avoided
- AVOID `try`/`catch` where possible
- AVOID `else` statements
- AVOID using `any` type
- AVOID `let` statements
- PREFER single word variable names where possible
