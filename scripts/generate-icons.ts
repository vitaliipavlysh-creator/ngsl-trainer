/**
 * Генерує PNG-іконки PWA з SVG через Chromium (Playwright).
 * Запуск: node scripts/generate-icons.ts
 */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BLUE = '#2f5bd3';

function svg(size: number, { rounded, scale }: { rounded: boolean; scale: number }): string {
  const r = rounded ? size * 0.22 : 0;
  const font = size * 0.62 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BLUE}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
    font-weight="700" font-size="${font}" fill="#fff">N</text>
</svg>`;
}

const targets = [
  { file: 'public/favicon.svg', size: 64, rounded: true, scale: 1, svgOnly: true },
  { file: 'public/icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'public/icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'public/icon-maskable-512.png', size: 512, rounded: false, scale: 0.8 },
  { file: 'public/apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const markup = svg(t.size, t);
  if ('svgOnly' in t) {
    writeFileSync(t.file, `${markup}\n`);
    continue;
  }
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<body style="margin:0">${markup}</body>`);
  writeFileSync(t.file, await page.screenshot({ omitBackground: true }));
  console.log(t.file);
}
await browser.close();
