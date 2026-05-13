import sharp from 'sharp';
import { readFileSync } from 'fs';

const inputPath = 'C:/Users/clayton.tucker.MILSOFT/Desktop/ChatGPT Image May 13, 2026, 03_17_53 PM.png';
const outputPath = 'public/player-photos/rory-mcilroy.jpg';

// Read raw RGBA pixels
const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = new Uint8Array(data);
const { width, height } = info;

// Replace near-black background pixels with transparent
// Threshold: all channels < 30 AND pixel is "dark enough" vs neighbors (background)
for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];

  if (r < 30 && g < 30 && b < 30) {
    // Fade alpha smoothly based on how dark the pixel is (softer edges)
    const darkness = 1 - (r + g + b) / 90; // 0=not dark, 1=fully black
    pixels[i + 3] = Math.round((1 - darkness) * 255);
  }
}

// Composite the alpha-masked image over a solid white background
const alphaBuffer = Buffer.from(pixels.buffer);
const withAlpha = await sharp(alphaBuffer, {
  raw: { width, height, channels: 4 },
}).png().toBuffer();

await sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
  .composite([{ input: withAlpha }])
  .jpeg({ quality: 95 })
  .toFile(outputPath);

console.log(`Saved white-background photo to ${outputPath} (${width}x${height})`);
