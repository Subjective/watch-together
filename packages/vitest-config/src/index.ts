export const sharedConfig = {
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "istanbul" as const,
      reporter: [
        [
          "json",
          {
            file: `../coverage.json`,
          },
        ],
      ] as const,
      enabled: true,
    },
  },
};

// Re-export specific configs
export { baseConfig } from "./base.js";
export { browserConfig } from "./browser.js";
export { workersConfig } from "./workers.js";

// Legacy exports for backwards compatibility
export { baseConfig as baseConfigLegacy } from "./configs/base-config.js";
export { uiConfig } from "./configs/ui-config.js";
