import { defineConfig } from "vitest/config";
import { baseConfig } from "@repo/vitest-config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      ...baseConfig.test.coverage,
      enabled: false, // Disable coverage for integration tests since they don't test source code
    },
  },
});
