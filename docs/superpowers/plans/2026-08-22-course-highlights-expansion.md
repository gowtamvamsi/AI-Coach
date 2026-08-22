# Course Highlights Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the course highlights section to twelve buyer-focused cards covering learning access, support, practice, and career preparation.

**Architecture:** Keep the existing `highlights` data-driven rendering and card component. Replace the eight-item data array with the approved twelve-item content, add a source-contract test, rebuild generated assets, and bump only the changed application bundle version.

**Tech Stack:** React via global JSX, inline SVG icons, esbuild transform, Node test runner, prerender verification.

## Global Constraints

- Render exactly twelve highlight cards.
- Keep four desktop columns, two tablet columns, and one mobile column.
- Preserve existing card styling, hover behavior, animations, and theme behavior.
- Promise exactly two one-to-one mock interviews.
- Promise doubt resolution within 24 working hours.
- State that every module includes quizzes, interview questions, and assignments.
- Do not change pricing, curriculum data, certificate eligibility, or backend behavior.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Structure

- `app.jsx`: owns the course-highlight data and SVG icons.
- `tests/prerender.test.mjs`: verifies the approved copy, count, and responsive grid.
- `app.build.js`: generated browser artifact from `app.jsx`.
- `index.html` and `roadmap.html`: carry the synchronized cache-bust version for `app.build.js`.

### Task 1: Expand and verify course highlights

**Files:**
- Modify: `tests/prerender.test.mjs`
- Modify: `app.jsx:5216-5225`
- Generate: `app.build.js`
- Generate: `index.html`
- Generate: `roadmap.html`

**Interfaces:**
- Consumes: the existing `highlights` array shape `[label, description, ReactElement]`.
- Produces: twelve `.cv3-highlight` cards rendered by the unchanged highlights map.

- [ ] **Step 1: Write the failing source-contract test**

Add a test that extracts the `highlights` array from `app.jsx`, asserts twelve
entries, checks the approved promises, and confirms the responsive CSS remains
four/two/one columns:

```javascript
test('course highlights — twelve cards cover support, practice, and career preparation', () => {
  const source = read('app.jsx');
  const css = read('styles.css');
  const start = source.indexOf('const highlights = [');
  const end = source.indexOf('\\n  ];', start);
  const highlights = source.slice(start, end);

  assert.equal((highlights.match(/^    \\['/gm) || []).length, 12);
  assert.match(highlights, /Two 1-to-1 Mock Interviews/);
  assert.match(highlights, /two personal mock interviews with actionable feedback/i);
  assert.match(highlights, /Doubt Resolution Within 24 Working Hours/);
  assert.match(highlights, /quizzes, interview questions, and assignments/i);
  assert.match(highlights, /Resume Preparation/);
  assert.match(css, /\\.cv3-highlights\\s*\\{[^}]*grid-template-columns:\\s*repeat\\(4,\\s*1fr\\)/);
  assert.match(css, /\\.cv3-highlights\\s*\\{\\s*grid-template-columns:\\s*repeat\\(2,\\s*1fr\\)/);
  assert.match(css, /\\.cv3-highlights\\s*\\{\\s*grid-template-columns:\\s*1fr/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test --test-name-pattern="course highlights" tests/prerender.test.mjs
```

Expected: FAIL because the source currently contains eight highlight entries
and lacks the new career-support copy.

- [ ] **Step 3: Replace the highlight data with twelve approved cards**

Keep the tuple shape and existing rendering. Use the exact labels and
descriptions from
`docs/superpowers/specs/2026-08-22-course-highlights-expansion-design.md`,
with a distinct existing-style line SVG for each card.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
node --test --test-name-pattern="course highlights" tests/prerender.test.mjs
```

Expected: PASS for the twelve-card highlights contract.

- [ ] **Step 5: Rebuild and update the cache-bust contract**

Run:

```bash
npm run build
```

Update `app.build.js?v=120` to `app.build.js?v=121` in `index.html` and
`roadmap.html`, and update `APPROVED_VERSIONS['app.build.js']` from `120` to
`121` in `tests/prerender.test.mjs`. If the prerender regenerates
`roadmap.html`, apply the same version after the build.

- [ ] **Step 6: Run complete verification**

Run:

```bash
npm test
npm run verify
```

Expected: all tests pass, both prerendered routes pass, and `index.html` and
`roadmap.html` agree on `app.build.js?v=121`.

- [ ] **Step 7: Check edited-file diagnostics and repository state**

Check lints for `app.jsx` and `tests/prerender.test.mjs`, then inspect
`git status --short` and `git diff --check`. Leave unrelated untracked files
untouched and do not commit.
