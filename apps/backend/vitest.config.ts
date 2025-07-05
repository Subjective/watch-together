import { defineProject, mergeConfig } from "vitest/config";
import { workersConfig } from "@repo/vitest-config/workers";

export default mergeConfig(
  workersConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.ts"],
      environment: "cloudflare-workers",
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
        },
      },
    },
  }),
);
