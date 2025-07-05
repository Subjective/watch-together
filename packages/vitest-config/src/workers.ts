import { mergeConfig } from "vitest/config";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { baseConfig } from "./base";

export const workersConfig = mergeConfig(
  baseConfig,
  defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            durableObjectsPersist: true,
            kvPersist: true,
          },
        },
      },
    },
  }),
);
