# Desktop Hero Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the complete course hero closer to the navigation on desktop, including an additional 64px page-level shift, without changing artwork dimensions or mobile spacing.

**Architecture:** Add desktop-only CSS overrides to the course page wrapper and existing hero rules. Protect the breakpoint and mobile behavior with a source-level regression test, then regenerate the production assets and bump the stylesheet cache key.

**Tech Stack:** CSS, React static prerendering, Node.js test runner, esbuild

## Global Constraints

- Apply only at `min-width: 1041px`.
- Set desktop `.cv3` top padding to `calc(var(--layout-top) - 48px)`.
- Set desktop `.cv3-hero` top padding to `0`.
- Preserve horizontal and bottom padding.
- Preserve all hero content and artwork dimensions.
- Preserve the existing mobile rule `.cv3-hero { padding: 42px 18px 10px; }`.
- Do not use transforms, negative margins, or artwork cropping.
- Do not commit, push, or deploy unless the user explicitly requests it.

---

### Task 1: Tighten Desktop Hero Spacing

**Files:**
- Modify: `tests/prerender.test.mjs`
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `roadmap.html`

**Interfaces:**
- Consumes: Existing `.cv3-hero` desktop rule and the `1040px` single-column breakpoint.
- Produces: A desktop-only `.cv3-hero { padding-top: 0; }` override.

- [ ] **Step 1: Write the failing regression test**

Add this test after the existing course-hero tests in `tests/prerender.test.mjs`:

```javascript
test('course hero — desktop content starts closer to navigation without changing mobile spacing', () => {
  const css = read('styles.css');

  assert.match(
    css,
    /@media \(min-width: 1041px\)\s*\{[\s\S]*?\.cv3\s*\{\s*padding-top:\s*calc\(var\(--layout-top\) - 48px\);/,
    'desktop course page shifts the complete hero another 64px upward',
  );
  assert.match(
    css,
    /@media \(min-width: 1041px\)\s*\{[\s\S]*?\.cv3-hero\s*\{\s*padding-top:\s*0;/,
    'desktop hero removes the 64px top gap',
  );
  assert.match(
    css,
    /@media \(max-width: 620px\)\s*\{[\s\S]*?\.cv3-hero\s*\{\s*padding:\s*42px 18px 10px;/,
    'mobile hero spacing remains unchanged',
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern="desktop content starts closer" tests/prerender.test.mjs
```

Expected: FAIL with `desktop hero removes the 64px top gap` because the desktop-only override does not exist.

- [ ] **Step 3: Add the minimal desktop CSS override**

Add this immediately after the base `.cv3-hero` rule in `styles.css`:

```css
@media (min-width: 1041px) {
  .cv3 { padding-top: calc(var(--layout-top) - 48px); }
  .cv3-hero { padding-top: 0; }
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test --test-name-pattern="desktop content starts closer" tests/prerender.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Build production assets**

Run:

```bash
npm run build
```

Expected: `app.jsx` and `v2.jsx` build successfully and `/` plus `/roadmap` prerender successfully.

- [ ] **Step 6: Bump the stylesheet cache key**

In both `index.html` and `roadmap.html`, change:

```html
styles.css?v=138
```

to:

```html
styles.css?v=139
```

Confirm both files use the same version.

- [ ] **Step 7: Run complete verification**

Run:

```bash
npm test
npm run verify
```

Expected: all tests pass and both prerendered routes report `PASS`.

- [ ] **Step 8: Check edited-file diagnostics and repository scope**

Check diagnostics for `styles.css` and `tests/prerender.test.mjs`, then run:

```bash
git diff --check
git status --short
```

Expected: no newly introduced diagnostics or whitespace errors; only the approved spacing change, regression test, generated/cache-bust files, design documentation, and pre-existing untracked files appear.
