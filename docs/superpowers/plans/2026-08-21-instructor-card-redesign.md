# Shared Instructor Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shared instructor section into a responsive image-left/content-right card matching the certificate showcase.

**Architecture:** Preserve the shared `CoursesInstructorSection` JSX and all existing content. Make the change centrally through its existing `.cv3-instructor*` CSS selectors so Course, Home, and Full Roadmap receive the same design without duplicate markup.

**Tech Stack:** React global JSX, semantic CSS variables, Node test runner, Puppeteer.

## Global Constraints

- Keep all existing biography copy, quote, stats, and social links.
- Apply the card consistently wherever `CoursesInstructorSection` renders.
- Preserve the portrait's `4 / 5` aspect ratio and top-positioned crop.
- Keep the section theme-aware and free of horizontal overflow.
- Do not create a git commit unless the user explicitly requests one.

---

### Task 1: Add regression coverage

**Files:**
- Modify: `tests/prerender.test.mjs`

**Interfaces:**
- Consumes: the shared instructor JSX and `.cv3-instructor*` CSS.
- Produces: one regression test for the unified card contract.

- [ ] Assert that `CoursesInstructorSection` remains shared across all three
  page contexts.
- [ ] Assert that `.cv3-instructor` uses the normal page surface instead of a
  full-width contrasting band.
- [ ] Assert that `.cv3-instructor-inner` has a semantic border, `28px` radius,
  restrained accent treatment, and a two-column desktop grid.
- [ ] Assert that the portrait stays in the first grid column and retains its
  `4 / 5` aspect ratio.
- [ ] Assert that stats use a translucent semantic surface.
- [ ] Assert that the existing `1040px` breakpoint stacks the card.
- [ ] Run the focused test and confirm it fails before changing production CSS.

### Task 2: Implement the shared card

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Produces: the card presentation through existing selectors without changing
  `CoursesInstructorSection` props or content.

- [ ] Replace the full-width band styling with the normal page background.
- [ ] Restyle `.cv3-instructor-inner` as a max-width card with `48px` padding,
  a `28px` radius, semantic border, elevated surface, and rust-tinted radial
  accent.
- [ ] Keep a left portrait and right content grid with a compact gap.
- [ ] Add an inset portrait frame and restrained shadow.
- [ ] Lighten the nested statistic chips.
- [ ] Update tablet/mobile padding and center the stacked portrait.
- [ ] Run the focused test and confirm it passes.

### Task 3: Build and verify

**Files:**
- Generated: `app.build.js`, `index.html`, `roadmap.html`
- Modify: `index.html`, `roadmap.html`

- [ ] Run `npm run build`.
- [ ] Bump `styles.css` cache versions consistently in both HTML files.
- [ ] Run `npm test && npm run verify`.
- [ ] Check lints for edited source and tests.
- [ ] Capture Course, Home, and Full Roadmap instructor sections in both themes
  and mobile/desktop layouts; verify no overflow and correct image placement.
