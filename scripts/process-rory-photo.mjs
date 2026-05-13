import sharp from 'sharp';

const inputPath = 'C:/Users/clayton.tucker.MILSOFT/Desktop/ChatGPT Image May 13, 2026, 03_31_59 PM.png';
const outputPath = 'public/player-photos/rory-mcilroy.jpg';

const { width, height } = await sharp(inputPath).metadata();

// Match Justin Rose PGA Tour framing: head through upper chest, portrait 4:5 ratio
// Take full width, top 78% of height → crops lower body, keeps cap-to-chest framing
const cropH = Math.round(height * 0.78);

await sharp(inputPath)
  .extract({ left: 0, top: 0, width, height: cropH })
  .resize(280, 350)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .jpeg({ quality: 95 })
  .toFile(outputPath);

console.log(`Saved to ${outputPath} (${width}x${cropH} → 280x350)`);
