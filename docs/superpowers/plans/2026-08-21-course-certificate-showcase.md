# Course Certificate Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, accessible certificate showcase immediately after the Projects section.

**Architecture:** Add a focused `CoursesCertificateSection` React component in `app.jsx` that owns its preview-modal state and focus lifecycle. Style it with course-page semantic tokens in `styles.css`, use the supplied SVG directly, and protect placement, eligibility copy, and accessibility with source-level regression tests.

**Tech Stack:** React globals, JSX transformed by esbuild, semantic CSS variables, Node test runner, Puppeteer prerender.

## Global Constraints

- Preserve the certificate's full aspect ratio without cropping.
- The certificate is earned only after course completion, approval of every assignment, and completion of all mock interviews.
- Do not claim public certificate verification.
- Support light and dark themes and 375px, 768px, 1024px, and 1440px layouts.
- Do not create a git commit unless the user explicitly requests one.

---

### Task 1: Add regression coverage

**Files:**
- Modify: `tests/prerender.test.mjs`

**Interfaces:**
- Consumes: static `app.jsx` and `styles.css` source.
- Produces: a regression test for the certificate section contract.

- [ ] Add a test that asserts:
  - `<CoursesCertificateSection />` occurs after `id="cv3-projects"` and before `id="cv3-highlights"`.
  - The source references `logos/FLA Course Completion Certificate.svg`.
  - Eligibility copy covers course completion, every assignment being reviewed and approved, and all mock interviews.
  - The preview has descriptive alt text and modal state.
  - The dialog uses `role="dialog"`, `aria-modal="true"`, Escape handling, and focus restoration.
  - CSS uses a two-column desktop layout, `object-fit: contain`, and a one-column mobile layout.

- [ ] Run:

```bash
node --test --test-name-pattern="certificate" tests/prerender.test.mjs
```

Expected: FAIL because the certificate section does not exist.

### Task 2: Implement the certificate showcase

**Files:**
- Modify: `app.jsx`
- Modify: `styles.css`

**Interfaces:**
- Produces: `CoursesCertificateSection()` with no props.
- Uses: `useState`, `useEffect`, and `useRef` from the existing React globals.

- [ ] Add `CoursesCertificateSection` near the other Courses-tab components.
- [ ] Render it directly after the Projects section and before Highlights.
- [ ] Add the approved heading, explanatory copy, and three eligibility rows.
- [ ] Render the SVG inside a button with lazy loading, asynchronous decoding,
  descriptive alt text, and a visible `Sample certificate · View full size`
  affordance.
- [ ] Add a full-size modal with backdrop click, close button, Escape handling,
  initial focus, focus restoration, and scroll locking.
- [ ] Add responsive CSS using existing `--cv3-*` tokens. Keep the certificate
  white in both themes and use `object-fit: contain`.
- [ ] Run the focused test and confirm it passes.

### Task 3: Build and verify

**Files:**
- Generated: `app.build.js`
- Generated: `index.html`
- Generated: `roadmap.html`
- Modify: `index.html` and `roadmap.html` cache-bust versions for changed assets.

- [ ] Run `npm run build`.
- [ ] Bump matching `?v=` versions for `app.build.js` and `styles.css` in both
  HTML files.
- [ ] Run `npm test && npm run verify`.
- [ ] Check lints for `app.jsx`, `styles.css`, and `tests/prerender.test.mjs`.
- [ ] Visually verify the section and modal in both themes at desktop and mobile
  widths, confirming no crop or horizontal overflow.
