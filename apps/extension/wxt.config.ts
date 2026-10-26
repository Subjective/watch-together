import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

const icons = resolve(__dirname, "../../packages/logo/dist/assets/icons");

export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "Watch Together",
    description: "Watch videos together, in sync, on any site",
    permissions: ["storage", "tabs", "webNavigation"],
    host_permissions: ["<all_urls>"],
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  hooks: {
    "build:publicAssets": (_wxt, assets) => {
      for (const size of [16, 32, 48, 128]) {
        assets.push({
          absoluteSrc: resolve(icons, `icon-${size}.png`),
          relativeDest: `icons/icon-${size}.png`,
        });
      }
    },
  },
});
