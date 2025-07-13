# Suggested Commands

## Development Commands

```bash
# Install dependencies
pnpm install

# Development mode
pnpm run dev                    # Run all apps in dev mode
pnpm run extension:dev          # Run extension only
pnpm run backend:deploy         # Deploy backend to Cloudflare

# Building
pnpm run build                  # Build all packages
pnpm run extension:build        # Build extension only
pnpm run backend:build          # Build backend only
```

## Testing Commands

```bash
# TDD development with watch mode
pnpm run test:watch             # Watch mode for active development
pnpm run test:projects:watch    # Watch mode across all packages

# Run tests
pnpm run test                   # Run all tests
pnpm run test:unit              # Unit tests only (apps/packages)
pnpm run test:integration       # Integration tests only (tests/)
pnpm run test:e2e               # E2E tests with Playwright

# Coverage and analysis
pnpm run test:coverage          # Generate merged coverage reports
pnpm run test:ui                # Interactive Vitest UI

# Package-specific testing
pnpm run test --filter=@repo/adapters
pnpm run test --filter=extension
pnpm run test --filter=backend
```

## Code Quality Commands

```bash
# Linting
pnpm run lint                   # Lint all packages

# Type checking
pnpm run typecheck              # Type check all packages

# Formatting
pnpm run format                 # Format all TypeScript, TSX, and Markdown files
```

## Git Commands (Darwin/macOS)

```bash
git status                      # Check current status
git diff                        # View uncommitted changes
git add .                       # Stage all changes
git commit -m "message"         # Commit with message
git push                        # Push to remote
git pull                        # Pull from remote
git log --oneline -10           # View recent commits
```

## System Commands (Darwin/macOS)

```bash
ls -la                          # List all files with details
cd <directory>                  # Change directory
pwd                             # Print working directory
mkdir -p <path>                 # Create directory with parents
rm -rf <path>                   # Remove directory recursively
find . -name "*.ts"             # Find TypeScript files
grep -r "pattern" .             # Search for pattern recursively
```
