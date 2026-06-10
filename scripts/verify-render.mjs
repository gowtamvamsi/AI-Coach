// Parity check: serve the built site (simulating Firebase cleanUrls), load each
// route in a real headless browser, and assert React paints cleanly with no JS
// errors, exactly one JSON-LD block, and the correct per-route <title>.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;

// Only the React-rendered routes are verified here. /masterclasses, /about,
// /glossary, /guides/* are hand-authored static HTML (no React #root), so they
// aren't part of this prerender-parity check.
const ROUTES = [
  { urlPath: '/', file: 'index.html', expectTitleIncludes: 'Live Masterclasses' },
  { urlPath: '/roadmap', file: 'roadmap.html', expectTitleIncludes: 'Roadmap (2026)' },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};

// Simulate Firebase cleanUrls: /roadmap -> roadmap.html, etc.
function resolveFile(urlPath) {
  if (urlPath === '/' || urlPath === '') return 'index.html';
  const clean = urlPath.replace(/\/+$/, '');
  const known = ROUTES.find((r) => r.urlPath === clean);
  if (known) return known.file;
  return clean.slice(1); // direct asset
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(root, resolveFile(urlPath));
    try { await stat(filePath); }
    catch { filePath = path.join(root, 'index.html'); } // SPA fallback
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, r));

const IGNORE = [/favicon/i, /analytics/i, /gtag/i, /Failed to load resource/i, /youtube/i, /ERR_BLOCKED/i, /net::ERR/i, /Quirks Mode/i];
const EXTERNAL = [/lenis/i, /framer-motion/i, /firebasejs/i, /gstatic/i, /youtube/i, /unpkg/i, /jsdelivr/i];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
let allOk = true;

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message + (e.stack ? ' :: ' + e.stack.split('\n').slice(0, 2).join(' | ') : '')));

  let info = { childCount: 0, hasLoading: true, textLen: 0, hasError: false, jsonLdCount: 0, title: '' };
  try {
    await page.goto(`http://localhost:${PORT}${route.urlPath}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForFunction(() => {
      const r = document.getElementById('root');
      return r && !document.getElementById('loading-indicator') && r.children.length > 0;
    }, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600)); // let routing effect set title
    info = await page.evaluate(() => {
      const r = document.getElementById('root');
      return {
        childCount: r ? r.children.length : 0,
        hasLoading: !!document.getElementById('loading-indicator'),
        textLen: (r && r.innerText ? r.innerText.length : 0),
        hasError: !!(r && r.innerText && r.innerText.includes('JS Error')),
        jsonLdCount: document.querySelectorAll('script[type="application/ld+json"]').length,
        title: document.title,
      };
    });
  } catch (e) { pageErrors.push('RENDER: ' + e.message); }

  const realConsole = consoleErrors.filter((t) => !IGNORE.some((re) => re.test(t)));
  const realPageErrors = pageErrors.filter((t) => !EXTERNAL.some((re) => re.test(t)));
  const titleOk = info.title.includes(route.expectTitleIncludes);

  const ok = info.childCount > 0 && !info.hasLoading && !info.hasError && info.textLen > 500
    && info.jsonLdCount === 1 && realPageErrors.length === 0 && realConsole.length === 0 && titleOk;
  allOk = allOk && ok;

  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'} ${route.urlPath}`);
  console.log(`   children=${info.childCount} text=${info.textLen} jsonld=${info.jsonLdCount} title="${info.title.slice(0, 55)}"${titleOk ? '' : '  <-- TITLE MISMATCH'}`);
  if (realPageErrors.length) console.log('   pageErrors:', realPageErrors.slice(0, 3));
  if (realConsole.length) console.log('   consoleErrors:', realConsole.slice(0, 3));
  await page.close();
}

await browser.close();
server.close();
console.log(allOk ? '\nALL ROUTES PASS ✅' : '\nSOME ROUTES FAILED ❌');
process.exit(allOk ? 0 : 1);
