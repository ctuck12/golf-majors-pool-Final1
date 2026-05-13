import sharp from 'sharp';

const inputPath = 'C:/Users/clayton.tucker.MILSOFT/Desktop/ChatGPT Image May 13, 2026, 03_31_59 PM.png';
const outputPath = 'public/player-photos/rory-mcilroy.jpg';

const { width, height } = await sharp(inputPath).metadata();

// Zoom in ~15%: crop a centered 85% region then resize back to full
const cropW = Math.round(width * 0.85);
const cropH = Math.round(height * 0.85);
const left = Math.round((width - cropW) / 2);
const top = Math.round((height - cropH) / 2);

await sharp(inputPath)
  .extract({ left, top, width: cropW, height: cropH })
  .resize(width, height)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .jpeg({ quality: 95 })
  .toFile(outputPath);

console.log(`Saved to ${outputPath} (cropped ${cropW}x${cropH} → ${width}x${height})`);
