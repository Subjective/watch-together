import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";
import { resolve } from "path";

export default defineConfig({
  ...sharedConfig,
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    ...sharedConfig.test,
    environment: "jsdom",
    setupFiles: [resolve(__dirname, "./src/test-setup.ts")],
    // Package-specific overrides if needed
  },
});
