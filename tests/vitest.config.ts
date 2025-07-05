import { defineProject, mergeConfig } from "vitest/config";
import { baseConfig } from "@repo/vitest-config/base";

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      include: ["integration/**/*.test.ts"],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  }),
);
