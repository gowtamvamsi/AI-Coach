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

test('app bundle — courses tab includes creator-led landing sections (v3 design)', () => {
  const js = read('app.build.js');
  assert.match(js, /cv3-creator-visual/, 'courses page has creator-led hero visual');
  assert.match(js, /uploads\/Hero_section_light\.png/, 'creator hero uses the approved composite artwork');
  assert.match(js, /uploads\/Hero_Section_Dark_mODE\.png/, 'dark theme uses its dedicated composite artwork');
  assert.doesNotMatch(js, /uploads\/Hero_Section\.png/, 'superseded cutout portrait is not rendered');
  assert.doesNotMatch(js, /hero_Section_bacground(?:_dark_mode)?\.png/, 'old hero background artwork is removed');
  assert.match(js, /Enroll Now/, 'hero enrollment CTA uses approved capitalization');
  assert.match(js, /Talk to an Advisor/, 'hero includes the advisor CTA');
  assert.match(js, /cv3-advisor-modal/, 'advisor form opens in a modal');
  assert.match(js, /cv3-hero-cta-chevrons/, 'hero enrollment CTA includes double chevrons');
  assert.match(js, /cv3-curriculum-detail/, 'courses page has master-detail curriculum');
  assert.match(js, /cv3-pricing-card/, 'courses page has pricing card');
});

test('course advisor — lead persistence keeps the existing Firestore schema', () => {
  const source = read('app.jsx');
  const start = source.indexOf('function CoursesEnquiryCard');
  const end = source.indexOf('// Small inline icons for the curriculum section', start);
  assert.ok(start >= 0 && end > start, 'enquiry component source block exists');
  const block = source.slice(start, end);

  assert.match(block, /db\.collection\('leads'\)\.add\(\{/, 'writes to the existing leads collection');
  for (const field of ['name', 'email', 'phone', 'occupation', 'message', 'createdAt']) {
    assert.match(block, new RegExp(`\\b${field}:`), `preserves ${field} field`);
  }
  assert.match(block, /source:\s*'course_enquiry'/, 'preserves course_enquiry source value');
  assert.match(block, /FieldValue\.serverTimestamp\(\)/, 'preserves server timestamp');
  assert.match(block, /phoneError\(phone,\s*true\)/, 'phone is required for the promised callback');
  assert.match(block, /course advisor will call you within 24 hours/, 'shows the callback confirmation');
});

test('course hero — primary and advisor CTAs share identical dimensions and typography', () => {
  const css = read('styles.css');
  const rule = css.match(/\.cv3-hero-ctas \.cv3-btn\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /height:\s*52px/, 'both hero CTAs have one explicit height');
  assert.match(rule, /font-family:\s*inherit/, 'anchor and button use the same font family');
  assert.match(rule, /font-weight:\s*600/, 'both CTA labels use the same weight');
  assert.match(rule, /line-height:\s*1/, 'browser-specific button line height is normalized');
  assert.match(rule, /padding:\s*0 14px/, 'both CTAs reserve enough room for their icons');
  assert.match(rule, /white-space:\s*nowrap/, 'CTA labels stay on one line');
  assert.match(css, /width:\s*calc\(\(100% - 14px\) \/ 2\);[^}]*flex:\s*0 0 calc\(\(100% - 14px\) \/ 2\)/, 'mobile CTAs split the row into exactly equal widths');
});

test('course hero — advisor CTA is visibly actionable and the old kicker is removed', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  const advisorRule = css.match(/\.cv3-btn--advisor\s*\{([^}]*)\}/)?.[1] || '';

  assert.doesNotMatch(source, /Creator-led · Production-first/, 'old creator-led kicker is not rendered');
  assert.match(source, /cv3-advisor-cta-icon/, 'advisor CTA includes a clear phone icon');
  assert.match(advisorRule, /background:\s*color-mix\([^;]+var\(--cv3-accent\)/, 'advisor CTA has an accent-tinted background');
  assert.match(advisorRule, /border:\s*1px solid color-mix\([^;]+var\(--cv3-accent\)/, 'advisor CTA has an accent border');
  assert.match(advisorRule, /color:\s*var\(--cv3-accent\)/, 'advisor CTA label uses the accent color');
  assert.match(css, /@media \(max-width: 620px\) \{[\s\S]*?\.cv3-advisor-cta-icon \{ display: none; \}/, 'phone icon hides when mobile width is constrained');
});

test('course hero — the three-item skills checklist is removed completely', () => {
  const source = read('app.jsx');
  const data = read('data.js');
  const css = read('styles.css');

  assert.doesNotMatch(source, /instr\.heroChips|cv3-hero-chips?/, 'hero no longer renders the skills checklist');
  assert.doesNotMatch(data, /heroChips|Build RAG and tool-using agents|Learn evaluation and observability|Deploy real-world production workflows/, 'removed checklist copy is not retained in course data');
  assert.doesNotMatch(css, /\.cv3-hero-chips?/, 'unused checklist styling is removed');
});

test('course page — sections follow the prospective buyer decision journey', () => {
  const source = read('app.jsx');
  const start = source.indexOf('function CoursesTabView');
  const end = source.indexOf('// ADMIN — Course enquiries panel', start);
  assert.ok(start >= 0 && end > start, 'course page source block exists');
  const page = source.slice(start, end);
  const markers = [
    'className="cv3-trust"',
    'id="cv3-course"',
    '<CoursesCurriculumV3',
    'id="cv3-projects"',
    'id="cv3-highlights"',
    '<CoursesInstructorSection',
    'id="cv3-pricing"',
    '<CoursesFAQ',
  ];
  const positions = markers.map((marker) => page.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0), 'all buyer-journey sections exist');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'sections appear in the approved buyer journey order');
});

test('course instructor — shared section uses the unified editorial card', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  const sectionRule = css.match(/\.cv3-instructor\s*\{([^}]*)\}/)?.[1] || '';
  const layoutRule = css.match(/\.cv3-instructor-inner\s*\{([^}]*)\}/)?.[1] || '';
  const photoRule = css.match(/\.cv3-instructor-photo\s*\{([^}]*)\}/)?.[1] || '';
  const statRule = css.match(/\.cv3-instructor-stat\s*\{([^}]*)\}/)?.[1] || '';
  const uses = source.match(/<CoursesInstructorSection\s*\/>/g) || [];

  assert.equal(uses.length, 3, 'one shared instructor component serves Course, Home, and Full Roadmap');
  assert.match(sectionRule, /background:\s*var\(--cv3-paper\)/, 'section remains on the normal page surface');
  assert.match(layoutRule, /grid-template-columns:\s*minmax\(280px,\s*0\.82fr\)\s+minmax\(0,\s*1\.18fr\)/, 'desktop card keeps portrait left and biography right');
  assert.match(layoutRule, /padding:\s*48px/, 'card uses the same spacious inset as the certificate card');
  assert.match(layoutRule, /border:\s*1px solid var\(--cv3-line\)/, 'card uses the shared semantic border');
  assert.match(layoutRule, /border-radius:\s*28px/, 'card matches the certificate radius');
  assert.match(layoutRule, /background:[^;]*radial-gradient\([^;]+var\(--cv3-accent\)/, 'card includes the restrained rust-tinted accent');
  assert.match(photoRule, /aspect-ratio:\s*4\s*\/\s*5/, 'portrait crop remains unchanged');
  assert.match(photoRule, /justify-self:\s*end/, 'portrait aligns toward the biography');
  assert.match(statRule, /background:\s*color-mix\([^;]+var\(--cv3-paper\)/, 'nested stats use lightweight semantic chips');
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*?\.cv3-instructor-inner\s*\{\s*grid-template-columns:\s*1fr;[^}]*padding:\s*38px/, 'shared card stacks at the existing tablet breakpoint');
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*?\.cv3-instructor-photo\s*\{[^}]*justify-self:\s*center/, 'stacked portrait is centered');
});

test('course projects — section follows the active page theme', () => {
  const css = read('styles.css');
  const sectionRule = css.match(/\.cv3-projects\s*\{([^}]*)\}/)?.[1] || '';
  const cardRule = css.match(/\.cv3-project\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(sectionRule, /background:\s*var\(--cv3-paper\)/, 'projects use the normal page surface');
  assert.match(sectionRule, /color:\s*var\(--cv3-ink\)/, 'projects inherit theme-aware foreground color');
  assert.match(cardRule, /background:\s*var\(--cv3-paper2\)/, 'project cards use the normal elevated surface');
  assert.match(cardRule, /border:\s*1px solid var\(--cv3-line\)/, 'project cards use the normal theme border');
  assert.match(css, /\.cv3-project-title\s*\{[^}]*color:\s*var\(--cv3-ink\)/, 'project titles adapt to light and dark themes');
  assert.match(css, /\.cv3-project-desc\s*\{[^}]*color:\s*var\(--cv3-ink2\)/, 'project descriptions adapt to light and dark themes');
});

test('course projects — first nine cards use numbered light and dark artwork', () => {
  const source = read('app.jsx');
  const data = read('data.js');
  const css = read('styles.css');
  const artwork = [
    'uploads/Project1-light_mode.png',
    'uploads/project1-dark-mode.png',
    'uploads/project2_light_mode.png',
    'uploads/project2_dark_mode.png',
    'uploads/project3_light_mode.png',
    'uploads/project3_dark_mode.png',
    'uploads/project4_light_mode.png',
    'uploads/project4_dark_mode.png',
    'uploads/project5_light_mode.png',
    'uploads/project5_dark_mode.png',
    'uploads/project6_light_mode.png',
    'uploads/project6_dark_mode.png',
    'uploads/project7_light_mode.png',
    'uploads/project7_dark_mode.png',
    'uploads/project8_light_mode.png',
    'uploads/project8_dark_mode.png',
    'uploads/project9_light_mode.png',
    'uploads/project9_dark_mode.png',
  ];
  for (const path of artwork) {
    assert.match(data, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `course data maps ${path}`);
  }
  assert.match(source, /p\.lightImage\s*&&\s*p\.darkImage/, 'artwork cards retain a generic fallback');
  assert.match(source, /cv3-project-art--light/, 'light artwork is rendered');
  assert.match(source, /cv3-project-art--dark/, 'dark artwork is rendered');
  assert.match(data, /title:\s*"Upgrade Your Chatbot With Agentic Power"/, 'project 05 copy matches its artwork');
  assert.match(data, /title:\s*"Advanced RAG System"/, 'project 06 copy matches its artwork');
  assert.match(data, /title:\s*"Build MCP Server for Google Services & Integrate with Chatbot"/, 'project 07 copy matches its artwork');
  assert.match(data, /title:\s*"Memory-Powered Personalized Chatbot"/, 'project 08 copy matches its artwork');
  assert.match(data, /title:\s*"LangGraph Multi-Agent System"/, 'project 09 copy matches its artwork');
  assert.match(css, /\.cv3-projects-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/, 'desktop grid keeps the project gallery compact');
  assert.match(css, /\.cv3-project-visual--art\s*\{[^}]*aspect-ratio:\s*2\.35\s*\/\s*1/, 'artwork crop excludes its duplicated text panel');
  assert.match(css, /\.cv3-project-art--dark\s*\{\s*display:\s*none/, 'dark artwork is hidden in light mode');
  assert.match(css, /\[data-theme="dark"\]\s+\.cv3-project-art--light\s*\{\s*display:\s*none/, 'light artwork is hidden in dark mode');
  assert.match(css, /\[data-theme="dark"\]\s+\.cv3-project-art--dark\s*\{\s*display:\s*block/, 'dark artwork appears in dark mode');
});

test('course projects — gallery expands automatically when more than six projects exist', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  assert.match(source, /showAllProjects,\s*setShowAllProjects/, 'course page tracks expanded project state');
  assert.match(source, /projects\.slice\(0,\s*showAllProjects\s*\?\s*projects\.length\s*:\s*6\)/, 'collapsed gallery shows the first six projects');
  assert.match(source, /projects\.length\s*>\s*6/, 'expand control stays hidden until additional projects exist');
  assert.match(source, /aria-expanded=\{showAllProjects\}/, 'expand control exposes its state accessibly');
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.cv3-projects-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*1fr\)/, 'tablet gallery uses two columns');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.cv3-projects-grid\s*\{\s*grid-template-columns:\s*1fr/, 'mobile gallery uses one column');
});

test('public audience metrics — current subscriber and roadmap-view figures are consistent', () => {
  const files = [
    'index.html',
    'roadmap.html',
    'site.config.js',
    'data.js',
    'v2.jsx',
    'seo.config.js',
    'seo-inject.js',
    'about.html',
    'guides/how-to-become-an-agentic-ai-engineer.html',
    'llms.txt',
    'functions/skill-mentor-reply/references/course.md',
    'functions/skill-mentor-reply/references/roadmap.md',
  ];
  const publicText = files.map(read).join('\n');

  assert.match(read('site.config.js'), /youtubeSubs:\s*'35K\+'/, 'central config exposes 35K+ subscribers');
  assert.match(read('site.config.js'), /roadmapViews:\s*'230K\+'/, 'central config exposes 230K+ roadmap views');
  assert.match(read('data.js'), /\{\s*num:\s*"35K\+",\s*label:\s*"Subscribers"\s*\}/, 'course instructor uses the current subscriber count');
  assert.match(read('data.js'), /\{\s*num:\s*"230K\+",\s*label:\s*"Roadmap views"\s*\}/, 'course instructor uses the current roadmap-view count');
  assert.doesNotMatch(publicText, /26K\+|170K\+/, 'public source no longer contains stale audience figures');
});

test('site contact bar — permanent support details sit above navigation', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  const start = source.indexOf('function SiteContactBar');
  const end = source.indexOf('\nfunction ', start + 1);
  const contact = source.slice(start, end);
  const renderAt = source.indexOf('<SiteContactBar />');
  const navAt = source.indexOf('{motion ? (', renderAt);

  assert.ok(start >= 0 && end > start, 'contact-bar component exists');
  assert.ok(renderAt >= 0 && navAt > renderAt, 'contact bar renders before navigation');
  assert.match(contact, /role="region"[\s\S]*?aria-label="Contact information"/, 'contact strip is exposed as a labeled region');
  assert.match(contact, /\+91 XXXXXXXXXX/, 'temporary phone number is displayed');
  assert.doesNotMatch(contact, /href=["']tel:/, 'temporary phone number is not an invalid telephone link');
  assert.match(contact, /href="mailto:team@balajichippada\.com"/, 'email address is actionable');
  assert.doesNotMatch(source, /<V2TopBanner\b/, 'old enrollment banner no longer competes for the top slot');
  assert.match(css, /--top-banner-h:\s*38px/, 'desktop reserves space for the permanent bar');
  assert.match(css, /\.site-contact-bar\s*\{[^}]*position:\s*fixed;[^}]*top:\s*0/, 'contact strip stays fixed at the top');
  assert.match(css, /\.nav\s*\{[^}]*top:\s*var\(--top-banner-h\)/, 'navigation sits directly below the contact strip');
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?--top-banner-h:\s*44px[\s\S]*?\.site-contact-bar__prompt\s*\{\s*display:\s*none/, 'mobile contact strip is compact');
});

test('course certificate — earned credential follows projects with an accessible full-size preview', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  const pageStart = source.indexOf('function CoursesTabView');
  const pageEnd = source.indexOf('// ADMIN — Course enquiries panel', pageStart);
  const page = source.slice(pageStart, pageEnd);
  const projectsAt = page.indexOf('id="cv3-projects"');
  const certificateAt = page.indexOf('<CoursesCertificateSection');
  const highlightsAt = page.indexOf('id="cv3-highlights"');

  assert.ok(projectsAt >= 0 && certificateAt > projectsAt && highlightsAt > certificateAt, 'certificate appears directly between Projects and Highlights');
  assert.match(source, /logos\/FLA Course Completion Certificate\.svg/, 'uses the supplied certificate artwork');
  assert.match(source, /Complete the full course/, 'requires full course completion');
  assert.match(source, /every assignment reviewed and approved/, 'requires every assignment to pass review');
  assert.match(source, /Complete all mock interviews/, 'requires completion of every mock interview');
  assert.match(source, /alt="Sample Forward Learning Academy course completion certificate"/, 'certificate artwork has descriptive alt text');
  assert.match(source, /role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?aria-labelledby="cv3-certificate-preview-title"/, 'full-size preview is an accessible dialog');
  assert.match(source, /event\.key === 'Escape'/, 'Escape closes the certificate preview');
  assert.match(source, /previousFocusRef\.current\?\.focus\(\)/, 'closing the preview restores focus');
  assert.match(css, /\.cv3-certificate-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.8fr\)\s+minmax\(0,\s*1\.2fr\)/, 'desktop certificate uses the approved split layout');
  assert.match(css, /\.cv3-certificate-image\s*\{[^}]*object-fit:\s*contain/, 'certificate remains uncropped');
  assert.match(css, /@media \(max-width: 1040px\)[\s\S]*?\.cv3-certificate-layout\s*\{\s*grid-template-columns:\s*1fr/, 'certificate stacks at narrower widths');
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

test('masterclass duration is 120 minutes', () => {
  // The masterclass hero moved off the prerendered homepage (home now shows
  // Courses); duration renders at runtime from site.config.js, so assert there.
  const config = read('site.config.js');
  assert.match(config, /duration:\s*120\b/, 'site.config.js masterclass duration is 120');

  const html = read('index.html') + read('roadmap.html');
  assert.doesNotMatch(html, /\b180 min\b/, 'prerendered pages no longer show 180 min duration');
});
