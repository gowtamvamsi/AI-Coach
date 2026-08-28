// Unit tests for email body rendering (functions/lib/email-body.js) — the two
// modes and, most importantly, the boundary between them: composer text must
// stay escaped, a designed HTML template must pass through untouched.
// Pure functions only — no Firebase, no network. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const E = require('../functions/lib/email-body.js');

test('isHtmlBody — only markup, leading whitespace tolerated', () => {
  assert.equal(E.isHtmlBody('<!DOCTYPE html><html>'), true);
  assert.equal(E.isHtmlBody('\n  <table role="presentation">'), true);
  assert.equal(E.isHtmlBody('Hi {{name}},\n\nWe just opened enrollment.'), false);
  assert.equal(E.isHtmlBody('**bold** and a <b> mid-sentence'), false);
  assert.equal(E.isHtmlBody(''), false);
  assert.equal(E.isHtmlBody(null), false);
});

test('markdown-lite mode — still escapes, still renders bold/links', () => {
  const html = E.emailBodyToHtml('Hi <script>x</script> **now** [site](https://balajichippada.com)');
  assert.match(html, /&lt;script&gt;/);           // escaped, not executable
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<strong>now<\/strong>/);
  assert.match(html, /<a href="https:\/\/balajichippada\.com">site<\/a>/);
  assert.equal(
    E.emailBodyToText('**now** [site](https://balajichippada.com)'),
    'now site (https://balajichippada.com)'
  );
});

test('HTML mode — body passes through byte-for-byte', () => {
  const tpl = '<table><tr><td style="color:#c2533c">A &amp; B</td></tr></table>';
  assert.equal(E.emailBodyToHtml(tpl), tpl);
});

test('HTML mode — text fallback strips markup, keeps readable copy', () => {
  const txt = E.emailBodyToText(
    '<html><head><style>.x{color:red}</style></head><body>' +
    '<!-- note --><p>Hello there,</p><p>Enroll &amp; learn</p>' +
    '<script>evil()</script><div>Bye<br>Team</div></body></html>'
  );
  assert.equal(txt, 'Hello there,\n\nEnroll & learn\n\nBye\nTeam');
  assert.doesNotMatch(txt, /color:red|evil\(\)|note|</);
});

test('the shipped campaign template survives both conversions', () => {
  const tpl = readFileSync(new URL('../email-templates/course-launch.html', import.meta.url), 'utf8');
  assert.equal(E.isHtmlBody(tpl), true);
  assert.equal(E.emailBodyToHtml(tpl), tpl);
  // Under the 1MB Firestore doc / Cloud Tasks payload ceiling, with room to spare.
  assert.ok(tpl.length < 200000, `template is ${tpl.length} bytes`);
  // No data: URIs — images must be hosted, or the payload blows the cap.
  assert.doesNotMatch(tpl, /src\s*=\s*["']data:/i);
  const txt = E.emailBodyToText(tpl);
  assert.match(txt, /Hello \{\{name\}\},/);
  assert.match(txt, /Agentic AI/);
  assert.match(txt, /\u{1F680} Now Open for Enrollments/u); // numeric entities decoded
  assert.doesNotMatch(txt, /&#\d+;/);
  assert.doesNotMatch(txt, /sm-stack|<td|padding:/); // no CSS or markup leaked in
});
