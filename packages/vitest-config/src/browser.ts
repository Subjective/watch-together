import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./base";

export const browserConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
    },
  }),
);
