import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const srcPath = fileURLToPath(new URL("../assets-src/icon.svg", import.meta.url));
const outPath = fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url));

const svg = readFileSync(srcPath);

await sharp(svg, { density: 384 })
  .resize(180, 180)
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath}`);
