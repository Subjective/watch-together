# **Testing Setup Realignment with Official Turborepo Guidelines**

## **Executive Summary**

This document outlines the realignment of the Watch Together project's testing setup with the official Turborepo hybrid approach as documented at https://turborepo.com/docs/guides/tools/vitest.

The current setup is functional but deviates from best practices in several key areas. This realignment will improve caching efficiency, simplify configuration, and ensure long-term maintainability.

## **Current State Analysis**

### **What's Working Well ✅**

- Shared vitest-config package exists
- Individual package configs exist
- Workspace configuration exists
- ESM setup is working
- All tests passing (20 tests across 6 test files)
- All typechecks passing

### **Issues to Address ❌**

- **Complex task dependencies** in turbo.json don't match recommended simple pattern
- **Wrong environment defaults** (node instead of jsdom recommended default)
- **Overcomplicated script structure** in root package.json
- **Missing coverage merge strategy** as required for hybrid approach
- **Mixed configuration approach** not aligned with official hybrid pattern
- **Redundant configuration duplication** across files

## **Implementation Plan**

### **Phase 1: Fix Core Configuration Issues**

#### **1.1 Simplify turbo.json Task Dependencies**

**Current (Complex):**

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build", "@repo/vitest-config#build"],
      "inputs": ["src/**", "__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
      "outputs": ["coverage/**", "coverage.json"]
    },
    "test:unit": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "__tests__/**", "**/*.test.ts"],
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build", "test:unit"],
      "inputs": ["tests/integration/**", "src/**"],
      "outputs": ["coverage/**"]
    }
  }
}
```

**Target (Official Pattern):**

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^test", "@repo/vitest-config#build"],
      "outputs": ["coverage/**"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    }
  }
}
```

#### **1.2 Update Shared Configuration Defaults**

**Current (Node Default):**

```typescript
// packages/vitest-config/src/base.ts
export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node", // ❌ Wrong default
    // ...
  },
});
```

**Target (jsdom Default per Docs):**

```typescript
// packages/vitest-config/src/index.ts
export const sharedConfig = {
  test: {
    globals: true,
    environment: "jsdom", // ✅ Official recommendation
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: [["json", { file: "../coverage.json" }], "text", "html"],
      enabled: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
};
```

#### **1.3 Streamline Root Package.json Scripts**

**Current (Overcomplicated):**

```json
{
  "scripts": {
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e",
    "test:playwright": "turbo run test:playwright",
    "test:watch": "turbo run test:watch",
    "test:projects": "vitest run",
    "test:projects:watch": "vitest --watch"
  }
}
```

**Target (Hybrid Approach):**

```json
{
  "scripts": {
    "test": "turbo run test",
    "test:projects": "turbo run test",
    "test:projects:watch": "vitest --watch",
    "test:coverage": "turbo run test && pnpm run merge-coverage",
    "merge-coverage": "nyc merge coverage coverage/merged.json && nyc report --temp-dir=coverage --report=html"
  }
}
```

### **Phase 2: Implement Coverage Merge Strategy**

#### **2.1 Add nyc Dependency**

**Add to root package.json:**

```json
{
  "devDependencies": {
    "nyc": "^15.1.0"
  }
}
```

#### **2.2 Update Coverage Configuration**

**Each package should output to individual coverage directories:**

```typescript
// Individual package configs
export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    coverage: {
      ...sharedConfig.test.coverage,
      reportsDirectory: `../../coverage/${packageName}`,
    },
  },
});
```

### **Phase 3: Align Individual Package Configs**

#### **3.1 Standardize Package Vitest Configs**

**Current Pattern (Various Approaches):**

```typescript
// apps/extension/vitest.config.ts
import { defineProject, mergeConfig } from "vitest/config";
import { browserConfig } from "@repo/vitest-config/browser";

export default mergeConfig(browserConfig, defineProject({...}));
```

**Target Pattern (Official Hybrid):**

```typescript
// apps/extension/vitest.config.ts
import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    // Package-specific overrides only
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

#### **3.2 Maintain Environment-Specific Exports**

**Keep specialized configs as named exports:**

```typescript
// packages/vitest-config/src/index.ts
export const sharedConfig = {
  /* base config */
};

// Specialized configurations
export const nodeConfig = defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: "node",
  },
});

export const workersConfig = mergeConfig(
  sharedConfig,
  defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
        },
      },
    },
  }),
);
```

### **Phase 4: Environment-Specific Configuration**

#### **4.1 Package Environment Mapping**

| Package               | Environment | Rationale                     |
| --------------------- | ----------- | ----------------------------- |
| `backend`             | `workers`   | Cloudflare Workers testing    |
| `extension`           | `jsdom`     | Chrome extension with React   |
| `adapters`            | `node`      | Utility functions, no DOM     |
| `tests` (integration) | `node`      | Server-side integration tests |

#### **4.2 Updated Package Configurations**

**Backend (Cloudflare Workers):**

```typescript
// apps/backend/vitest.config.ts
import { workersConfig } from "@repo/vitest-config";

export default workersConfig;
```

**Extension (React + Chrome APIs):**

```typescript
// apps/extension/vitest.config.ts
import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    // jsdom is already the default
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

**Adapters (Node utilities):**

```typescript
// packages/adapters/vitest.config.ts
import { nodeConfig } from "@repo/vitest-config";

export default nodeConfig;
```

### **Phase 5: Root Workspace Configuration**

#### **5.1 Update Root vitest.config.ts**

**Current (Mixed approach):**

```typescript
// Has both sharedTestConfig and projects
export default defineConfig({
  test: sharedTestConfig,
  projects: [...]
});
```

**Target (Clean projects approach):**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  projects: [
    {
      name: "packages",
      root: "./packages/*",
      test: {
        ...sharedConfig.test,
        environment: "node", // Override for packages
      },
    },
    {
      name: "apps",
      root: "./apps/*",
      test: {
        ...sharedConfig.test,
        // jsdom is already default
      },
    },
  ],
});
```

## **Implementation Steps**

### **Step 1: Update turbo.json**

```bash
# Edit turbo.json to use simplified task dependencies
```

### **Step 2: Update shared configuration**

```bash
# Edit packages/vitest-config/src/index.ts
# Change default environment to jsdom
# Simplify configuration structure
```

### **Step 3: Add coverage merge tooling**

```bash
pnpm add -D nyc
# Update package.json scripts
```

### **Step 4: Standardize package configs**

```bash
# Update each package's vitest.config.ts
# Follow official hybrid pattern
```

### **Step 5: Update root workspace config**

```bash
# Simplify root vitest.config.ts
# Ensure projects pattern matches docs
```

### **Step 6: Remove redundant configurations**

```bash
# Remove duplicate vitest.workspace.ts if not needed
# Clean up any unused configuration files
```

## **Verification Steps**

### **1. Test Package-Level Caching**

```bash
pnpm test # Should use Turborepo caching
pnpm test # Second run should be cached
```

### **2. Test Projects Development**

```bash
pnpm test:projects:watch # Should use Vitest projects for dev
```

### **3. Test Coverage Merge**

```bash
pnpm test:coverage # Should generate merged coverage report
```

### **4. Verify TypeScript**

```bash
pnpm typecheck # Should pass without errors
```

### **5. Test Individual Packages**

```bash
pnpm test --filter=@repo/adapters
pnpm test --filter=extension
pnpm test --filter=backend
```

## **Expected Benefits**

1. **Improved Caching**: Simplified task dependencies improve Turborepo cache efficiency
2. **Better Developer Experience**: Matches official patterns, easier to understand and maintain
3. **Proper Coverage**: Implements recommended coverage merge strategy
4. **Environment Alignment**: Correct defaults with appropriate overrides
5. **Future-Proof**: Follows official best practices for long-term maintainability

## **Rollback Plan**

If issues arise during implementation:

1. **Git reset**: All changes are tracked in git
2. **Package restoration**: Original package.json can be restored
3. **Configuration restoration**: Original configs backed up
4. **Dependency rollback**: Remove nyc if coverage merge fails

## **Post-Implementation Documentation**

After successful implementation:

1. Update CLAUDE.md with new testing commands
2. Update any team documentation
3. Add coverage merge instructions
4. Document the hybrid approach for future developers

This realignment will transform the current "working but messy" setup into a clean, best-practice implementation that exactly matches the official Turborepo hybrid approach.
