// Transpiles the in-browser JSX sources to plain JS so we can drop
// @babel/standalone (a ~3MB in-browser compiler) from index.html.
//
// We use esbuild's `transform` (not `build`) so each file is transpiled
// IN PLACE: no module wrapping, no IIFE, top-level declarations stay global.
// This preserves the existing "classic global scripts share scope" model
// that app.jsx/v2.jsx rely on (no imports/exports anywhere).
import { transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  ['v2.jsx', 'v2.build.js'],
  ['app.jsx', 'app.build.js'],
];

for (const [src, out] of TARGETS) {
  const code = await readFile(path.join(root, src), 'utf8');
  const result = await transform(code, {
    loader: 'jsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    // Shrink whitespace/syntax but NEVER rename identifiers: top-level
    // names are global and referenced across files.
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    target: 'es2019',
    legalComments: 'none',
  });
  const banner = `/* Compiled from ${src} by scripts/build-js.mjs — do not edit directly. */\n`;
  await writeFile(path.join(root, out), banner + result.code);
  console.log(`built ${src} -> ${out} (${(banner.length + result.code.length / 1024).toFixed(1)} KB)`);
}
