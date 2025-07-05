// vitest.config.ts
import { defineProject, mergeConfig } from "file:///Users/joshua/Developer/watch2gether/node_modules/.pnpm/vitest@2.1.9_@types+node@22.16.0_@vitest+ui@2.1.9_jsdom@25.0.1/node_modules/vitest/dist/config.js";
import { workersConfig } from "file:///Users/joshua/Developer/watch2gether/packages/vitest-config/src/workers.ts";
var vitest_config_default = mergeConfig(
  workersConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.ts"],
      environment: "cloudflare-workers",
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" }
        }
      }
    }
  })
);
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9qb3NodWEvRGV2ZWxvcGVyL3dhdGNoMmdldGhlci9hcHBzL2JhY2tlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9qb3NodWEvRGV2ZWxvcGVyL3dhdGNoMmdldGhlci9hcHBzL2JhY2tlbmQvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvam9zaHVhL0RldmVsb3Blci93YXRjaDJnZXRoZXIvYXBwcy9iYWNrZW5kL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVQcm9qZWN0LCBtZXJnZUNvbmZpZyB9IGZyb20gXCJ2aXRlc3QvY29uZmlnXCI7XG5pbXBvcnQgeyB3b3JrZXJzQ29uZmlnIH0gZnJvbSBcIkByZXBvL3ZpdGVzdC1jb25maWcvd29ya2Vyc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBtZXJnZUNvbmZpZyhcbiAgd29ya2Vyc0NvbmZpZyxcbiAgZGVmaW5lUHJvamVjdCh7XG4gICAgdGVzdDoge1xuICAgICAgaW5jbHVkZTogW1wic3JjLyoqLyoudGVzdC50c1wiXSxcbiAgICAgIGVudmlyb25tZW50OiBcImNsb3VkZmxhcmUtd29ya2Vyc1wiLFxuICAgICAgcG9vbE9wdGlvbnM6IHtcbiAgICAgICAgd29ya2Vyczoge1xuICAgICAgICAgIHdyYW5nbGVyOiB7IGNvbmZpZ1BhdGg6IFwiLi93cmFuZ2xlci50b21sXCIgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSksXG4pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVUsU0FBUyxlQUFlLG1CQUFtQjtBQUNwWCxTQUFTLHFCQUFxQjtBQUU5QixJQUFPLHdCQUFRO0FBQUEsRUFDYjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osTUFBTTtBQUFBLE1BQ0osU0FBUyxDQUFDLGtCQUFrQjtBQUFBLE1BQzVCLGFBQWE7QUFBQSxNQUNiLGFBQWE7QUFBQSxRQUNYLFNBQVM7QUFBQSxVQUNQLFVBQVUsRUFBRSxZQUFZLGtCQUFrQjtBQUFBLFFBQzVDO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGLENBQUM7QUFDSDsiLAogICJuYW1lcyI6IFtdCn0K
