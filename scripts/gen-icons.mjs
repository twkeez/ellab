// Rasterizes the-lab app icon to the PNGs a PWA needs. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F5B65C"/>
      <stop offset="0.55" stop-color="#E8933A"/>
      <stop offset="1" stop-color="#C56E24"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g fill="none" stroke="#FFF6EA" stroke-width="20" stroke-linjoin="round" stroke-linecap="round">
    <path d="M212 132 h88" />
    <path d="M224 132 v96 L150 356 a44 44 0 0 0 40 64 h132 a44 44 0 0 0 40 -64 L288 228 v-96" />
    <path d="M196 300 h120" stroke-width="16"/>
  </g>
  <circle cx="232" cy="352" r="11" fill="#FFF6EA"/>
  <circle cx="286" cy="330" r="9" fill="#FFF6EA"/>
  <circle cx="270" cy="382" r="8" fill="#FFF6EA"/>
</svg>`;

mkdirSync("public", { recursive: true });
const buf = Buffer.from(svg);
const jobs = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
];
for (const [file, size] of jobs) {
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log("wrote", file, size);
}
