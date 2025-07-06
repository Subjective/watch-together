import { defineConfig } from "vitest/config";
import { workersConfig } from "@repo/vitest-config";

export default defineConfig({
  ...workersConfig,
  test: {
    ...workersConfig.test,
    // Package-specific overrides if needed
  },
});
