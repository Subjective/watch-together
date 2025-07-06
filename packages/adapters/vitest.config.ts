import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: "jsdom", // Adapters need DOM for video player testing
    // Package-specific overrides if needed
  },
});
