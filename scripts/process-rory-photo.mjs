import sharp from 'sharp';

const inputPath = 'C:/Users/clayton.tucker.MILSOFT/Desktop/ChatGPT Image May 13, 2026, 03_31_59 PM.png';
const outputPath = 'public/player-photos/rory-mcilroy.jpg';

await sharp(inputPath)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .jpeg({ quality: 95 })
  .toFile(outputPath);

console.log(`Saved to ${outputPath}`);
