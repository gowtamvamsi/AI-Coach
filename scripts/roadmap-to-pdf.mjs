// Generates a clean, print-optimized PDF of the full Agentic AI Engineer
// Roadmap straight from data.js (the source of truth). The live site hides each
// phase's modules behind tabs, so this is the only way to get a complete,
// linear document with every phase, module, capstone and appendix section.
//
//   node scripts/roadmap-to-pdf.mjs
//
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Load data.js into a sandbox and pull the window.* globals it defines ──
const dataSrc = await readFile(path.join(root, 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);
const { ROADMAP, PHASE_COLORS, CAPSTONES, OUT_OF_SCOPE, NEXT_STEPS } = sandbox.window;

// ── Brand palette (light theme, from styles.css :root) ──
const COLORS = {
  'teal-deep': '#0d4c5c', teal: '#2da6b3', purple: '#6b4d80', pink: '#e85a7a',
  amber: '#d18a2a', emerald: '#5a8d76', indigo: '#3a4f7a', rust: '#c2533c', mustard: '#c89234',
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dots = (level, max = 5) => {
  let out = '';
  for (let i = 1; i <= max; i++) out += `<span class="dot${i <= level ? ' on' : ''}"></span>`;
  return out;
};

const totalModules = ROADMAP.reduce((n, p) => n + p.sections.length, 0);

// ── Overview table rows ──
const overviewRows = ROADMAP.map((p, i) => {
  const c = COLORS[PHASE_COLORS[i]] || '#c2533c';
  return `<tr>
    <td class="ov-num"><span class="ov-chip" style="background:${c}">${String(p.id).padStart(2, '0')}</span></td>
    <td class="ov-title">${esc(p.title)}<span class="ov-short">${esc(p.short)}</span></td>
    <td class="ov-weeks">${esc(p.weeks)}</td>
    <td class="ov-mods">${p.sections.length}</td>
    <td class="ov-diff"><span class="dots">${dots(p.difficulty)}</span></td>
  </tr>`;
}).join('');

// ── Phase sections ──
const phasesHtml = ROADMAP.map((p, i) => {
  const c = COLORS[PHASE_COLORS[i]] || '#c2533c';
  const modules = p.sections.map((s) => `
    <div class="module">
      <div class="module__head">
        <span class="module__num" style="color:${c}">${esc(s.n)}</span>
        <span class="module__title">${esc(s.title)}</span>
      </div>
      <ul class="module__items">
        ${s.items.map((it) => `<li>${esc(it)}</li>`).join('')}
      </ul>
    </div>`).join('');

  return `<section class="phase" style="--c:${c}">
    <div class="phase__band">
      <div class="phase__numwrap"><span class="phase__num">${String(p.id).padStart(2, '0')}</span></div>
      <div class="phase__headtext">
        <div class="phase__meta">
          <span class="phase__weeks">${esc(p.weeks)}</span>
          <span class="phase__dot">·</span>
          <span class="phase__detail">${esc(p.weeksDetail)}</span>
          <span class="phase__diff"><span class="phase__diff-label">Difficulty</span><span class="dots">${dots(p.difficulty)}</span></span>
        </div>
        <h2 class="phase__title">${esc(p.title)}</h2>
        <p class="phase__summary">${esc(p.summary)}</p>
      </div>
    </div>
    <div class="phase__modules">${modules}</div>
    <div class="phase__endstate">
      <span class="endstate__label">End state</span>
      <p class="endstate__text">${esc(p.endState)}</p>
    </div>
  </section>`;
}).join('');

// ── Capstones ──
const capstonesHtml = CAPSTONES.map((cp) => `
  <section class="capstone">
    <div class="capstone__head">
      <span class="capstone__n">Capstone ${cp.n}</span>
      <h3 class="capstone__title">${esc(cp.title)}</h3>
      <div class="capstone__meta">${esc(cp.phase)}</div>
      <div class="capstone__domain"><strong>Domain:</strong> ${esc(cp.domain)}</div>
    </div>
    <div class="capstone__build">
      <span class="sub-label">What you build</span>
      <ul>${cp.build.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </div>
    <div class="capstone__stack">
      <span class="sub-label">Stack</span>
      <div class="chips">${cp.stack.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
    </div>
    <div class="capstone__proves"><strong>Proves:</strong> ${esc(cp.proves)}</div>
  </section>`).join('');

// ── Out of scope ──
const oosHtml = OUT_OF_SCOPE.map((o) => `
  <div class="oos">
    <h4 class="oos__title">${esc(o.title)}</h4>
    <p class="oos__why">${esc(o.why)}</p>
    <p class="oos__pointer"><strong>Where to start later:</strong> ${esc(o.pointer)}</p>
  </div>`).join('');

// ── Next steps ──
const nextHtml = NEXT_STEPS.map((n) => `
  <div class="next">
    <span class="next__label">${esc(n.label)}</span>
    <h4 class="next__title">${esc(n.title)}</h4>
    <p class="next__body">${esc(n.body)}</p>
  </div>`).join('');

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#f4f1ec; --card:#ffffff; --ink:#1a1814; --dim:rgba(26,24,20,.74);
    --faint:rgba(26,24,20,.5); --line:rgba(28,24,20,.12); --line-strong:rgba(28,24,20,.22);
    --rust:#c2533c; --amber:#d18a2a; --purple:#6b4d80;
  }
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);
    font-family:'Inter Tight',-apple-system,system-ui,sans-serif;font-size:10.5pt;line-height:1.5;}
  h1,h2,h3,h4{margin:0;font-weight:600;letter-spacing:-.01em;}
  p{margin:0;}
  ul{margin:0;padding:0;list-style:none;}
  .serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:0;}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;}

  /* difficulty dots */
  .dots{display:inline-flex;gap:3px;align-items:center;vertical-align:middle;}
  .dot{width:6px;height:6px;border-radius:50%;background:rgba(28,24,20,.18);display:inline-block;}
  .dot.on{background:var(--c,var(--rust));}

  /* ── COVER ── */
  .cover{height:100vh;display:flex;flex-direction:column;justify-content:space-between;
    padding:26mm 22mm;position:relative;overflow:hidden;
    background:
      radial-gradient(120% 80% at 50% 120%, color-mix(in srgb,var(--rust) 26%, transparent) 0%, transparent 60%),
      radial-gradient(100% 70% at 85% -10%, color-mix(in srgb,var(--purple) 22%, transparent) 0%, transparent 55%),
      var(--bg);
    page-break-after:always;}
  .cover__bar{height:8px;width:160px;border-radius:8px;
    background:linear-gradient(90deg,var(--rust),var(--amber),var(--purple));}
  .cover__kicker{margin-top:18px;font-size:11pt;letter-spacing:.32em;text-transform:uppercase;color:var(--rust);font-weight:600;}
  .cover__title{font-size:46pt;line-height:1.02;margin-top:14px;max-width:15ch;}
  .cover__title em{font-style:italic;}
  .cover__sub{margin-top:20px;font-size:13.5pt;color:var(--dim);max-width:44ch;line-height:1.45;}
  .cover__stats{display:flex;gap:34px;margin-top:30px;}
  .cover__stat .n{font-size:30pt;font-weight:700;line-height:1;letter-spacing:-.02em;
    background:linear-gradient(135deg,var(--rust),var(--amber));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .cover__stat .l{font-size:9pt;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin-top:7px;}
  .cover__foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:10pt;color:var(--dim);}
  .cover__foot strong{color:var(--ink);font-weight:600;}
  .cover__author{font-size:14pt;}

  /* ── SECTION SHELL ── */
  .sheet{padding:18mm 18mm 16mm;}
  .section-head{display:flex;align-items:baseline;gap:14px;border-bottom:2px solid var(--ink);
    padding-bottom:10px;margin-bottom:18px;}
  .section-head h2{font-size:22pt;}
  .section-head .idx{font-size:11pt;color:var(--faint);font-weight:500;letter-spacing:.1em;}
  .lead{color:var(--dim);font-size:11pt;max-width:62ch;margin:-6px 0 20px;}

  /* ── OVERVIEW TABLE ── */
  table.ov{width:100%;border-collapse:collapse;}
  table.ov th{text-align:left;font-size:8pt;letter-spacing:.14em;text-transform:uppercase;
    color:var(--faint);font-weight:600;padding:0 10px 8px;border-bottom:1px solid var(--line-strong);}
  table.ov td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:middle;}
  .ov-chip{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;
    color:#fff;font-weight:700;font-size:11pt;font-family:'JetBrains Mono',monospace;}
  .ov-title{font-weight:600;font-size:11.5pt;}
  .ov-short{display:block;font-weight:400;color:var(--faint);font-size:9pt;margin-top:1px;}
  .ov-weeks{color:var(--dim);white-space:nowrap;font-size:10pt;}
  .ov-mods{text-align:center;color:var(--dim);}
  .ov-diff{text-align:right;}

  /* ── PHASE ── */
  .phase{page-break-before:always;break-inside:avoid;}
  .phase__band{display:flex;gap:18px;align-items:stretch;
    background:linear-gradient(100deg, color-mix(in srgb,var(--c) 13%, var(--card)), var(--card));
    border:1px solid color-mix(in srgb,var(--c) 35%, transparent);
    border-left:6px solid var(--c);
    border-radius:14px;padding:16px 18px;margin-bottom:16px;break-inside:avoid;}
  .phase__numwrap{display:flex;align-items:center;}
  .phase__num{font-family:'JetBrains Mono',monospace;font-size:34pt;font-weight:500;color:var(--c);line-height:1;
    opacity:.9;}
  .phase__headtext{flex:1;}
  .phase__meta{display:flex;align-items:center;gap:9px;font-size:9pt;color:var(--dim);flex-wrap:wrap;}
  .phase__weeks{font-weight:600;color:var(--c);letter-spacing:.04em;text-transform:uppercase;font-size:8.5pt;}
  .phase__dot{color:var(--faint);}
  .phase__diff{margin-left:auto;display:inline-flex;align-items:center;gap:7px;}
  .phase__diff-label{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);}
  .phase__title{font-size:20pt;margin:5px 0 6px;letter-spacing:-.02em;}
  .phase__summary{color:var(--dim);font-size:10.5pt;line-height:1.45;max-width:64ch;}

  .phase__modules{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
  .module{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:12px 13px;
    break-inside:avoid;}
  .module__head{display:flex;gap:8px;align-items:baseline;margin-bottom:7px;
    padding-bottom:7px;border-bottom:1px solid var(--line);}
  .module__num{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:9.5pt;}
  .module__title{font-weight:600;font-size:11pt;letter-spacing:-.01em;}
  .module__items li{position:relative;padding-left:14px;color:var(--dim);font-size:9.3pt;line-height:1.42;margin:3px 0;}
  .module__items li::before{content:"";position:absolute;left:2px;top:6px;width:4px;height:4px;border-radius:50%;
    background:var(--c);opacity:.65;}

  .phase__endstate{margin-top:14px;background:color-mix(in srgb,var(--c) 8%, var(--card));
    border:1px solid color-mix(in srgb,var(--c) 26%, transparent);border-radius:11px;padding:12px 15px;
    break-inside:avoid;}
  .endstate__label{font-size:8pt;letter-spacing:.16em;text-transform:uppercase;color:var(--c);font-weight:700;}
  .endstate__text{margin-top:5px;font-size:10.5pt;line-height:1.45;color:var(--ink);}
  .phase__endstate .endstate__text{font-family:'Instrument Serif',Georgia,serif;font-size:13pt;line-height:1.4;}

  /* ── CAPSTONES ── */
  .capstone{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--rust);
    border-radius:13px;padding:16px 18px;margin-bottom:14px;break-inside:avoid;}
  .capstone__n{font-size:8.5pt;letter-spacing:.18em;text-transform:uppercase;color:var(--rust);font-weight:700;}
  .capstone__title{font-size:15pt;margin:5px 0 6px;letter-spacing:-.01em;}
  .capstone__meta{font-size:9pt;color:var(--faint);font-family:'JetBrains Mono',monospace;}
  .capstone__domain{font-size:10pt;color:var(--dim);margin-top:6px;}
  .sub-label{display:block;font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);
    font-weight:600;margin:13px 0 6px;}
  .capstone__build ul li{position:relative;padding-left:15px;color:var(--dim);font-size:9.6pt;line-height:1.45;margin:4px 0;}
  .capstone__build ul li::before{content:"";position:absolute;left:3px;top:7px;width:4px;height:4px;border-radius:50%;
    background:var(--rust);opacity:.7;}
  .chips{display:flex;flex-wrap:wrap;gap:6px;}
  .chip{font-family:'JetBrains Mono',monospace;font-size:8.5pt;background:color-mix(in srgb,var(--purple) 9%, var(--card));
    border:1px solid color-mix(in srgb,var(--purple) 30%, transparent);color:var(--purple);
    padding:3px 9px;border-radius:20px;}
  .capstone__proves{margin-top:13px;font-size:10pt;color:var(--ink);
    border-top:1px solid var(--line);padding-top:11px;}
  .capstone__proves strong{color:var(--rust);}

  /* ── OUT OF SCOPE / NEXT ── */
  .oos,.next{background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:14px 16px;margin-bottom:12px;break-inside:avoid;}
  .oos__title{font-size:13pt;margin-bottom:5px;}
  .oos__why{color:var(--dim);font-size:10pt;line-height:1.5;}
  .oos__pointer{margin-top:8px;font-size:9.5pt;color:var(--ink);}
  .oos__pointer strong,.next__label{color:var(--rust);}
  .next__label{font-size:8pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;}
  .next__title{font-size:13pt;margin:4px 0 5px;}
  .next__body{color:var(--dim);font-size:10pt;line-height:1.5;}

  .endcap{text-align:center;margin-top:26px;padding-top:18px;border-top:1px solid var(--line);
    color:var(--faint);font-size:9.5pt;}
  .endcap strong{color:var(--ink);}
</style></head>
<body>

  <!-- COVER -->
  <div class="cover">
    <div>
      <div class="cover__bar"></div>
      <div class="cover__kicker">The Agentic AI Engineer</div>
      <h1 class="cover__title serif">The 2026 <em>Agentic&nbsp;AI</em> Engineer Roadmap</h1>
      <p class="cover__sub">A complete, production-grade curriculum — from Python foundations to multi-agent systems, guardrails, and AWS deployment.</p>
      <div class="cover__stats">
        <div class="cover__stat"><div class="n">26</div><div class="l">Weeks</div></div>
        <div class="cover__stat"><div class="n">${ROADMAP.length}</div><div class="l">Phases</div></div>
        <div class="cover__stat"><div class="n">${totalModules}</div><div class="l">Modules</div></div>
        <div class="cover__stat"><div class="n">${CAPSTONES.length}</div><div class="l">Capstones</div></div>
      </div>
    </div>
    <div class="cover__foot">
      <div><div class="cover__author serif">Balaji Chippada</div><div>AI Engineer &amp; Educator</div></div>
      <div style="text-align:right"><strong>balajichippada.com/roadmap</strong><br>${today}</div>
    </div>
  </div>

  <!-- OVERVIEW -->
  <div class="sheet">
    <div class="section-head"><h2 class="serif">The roadmap at a glance</h2></div>
    <p class="lead">Nine phases over twenty-six weeks. Each builds directly on the last — the order is the point. Difficulty is relative to where you are when you reach it, not absolute.</p>
    <table class="ov">
      <thead><tr><th>#</th><th>Phase</th><th>Timeline</th><th style="text-align:center">Modules</th><th style="text-align:right">Difficulty</th></tr></thead>
      <tbody>${overviewRows}</tbody>
    </table>
  </div>

  <!-- PHASES -->
  ${phasesHtml}

  <!-- CAPSTONES -->
  <div class="sheet" style="page-break-before:always;">
    <div class="section-head"><h2 class="serif">Capstone projects</h2></div>
    <p class="lead">Three production-grade systems, built as you go. These are your portfolio — the proof you can ship, not just follow tutorials.</p>
    ${capstonesHtml}
  </div>

  <!-- OUT OF SCOPE -->
  <div class="sheet" style="page-break-before:always;">
    <div class="section-head"><h2 class="serif">Deliberately out of scope</h2></div>
    <p class="lead">What this roadmap leaves out on purpose — and where to pick it up later, once you've shipped your first agent.</p>
    ${oosHtml}
  </div>

  <!-- NEXT STEPS -->
  <div class="sheet" style="page-break-before:always;">
    <div class="section-head"><h2 class="serif">After the roadmap</h2></div>
    <p class="lead">You've built three systems. Here's how to turn them into a job.</p>
    ${nextHtml}
    <div class="endcap">
      <strong>The 2026 Agentic AI Engineer Roadmap</strong> · Balaji Chippada<br>
      Free &amp; open at balajichippada.com/roadmap · YouTube @balajichippada
    </div>
  </div>

</body></html>`;

// ── Render to PDF ──
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluateHandle('document.fonts.ready');
await new Promise((r) => setTimeout(r, 300));

const outPath = path.join(root, 'Agentic-AI-Engineer-Roadmap-2026.pdf');
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  // Reserve a bottom band for the running footer so content never collides with
  // it. The footer strip is painted in the paper colour so the page still reads
  // as full-bleed warm paper rather than a white margin.
  margin: { top: '0', bottom: '13mm', left: '0', right: '0' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;height:13mm;margin:0;box-sizing:border-box;
    background:#f4f1ec;border-top:1px solid rgba(28,24,20,0.10);
    font-size:7pt;color:#9a938a;font-family:'Inter Tight',-apple-system,sans-serif;
    padding:0 18mm;display:flex;justify-content:space-between;align-items:center;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <span>The 2026 Agentic AI Engineer Roadmap · Balaji Chippada</span>
    <span class="pageNumber"></span></div>`,
});

await browser.close();
console.log(`PDF written: ${outPath}`);
