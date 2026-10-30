import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 128];

// Grey is the toolbar state when the current tab is not synced
const GREY = {
  "#111214": "#9AA0A6",
  "#FFFFFF": "#FFFFFF",
  "#0A84FF": "#DADCE0",
};

const large = readFileSync(join(__dirname, "../src/logo.svg"), "utf-8");
// Pixel-aligned version of the mark for 16px and 32px
const small = readFileSync(join(__dirname, "../src/logo-small.svg"), "utf-8");

const iconsDir = join(__dirname, "../dist/assets/icons");
mkdirSync(iconsDir, { recursive: true });

const render = (size, grey) => {
  const svg = size <= 32 ? small : large;
  const width = size <= 32 ? 16 : 256;
  const source = grey
    ? svg.replace(/#[0-9A-F]{6}/g, (hex) => GREY[hex] ?? hex)
    : svg;
  return sharp(Buffer.from(source), { density: (72 * size) / width })
    .resize(size, size)
    .png();
};

for (const size of sizes) {
  await render(size, false).toFile(join(iconsDir, `icon-${size}.png`));
  await render(size, true).toFile(join(iconsDir, `icon-grey-${size}.png`));
  console.log(`Generated icon-${size}.png and icon-grey-${size}.png`);
}

await render(32, false).toFile(join(iconsDir, "favicon.png"));
writeFileSync(join(__dirname, "../dist/assets/logo.svg"), large);
console.log("All icons generated successfully within package!");
