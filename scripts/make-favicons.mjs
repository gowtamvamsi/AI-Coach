// Renders logos/fla-badge.svg into the raster icons that Google (and iOS) need.
// Run by hand after changing the badge: `node scripts/make-favicons.mjs`
//
// Why raster at all: Googlebot falls back to /favicon.ico, and Hosting's SPA
// catch-all rewrite was answering that path with index.html — an HTML body is
// not an icon, so Search rendered the generic globe.
//
// ponytail: reuses the puppeteer already installed for prerender and hand-rolls
// the 22-byte ICO header instead of adding an image dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'logos/fla-badge.svg'), 'utf8');

// 48 → favicon.ico (Google wants 48x48 or a multiple), 120 → Google OAuth
// consent-screen app logo, 180 → iOS home-screen icon.
const SIZES = [48, 120, 180];

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const png = {};

for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: 'load' }
  );
  png[size] = await page.screenshot({ type: 'png', omitBackground: true });
}

await browser.close();

// ICO container wrapping the 48x48 PNG (PNG-in-ICO, universally supported).
const ico = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0]),           // reserved, type=icon, count=1
  (() => {
    const e = Buffer.alloc(16);
    e[0] = 48; e[1] = 48;                     // width, height
    e.writeUInt16LE(1, 4);                    // color planes
    e.writeUInt16LE(32, 6);                   // bits per pixel
    e.writeUInt32LE(png[48].length, 8);       // payload size
    e.writeUInt32LE(22, 12);                  // payload offset (6 + 16)
    return e;
  })(),
  png[48],
]);

const out = [
  ['favicon.ico', ico],
  ['logos/fla-badge-48.png', png[48]],
  ['logos/fla-badge-120.png', png[120]],
  ['logos/fla-badge-180.png', png[180]],
];
for (const [rel, buf] of out) {
  fs.writeFileSync(path.join(root, rel), buf);
  console.log(`wrote ${rel} (${buf.length} bytes)`);
}
