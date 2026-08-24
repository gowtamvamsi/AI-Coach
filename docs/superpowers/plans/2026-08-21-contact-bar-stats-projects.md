# Contact Bar, Audience Stats, and Projects 08–09 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish current audience metrics, add Projects 08–09, and install a permanent contact utility bar above navigation.

**Architecture:** Keep metrics and project definitions in existing global configuration files, updating static SEO copies that do not derive at runtime. Add a small `SiteContactBar` component in `app.jsx`, render it once before both navigation variants, and reuse the existing top-banner layout offset variables.

**Tech Stack:** React global JSX, semantic CSS, plain global JavaScript configuration, Node test runner, Puppeteer prerender.

## Global Constraints

- Use `35K+` YouTube subscribers and `230K+` roadmap views consistently.
- Preserve six collapsed project cards and automatic expansion.
- Keep `+91 XXXXXXXXXX` non-clickable until a real phone number exists.
- Link `team@balajichippada.com` with `mailto:`.
- Render only one fixed bar above navigation.
- Do not create a git commit unless explicitly requested.

---

### Task 1: Add failing regression tests

**Files:**
- Modify: `tests/prerender.test.mjs`

- [ ] Add tests for current metrics and absence of stale values in public source.
- [ ] Extend project artwork coverage through Projects 08 and 09 and assert
  their titles.
- [ ] Add contact-bar tests for placement before nav, accessible region,
  `mailto:` email, non-linked temporary phone, responsive CSS, and absence of
  the old `V2TopBanner` render.
- [ ] Run focused tests and confirm they fail for the missing changes.

### Task 2: Update metrics and projects

**Files:**
- Modify: `site.config.js`
- Modify: `data.js`
- Modify: `v2.jsx`
- Modify: `seo.config.js`
- Modify: `seo-inject.js`
- Modify: `about.html`
- Modify: `guides/how-to-become-an-agentic-ai-engineer.html`
- Modify: `llms.txt`
- Modify: `functions/skill-mentor-reply/references/course.md`
- Modify: `functions/skill-mentor-reply/references/roadmap.md`

- [ ] Replace stale audience figures with the approved current values.
- [ ] Add complete Project 08 and Project 09 records with light/dark artwork.
- [ ] Run the focused metric and project tests until green.

### Task 3: Implement the contact utility bar

**Files:**
- Modify: `app.jsx`
- Modify: `styles.css`

- [ ] Add `SiteContactBar` with semantic region labeling and SVG icons.
- [ ] Render it before navigation and stop rendering `V2TopBanner`.
- [ ] Reserve `38px` desktop and `44px` mobile top-bar height.
- [ ] Position navigation below the utility bar and preserve page offsets.
- [ ] Add desktop and mobile contact layouts with no horizontal overflow.
- [ ] Run focused contact tests until green.

### Task 4: Build and verify

**Files:**
- Generated: `app.build.js`, `v2.build.js`, `index.html`, `roadmap.html`
- Modify: `index.html`, `roadmap.html`

- [ ] Run `npm run build`.
- [ ] Bump matching cache versions for changed assets in both HTML files.
- [ ] Run `npm test && npm run verify`.
- [ ] Check lints for edited source and tests.
- [ ] Verify nine projects, contact-bar/nav positioning, light/dark themes, and
  375px/1440px layouts with browser measurements and screenshots.
