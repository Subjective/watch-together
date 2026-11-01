# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed by pnpm + Turborepo.
- Apps: `apps/backend` (Cloudflare Worker with a Durable Object per room), `apps/extension` (browser extension, WXT + React), `apps/website` (Next.js).
- Packages: `packages/protocol` (wire types and validation shared by backend and extension), `packages/logo`, and configs (`eslint-config`, `typescript-config`).
- Tests: unit tests in each package's `test/`; extension end-to-end tests in `apps/extension/e2e`.
- Design and behavior of the extension: `docs/rewrite-plan.md`. Known site issues: `docs/site-support.md`.

## Build, Test, and Development Commands

- `pnpm dev` — run all app dev tasks (watch mode via Turborepo).
- `pnpm build` — build all packages/apps.
- `pnpm lint` / `pnpm typecheck` — ESLint and TypeScript across workspace.
- `pnpm test` — unit tests; `pnpm test:e2e` — extension end-to-end tests (builds the extension, runs `wrangler dev`).
- Targeted filters: `pnpm extension:dev`, `pnpm extension:build`, `pnpm backend:build`, `pnpm backend:deploy`.

## Coding Style & Naming Conventions

- Language: TypeScript (Node 20.x). Package manager: pnpm 9.x.
- Formatting: Prettier (2‑space indent) via Husky + lint‑staged. Run `pnpm format` / `pnpm format:check`.
- Linting: shared config `@repo/eslint-config`; fix with `pnpm lint`.
- Naming: `camelCase` for vars/functions, `PascalCase` for React components/types, `UPPER_SNAKE_CASE` for constants. File names kebab- or lowerCamel; tests as `*.test.ts` or under `__tests__/`.

## Testing Guidelines

- Unit: Vitest. The backend runs on `@cloudflare/vitest-pool-workers` with a real Durable Object.
- E2E: Playwright in `apps/extension/e2e`, one browser profile per user with the built extension. `HEADED=1` shows the browsers, `SKIP_BUILD=1` reuses the last build, `RECORD=out.mp4` records the demos.
- Put pure logic in small modules with unit tests; cover behavior across browsers with e2e scenarios.

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
