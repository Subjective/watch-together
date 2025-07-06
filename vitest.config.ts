import { defineConfig } from "vitest/config";
import { sharedConfig } from "@repo/vitest-config";

export default defineConfig({
  ...sharedConfig,
  projects: [
    "./packages/*/vitest.config.ts",
    "./apps/*/vitest.config.ts",
    "./tests/vitest.config.ts",
  ],
});
