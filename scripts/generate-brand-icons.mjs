/**
 * Sinh favicon web + icon launcher Android.
 * - brand-icon.svg: icon đầy đủ (web, ic_launcher legacy)
 * - brand-icon-foreground.svg: foreground adaptive (nền trong suốt, giọt nước căn giữa)
 *
 * Chạy: npm run icons:generate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fullSvg = fs.readFileSync(path.join(root, "public/brand-icon.svg"));
const foregroundSvg = fs.readFileSync(
  path.join(root, "public/brand-icon-foreground.svg"),
);
const androidRes = path.resolve(root, "../app android/android/app/src/main/res");

const webSizes = [
  ["public/favicon.png", 32],
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
];

const androidSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

async function writePng(svg, size, out) {
  await sharp(svg).resize(size, size).png().toFile(out);
}

for (const [rel, size] of webSizes) {
  await writePng(fullSvg, size, path.join(root, rel));
  console.log("web", rel);
}

for (const [dir, size] of Object.entries(androidSizes)) {
  const base = path.join(androidRes, dir);
  await writePng(fullSvg, size, path.join(base, "ic_launcher.png"));
  await writePng(foregroundSvg, size, path.join(base, "ic_launcher_foreground.png"));
  console.log("android", dir);
}

console.log("Done — icons synced");
