import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 128];

async function generateIcons() {
  try {
    const svgPath = join(__dirname, "../src/logo.svg");
    const svgBuffer = readFileSync(svgPath);

    // Ensure output directory exists within the package
    const iconsDir = join(__dirname, "../dist/assets/icons");
    if (!existsSync(iconsDir)) {
      mkdirSync(iconsDir, { recursive: true });
    }

    // Generate PNG icons for Chrome extension
    for (const size of sizes) {
      const outputPath = join(iconsDir, `icon-${size}.png`);
      await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
      console.log(`Generated ${outputPath}`);
    }

    // Also generate a 32x32 favicon
    const faviconPath = join(iconsDir, "favicon.png");
    await sharp(svgBuffer).resize(32, 32).png().toFile(faviconPath);
    console.log(`Generated ${faviconPath}`);

    // Copy logo.svg to dist/assets for reference
    const svgDistPath = join(__dirname, "../dist/assets/logo.svg");
    const svgContent = readFileSync(svgPath, "utf-8");
    const { writeFileSync } = await import("fs");
    writeFileSync(svgDistPath, svgContent);
    console.log(`Copied ${svgDistPath}`);

    console.log("All icons generated successfully within package!");
  } catch (error) {
    console.error("Error generating icons:", error);
    process.exit(1);
  }
}

generateIcons();
