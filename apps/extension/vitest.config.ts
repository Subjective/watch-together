import { defineProject, mergeConfig } from "vitest/config";
import { browserConfig } from "@repo/vitest-config/browser";

export default mergeConfig(
  browserConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      setupFiles: ["./src/test-setup.ts"],
    },
  }),
);
