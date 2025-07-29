import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 128];

async function generateIcons() {
  try {
    const svgPath = join(__dirname, '../src/logo.svg');
    const svgBuffer = readFileSync(svgPath);
    
    // Ensure extension icons directory exists
    const extensionIconsDir = join(__dirname, '../../../apps/extension/public/icons');
    if (!existsSync(extensionIconsDir)) {
      mkdirSync(extensionIconsDir, { recursive: true });
    }
    
    // Generate PNG icons for Chrome extension
    for (const size of sizes) {
      const outputPath = join(extensionIconsDir, `icon-${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Generated ${outputPath}`);
    }
    
    // Generate favicon for website - save as PNG first
    const faviconPngPath = join(__dirname, '../../../apps/website/app/favicon.png');
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(faviconPngPath);
    console.log(`Generated ${faviconPngPath} - Note: You may want to convert this to .ico format`);
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();