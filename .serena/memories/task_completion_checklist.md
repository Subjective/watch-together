# Task Completion Checklist

When completing any development task, follow these steps:

## 1. Run Tests

```bash
pnpm run test                   # Ensure all tests pass
pnpm run test:coverage          # Check coverage meets thresholds (80% lines/functions, 70% branches)
```

## 2. Code Quality Checks

```bash
pnpm run lint                   # Fix any linting errors
pnpm run typecheck              # Ensure no TypeScript errors
pnpm run format                 # Format code consistently
```

## 3. Build Verification

```bash
pnpm run build                  # Ensure project builds successfully
```

## 4. TDD Workflow Completion

- ✅ All new code has corresponding tests
- ✅ Tests were written before implementation (Red-Green-Refactor)
- ✅ Code coverage maintained or improved
- ✅ All tests pass in watch mode

## 5. Code Review Checklist

- ✅ TypeScript strict mode compliance
- ✅ Named exports only (no default exports)
- ✅ JSDoc comments for public APIs
- ✅ Error handling with try/catch for async operations
- ✅ React best practices (proper hooks usage, memoization)
- ✅ ESM module format (no CommonJS)

## 6. Pre-Commit

- ✅ Run all quality checks
- ✅ Verify no console.logs or debug code
- ✅ Check for any TODO comments that need addressing
- ✅ Ensure CLAUDE.md compliance

## Important Notes

- Never commit unless explicitly asked by the user
- If lint/typecheck commands are not found, ask user for correct commands
- Suggest writing any new commands to CLAUDE.md for future reference
