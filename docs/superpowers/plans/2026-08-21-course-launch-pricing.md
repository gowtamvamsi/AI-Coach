# Course Launch Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the ₹34,999 standard price and ₹29,999 manually controlled launch offer consistently in both public course-pricing surfaces.

**Architecture:** Store all launch-pricing copy and values in `window.COURSE_INFO`, render them through one shared React component, and style compact/full variants with the existing course design tokens. Keep the current page order and enrollment-button behavior unchanged.

**Tech Stack:** React JSX, global configuration in `data.js`, CSS, esbuild, Node.js test runner, static prerendering

## Global Constraints

- Standard price is `₹34,999`.
- Launch price is `₹29,999`.
- Offer copy is `Launch offer · First 45 days`.
- GST caption is `18% GST is already included and paid to the Government.`
- Do not display a calendar deadline.
- Do not add countdown, expiry, date calculation, or automatic price switching.
- Keep the current section order and enrollment-button behavior.
- Preserve responsive and light/dark theme behavior.
- Do not commit, push, deploy Hosting, or deploy Functions unless the user explicitly requests it.

---

### Task 1: Add Shared Launch-Pricing Data and Rendering

**Files:**
- Modify: `tests/prerender.test.mjs`
- Modify: `data.js`
- Modify: `app.jsx`
- Modify: `functions/skill-mentor-reply/references/course.md`

**Interfaces:**
- Consumes: `window.COURSE_INFO`, existing `CoursesTabView`, and the current `priceFmt` behavior.
- Produces: `CoursesPriceDisplay({ info, full })`, where `info` is `window.COURSE_INFO` and `full` is an optional boolean selecting the full pricing-card variant.

- [ ] **Step 1: Write the failing pricing regression test**

Add this test after the existing course-page journey test in `tests/prerender.test.mjs`:

```javascript
test('course pricing — one shared launch offer renders in both pricing surfaces', () => {
  const source = read('app.jsx');
  const data = read('data.js');
  const info = data.slice(
    data.indexOf('window.COURSE_INFO'),
    data.indexOf('window.COURSE_PROJECTS'),
  );

  assert.match(info, /price:\s*29999/, 'launch price is ₹29,999');
  assert.match(info, /listPrice:\s*34999/, 'standard price is ₹34,999');
  assert.match(info, /priceOfferLabel:\s*"Launch offer · First 45 days"/, 'launch label is centralized');
  assert.match(info, /priceTaxCaption:\s*"18% GST is already included and paid to the Government\."/, 'GST caption is centralized');
  assert.doesNotMatch(info, /Will reveal soon/, 'placeholder price is removed');
  assert.doesNotMatch(info, /offerEnd|offerExpiry|countdown|deadline/i, 'offer has no automatic expiry');
  assert.match(source, /function CoursesPriceDisplay\(\{\s*info,\s*full\s*=\s*false\s*\}\)/, 'shared price component exists');
  assert.equal((source.match(/<CoursesPriceDisplay\b/g) || []).length, 2, 'both public price surfaces use the shared component');
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern="one shared launch offer" tests/prerender.test.mjs
```

Expected: FAIL because `data.js` still contains `Will reveal soon`.

- [ ] **Step 3: Replace placeholder pricing with explicit launch data**

Replace the existing `price` line in `window.COURSE_INFO` in `data.js` with:

```javascript
  price: 29999,
  listPrice: 34999,
  priceOfferLabel: "Launch offer · First 45 days",
  priceTaxCaption: "18% GST is already included and paid to the Government.",
```

- [ ] **Step 4: Add the shared price component**

Add this immediately before `CoursesTabView` in `app.jsx`:

```javascript
function CoursesPriceDisplay({ info, full = false }) {
  const formatPrice = (value) => (
    typeof value === 'number' ? '₹' + value.toLocaleString('en-IN') : value
  );
  const currentPriceClass = full ? 'cv3-pricing-price' : 'cv3-price';
  const note = full
    ? 'One-time payment · Inclusive of GST · No subscription'
    : 'Inclusive of GST · No subscription';

  return (
    <div className={`cv3-price-display ${full ? 'cv3-price-display--full' : 'cv3-price-display--compact'}`}>
      <div className="cv3-price-offer-line">
        <span className="cv3-price-list">{formatPrice(info.listPrice)}</span>
        <span className="cv3-price-offer-badge">{info.priceOfferLabel}</span>
      </div>
      <div className={currentPriceClass}>{formatPrice(info.price)}</div>
      <div className="cv3-price-note">{note}</div>
      <div className="cv3-price-tax-caption">{info.priceTaxCaption}</div>
    </div>
  );
}
```

Remove the now-unused `priceFmt` declaration from `CoursesTabView`.

- [ ] **Step 5: Replace both duplicated price surfaces**

In the flagship side panel, preserve the `One-time payment` label and replace its price/note markup with:

```jsx
<CoursesPriceDisplay info={info} />
```

In the full pricing card, replace its price/note markup with:

```jsx
<CoursesPriceDisplay info={info} full />
```

Do not change either enrollment CTA.

- [ ] **Step 6: Correct the stale internal course-reference note**

Change the fee line in `functions/skill-mentor-reply/references/course.md` to:

```markdown
- **Fee:** **INR 29,999** launch offer (standard price **INR 34,999**), one-time, inclusive of 18% GST, no subscription. The public offer is manually controlled and currently active.
```

- [ ] **Step 7: Run the focused test and confirm GREEN**

Run:

```bash
node --test --test-name-pattern="one shared launch offer" tests/prerender.test.mjs
```

Expected: PASS.

---

### Task 2: Style and Verify the Launch Offer

**Files:**
- Modify: `tests/prerender.test.mjs`
- Modify: `styles.css`
- Generated: `app.build.js`
- Generated: `roadmap.html`
- Modify: `index.html`

**Interfaces:**
- Consumes: Class names emitted by `CoursesPriceDisplay`.
- Produces: Responsive compact and full price layouts using existing `--cv3-*` tokens.

- [ ] **Step 1: Extend the regression test with visual-contract assertions**

Add these assertions to the same pricing test:

```javascript
  const css = read('styles.css');
  assert.match(css, /\.cv3-price-list\s*\{[^}]*text-decoration:\s*line-through/, 'standard price is struck through');
  assert.match(css, /\.cv3-price-offer-badge\s*\{[^}]*background:\s*var\(--cv3-accent-soft\)/, 'launch offer uses the existing accent treatment');
  assert.match(css, /\.cv3-price-tax-caption\s*\{[^}]*font-size:\s*11px/, 'GST explanation stays visually secondary');
  assert.match(css, /\.cv3-price-display--full\s*\{[^}]*align-items:\s*center/, 'full pricing card remains centered');
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test --test-name-pattern="one shared launch offer" tests/prerender.test.mjs
```

Expected: FAIL on `standard price is struck through`.

- [ ] **Step 3: Add launch-pricing styles**

Add beside the existing `.cv3-price*` rules in `styles.css`:

```css
.cv3-price-display { display: flex; flex-direction: column; align-items: flex-start; }
.cv3-price-display--full { align-items: center; }
.cv3-price-offer-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.cv3-price-list {
  color: var(--cv3-ink3);
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}
.cv3-price-offer-badge {
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--cv3-accent-soft);
  color: var(--cv3-accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
}
.cv3-price,
.cv3-pricing-price { color: var(--cv3-accent); }
.cv3-price-tax-caption {
  max-width: 360px;
  margin-top: 6px;
  color: var(--cv3-ink3);
  font-size: 11px;
  line-height: 1.4;
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
node --test --test-name-pattern="one shared launch offer" tests/prerender.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Build production assets**

Run:

```bash
npm run build
```

Expected: bundles build and both public routes prerender successfully.

- [ ] **Step 6: Bump all changed public asset versions**

In both `index.html` and `roadmap.html`, update:

```text
styles.css?v=140    → styles.css?v=141
data.js?v=33        → data.js?v=34
app.build.js?v=118  → app.build.js?v=119
```

- [ ] **Step 7: Run complete verification**

Run:

```bash
npm test
npm run verify
```

Expected: all tests pass and both routes report `PASS`.

- [ ] **Step 8: Verify responsive light/dark rendering**

Using the existing local preview at `http://localhost:8000`, inspect desktop and mobile widths in light and dark themes. Confirm:

- Both pricing surfaces show `₹34,999`, `₹29,999`, the launch badge, and GST caption.
- The struck price and launch badge do not overflow on mobile.
- The early price remains compact and left-aligned.
- The full pricing card remains centered.
- No horizontal page overflow occurs.

- [ ] **Step 9: Check diagnostics and repository scope**

Check diagnostics for `app.jsx`, `data.js`, `styles.css`, and
`tests/prerender.test.mjs`, then run:

```bash
git diff --check
git status --short
```

Expected: no new diagnostics or whitespace errors; no credential files are staged or exposed.
