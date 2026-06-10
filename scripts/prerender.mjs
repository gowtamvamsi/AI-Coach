// Pre-renders the React app with a headless browser and writes static HTML for
// every crawlable route, so search engines and AI agents that don't execute JS
// see real, route-specific content + JSON-LD. Real users still load the compiled
// React app, which re-renders over the static markup.
//
// Routes:
//   /              -> index.html        (markers injected in place)
//   /roadmap       -> roadmap.html
//   /masterclasses -> masterclasses.html
//   /about         -> about.html
//
// Firebase Hosting `cleanUrls` maps /roadmap -> roadmap.html, etc.
// Run AFTER build:js (npm run build does both). Idempotent.
import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8788;

// NOTE: /masterclasses and /about are hand-authored static pages (like
// /glossary and /guides/*) so crawlers/AI agents get rich, route-specific
// content instead of a near-duplicate of the home page. Do NOT add them here
// or the prerender would overwrite those static files with the home render.
const ROUTES = [
  { urlPath: '/', out: 'index.html', inPlace: true },
  { urlPath: '/roadmap', out: 'roadmap.html' },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const ROOT_START = '<!-- PRERENDER:ROOT:START -->';
const ROOT_END = '<!-- PRERENDER:ROOT:END -->';
const LD_START = '<!-- PRERENDER:JSONLD:START -->';
const LD_END = '<!-- PRERENDER:JSONLD:END -->';

const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

function replaceBetween(source, startMarker, endMarker, replacement) {
  const s = source.indexOf(startMarker);
  const e = source.indexOf(endMarker);
  if (s === -1 || e === -1 || e < s) throw new Error(`Markers not found: ${startMarker}`);
  return source.slice(0, s + startMarker.length) + '\n' + replacement + '\n  ' + source.slice(e);
}

function emptyBetween(source, startMarker, endMarker) {
  const s = source.indexOf(startMarker);
  const e = source.indexOf(endMarker);
  if (s === -1 || e === -1) return source;
  return source.slice(0, s + startMarker.length) + source.slice(e);
}

function setTitle(html, value) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(value)}</title>`);
}
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[\\s\\S]*?("\\s*/?>)`);
  return re.test(html) ? html.replace(re, `$1${escAttr(value)}$2`) : html;
}
function setCanonical(html, value) {
  const re = /(<link\s+rel="canonical"\s+href=")[\s\S]*?("\s*\/?>)/;
  return re.test(html) ? html.replace(re, `$1${escAttr(value)}$2`) : html;
}

// ── Static server: serves a CLEAN template (emptied markers) for any HTML
// navigation, so the browser renders each route from scratch. ──
const rawTemplate = await readFile(path.join(root, 'index.html'), 'utf8');
let cleanTemplate = emptyBetween(rawTemplate, ROOT_START, ROOT_END);
cleanTemplate = emptyBetween(cleanTemplate, LD_START, LD_END);

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath.endsWith('.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(cleanTemplate);
      return;
    }
    let filePath = path.join(root, urlPath);
    try {
      const st = await stat(filePath);
      if (st.isDirectory()) throw new Error('dir');
    } catch {
      // SPA fallback for unknown paths (e.g. /roadmap) -> clean template
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(cleanTemplate);
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

async function renderRoute(urlPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://localhost:${PORT}${urlPath}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => {
    const r = document.getElementById('root');
    return r && !document.getElementById('loading-indicator') && r.children.length > 0
      && r.innerText && r.innerText.length > 500;
  }, { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 800));
  const data = await page.evaluate(() => {
    const r = document.getElementById('root');
    const get = (sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : ''; };
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((s, i) => {
        let txt = s.textContent || '';
        try { txt = JSON.stringify(JSON.parse(txt)); } catch {}
        return `  <script type="application/ld+json"${i === 0 ? ' id="seo-jsonld"' : ''}>${txt}</script>`;
      }).join('\n');
    return {
      rootHtml: r ? r.innerHTML : '',
      jsonLd: ld,
      title: document.title,
      description: get('meta[name="description"]', 'content'),
      canonical: get('link[rel="canonical"]', 'href'),
      ogUrl: get('meta[property="og:url"]', 'content'),
      ogTitle: get('meta[property="og:title"]', 'content'),
      ogDescription: get('meta[property="og:description"]', 'content'),
      twTitle: get('meta[name="twitter:title"]', 'content'),
      twDescription: get('meta[name="twitter:description"]', 'content'),
    };
  });
  await page.close();
  return data;
}

let failed = false;
for (const route of ROUTES) {
  const d = await renderRoute(route.urlPath);
  if (!d.rootHtml || d.rootHtml.length < 500) {
    console.error(`Prerender for ${route.urlPath} produced too little HTML — skipping write.`);
    failed = true;
    continue;
  }

  let html = replaceBetween(rawTemplate, ROOT_START, ROOT_END, d.rootHtml);
  html = replaceBetween(html, LD_START, LD_END, d.jsonLd || '');

  if (!route.inPlace) {
    // Override head metadata so no-JS crawlers get route-specific tags.
    if (d.title) html = setTitle(html, d.title);
    if (d.description) html = setMeta(html, 'name', 'description', d.description);
    if (d.canonical) html = setCanonical(html, d.canonical);
    if (d.ogUrl) html = setMeta(html, 'property', 'og:url', d.ogUrl);
    if (d.ogTitle) html = setMeta(html, 'property', 'og:title', d.ogTitle);
    if (d.ogDescription) html = setMeta(html, 'property', 'og:description', d.ogDescription);
    if (d.twTitle) html = setMeta(html, 'name', 'twitter:title', d.twTitle);
    if (d.twDescription) html = setMeta(html, 'name', 'twitter:description', d.twDescription);
  }

  await writeFile(path.join(root, route.out), html);
  console.log(`prerendered ${route.urlPath} -> ${route.out} (root ${(d.rootHtml.length / 1024).toFixed(1)} KB) "${d.title.slice(0, 60)}"`);
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
