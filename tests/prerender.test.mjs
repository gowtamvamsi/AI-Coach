// Read-only checks on the prerendered output. Never hits a server or Firebase.
// Run AFTER `npm run build`. Run: `node --test tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = ['index.html', 'roadmap.html'];

for (const page of PAGES) {
  test(`prerender — ${page} has core SEO tags`, () => {
    const html = read(page);
    assert.match(html, /<title>[^<]+<\/title>/, 'has a non-empty <title>');
    assert.match(html, /<link[^>]+rel="canonical"[^>]+href="https:\/\/balajichippada\.com/, 'has canonical');
    assert.match(html, /property="og:title"/, 'has og:title');
    assert.match(html, /name="twitter:card"/, 'has twitter:card');
  });

  test(`prerender — ${page} JSON-LD blocks all parse`, () => {
    const html = read(page);
    const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, 'at least one JSON-LD block');
    for (const [, json] of blocks) {
      let parsed;
      assert.doesNotThrow(() => { parsed = JSON.parse(json); }, 'JSON-LD must be valid JSON');
      assert.ok(parsed['@context'] || Array.isArray(parsed), 'JSON-LD has @context');
    }
  });

  test(`prerender — ${page} has no unresolved placeholders or leaked errors`, () => {
    const html = read(page);
    assert.doesNotMatch(html, /\{\{[^}]+\}\}/, 'no unresolved {{placeholders}}');
    assert.doesNotMatch(html, /Minified React error|Error: Objects are not valid as a React child/, 'no leaked React errors');
    assert.doesNotMatch(html, /undefined<\/title>|>NaN</, 'no undefined/NaN leaked into markup');
  });
}

test('prerender — sitemap.xml is well-formed and lists URLs', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /<urlset[\s>]/, 'has <urlset>');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, 'has at least one <loc>');
  for (const u of locs) assert.match(u, /^https:\/\/balajichippada\.com/, `absolute URL: ${u}`);
});

test('prerender — llms.txt exists and is non-trivial', () => {
  const txt = read('llms.txt');
  assert.ok(txt.trim().length > 100, 'llms.txt has content');
});

test('prerender — cache-bust versions are present on bundles', () => {
  const html = read('index.html');
  for (const asset of ['v2.build.js', 'app.build.js', 'styles.css']) {
    assert.match(html, new RegExp(`${asset.replace('.', '\\.')}\\?v=\\d+`), `${asset} has a ?v= cache-bust`);
  }
});

test('app bundle — courses tab includes landing sections (v3 design)', () => {
  const js = read('app.build.js');
  assert.match(js, /cv3-enquiry-card/, 'courses page has enquiry form card');
  assert.match(js, /cv3-curriculum-detail/, 'courses page has master-detail curriculum');
  assert.match(js, /cv3-pricing-card/, 'courses page has pricing card');
});

test('app bundle — my account tab includes polished dashboard shell', () => {
  const js = read('v2.build.js');
  assert.match(js, /v2-account-hero/, 'my account page has account hero');
  assert.match(js, /v2-account-support-grid/, 'my account page has profile and inquiry support grid');
});

test('public site — masterclass seat scarcity copy is not shown', () => {
  const publicText = [
    read('index.html'),
    read('roadmap.html'),
    read('app.build.js'),
    read('v2.build.js'),
  ].join('\n');

  assert.doesNotMatch(publicText, /\bseats?\s+(left|remaining)\b/i, 'no seats-left or seats-remaining copy');
  assert.doesNotMatch(publicText, /\bof\s+\d+\s+seats?\s+left\b/i, 'no "of N seats left" copy');
});

test('public site — masterclass meeting-link timing copy is current', () => {
  const publicText = [
    read('index.html'),
    read('roadmap.html'),
    read('v2.build.js'),
  ].join('\n');

  assert.match(publicText, /Meeting link emailed a few days before the masterclass \+  Meeting reminders/, 'shows current meeting-link timing copy');
  assert.doesNotMatch(publicText, /Zoom link emailed instantly/i, 'old instant Zoom-link copy is removed');
  assert.doesNotMatch(publicText, /email your Zoom link instantly/i, 'old instant email promise is removed');
  assert.doesNotMatch(publicText, /Instant Zoom link/i, 'old instant Zoom-link microcopy is removed');
  assert.doesNotMatch(publicText, /Instant confirmation · Zoom link sent by email/i, 'old instant confirmation microcopy is removed');
});

test('homepage — masterclass duration is 120 minutes', () => {
  const html = read('index.html');

  assert.match(html, /\b120 min\b/, 'homepage shows 120 min duration');
  assert.doesNotMatch(html, /\b180 min\b/, 'homepage no longer shows 180 min duration');
});
