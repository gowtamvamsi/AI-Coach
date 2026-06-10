// Local dev server that mirrors Firebase Hosting behaviour:
//  - cleanUrls: /roadmap -> roadmap.html, /glossary -> glossary.html, etc.
//  - directory index + static assets
//  - SPA fallback to index.html for unknown paths
// Usage: node scripts/serve.mjs [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8000;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.gif': 'image/gif',
};

async function exists(p) { try { const s = await stat(p); return s.isFile(); } catch { return false; } }

http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const clean = urlPath.replace(/\/+$/, '');

    const candidates = [
      path.join(root, urlPath),
      path.join(root, clean + '.html'),       // cleanUrls
      path.join(root, clean, 'index.html'),   // directory index
    ];
    let filePath = null;
    for (const c of candidates) { if (await exists(c)) { filePath = c; break; } }
    if (!filePath) filePath = path.join(root, 'index.html'); // SPA fallback

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end('error: ' + e.message);
  }
}).listen(PORT, () => console.log(`serving ${root} at http://localhost:${PORT}  (cleanUrls + SPA fallback)`));
