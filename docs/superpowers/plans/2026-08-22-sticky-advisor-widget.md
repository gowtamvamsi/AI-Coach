# Sticky Advisor Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating WhatsApp button with one shared sticky **Talk to us** widget that opens the same advisor form on every public page and securely stores compatible `course_enquiry` leads through a same-origin endpoint.

**Architecture:** A hand-authored `advisor-widget.js` owns the sticky control, modal, validation, reCAPTCHA execution, accessibility, and submission UI on both React and static pages. A gen1 `courseEnquiry` HTTPS function validates the request, verifies reCAPTCHA, applies transactional Firestore throttles, and writes the existing lead schema. The React hero calls the widget’s global API instead of mounting a second form.

**Tech Stack:** Vanilla browser JavaScript, React globals, CSS, Firebase Hosting, Firebase Cloud Functions gen1 on Node.js 20, Firestore Admin SDK, Google reCAPTCHA v3, Node’s built-in test runner, and Puppeteer.

## Global Constraints

- Preserve the stored fields exactly: `name`, `email`, `phone`, `occupation`, `message`, `source: "course_enquiry"`, and server-generated `createdAt`.
- Keep the success copy exactly: `Thanks—your request is in. A course advisor will call you within 24 hours.`
- Phone remains mandatory.
- Desktop uses a rust pill with phone icon and **Talk to us**; mobile uses a compact rust phone button above the enrollment bar.
- Remove only the floating WhatsApp button; retain **Talk to us on WhatsApp** inside the advisor modal.
- Show the widget on public pages only. Hide it for `/account`, `/dashboard`, `/email-tasks`, `/courses`, open navigation drawers, and open modals.
- Use `/api/course-enquiry`, reCAPTCHA action `course_enquiry`, minimum score `0.5`, five submissions per IP hash or normalized email per hour, and a ten-minute duplicate cooldown for the same email and phone.
- Accept production origins `https://balajichippada.com` and `https://www.balajichippada.com`; accept `http://localhost:<port>` and `http://127.0.0.1:<port>` only for local development.
- Fail closed when reCAPTCHA configuration is unavailable; never fall back to an unprotected production submission.
- Do not change the current requester email or add developer notifications in this feature.
- Never edit generated `app.build.js` or `v2.build.js` directly.
- Do not commit, push, or deploy unless the user explicitly requests it. Never commit `.env`, service-account JSON, or `firebase.json`.
- Preserve the `GCLOUD_PROJECT` fallback at the top of `functions/index.js`.

## File Structure

**Create**

- `advisor-widget.js` — shared browser widget, global API, modal, validation, reCAPTCHA, and submission state.
- `functions/lib/course-enquiry.js` — pure request validation, origin checks, hashing, throttling decisions, and injectable HTTP handler.
- `tests/course-enquiry.test.mjs` — server helper and HTTP contract tests.
- `tests/advisor-widget.test.mjs` — browser-level widget behavior and accessibility tests.

**Modify**

- `functions/index.js` — wire the tested handler to Firestore, reCAPTCHA verification, and the `courseEnquiry` function export.
- `firebase.json` — add the `/api/course-enquiry` rewrite before the SPA catch-all; keep this file out of commits/pushes.
- `firestore.rules` — deny anonymous direct `course_enquiry` writes after endpoint cutover while preserving other lead sources.
- `site.config.js` — add the public reCAPTCHA site key under `contact`.
- `app.jsx` — remove the React-owned advisor form/state and call `window.AdvisorWidget`.
- `v2.jsx` — remove `V2WhatsAppButton`.
- `styles.css` — replace WhatsApp FAB styles with widget styles and move the advisor modal styles to widget selectors.
- `index.html`, `roadmap.html` — load the widget and synchronize cache-bust versions.
- `about.html`, `privacy.html`, `terms.html`, `glossary.html`, `masterclasses.html`, `guides/how-to-become-an-agentic-ai-engineer.html` — load `site.config.js` and `advisor-widget.js`.
- `tests/prerender.test.mjs` — assert the shared widget contract and compatible endpoint payload.
- `package.json` — include the two new tests in `npm test`.

---

### Task 1: Build and test the server-side enquiry contract

**Files:**
- Create: `functions/lib/course-enquiry.js`
- Create: `tests/course-enquiry.test.mjs`

**Interfaces:**
- Produces: `normalizePayload(body) -> { ok, value?, errors? }`
- Produces: `isAllowedOrigin(origin) -> boolean`
- Produces: `getClientIp(req) -> string`
- Produces: `hashLimitKey(kind, value, secret) -> string`
- Produces: `rateDecision(existing, nowMs) -> { allow, next }`
- Produces: `isDuplicate(existing, nowMs) -> boolean`
- Produces: `createHandler({ verifyRecaptcha, submitLead, hashSecret, now }) -> async (req, res)`

- [ ] **Step 1: Write failing normalization and validation tests**

Add tests covering:

```javascript
test('normalizePayload — returns the exact stored lead shape', () => {
  const result = enquiry.normalizePayload({
    name: '  Asha Rao  ',
    email: ' ASHA@EXAMPLE.COM ',
    phone: ' +91 98765 43210 ',
    occupation: 'Student',
    message: '  Please call after 6 PM.  ',
    recaptchaToken: 'token',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.lead, {
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+91 98765 43210',
    occupation: 'Student',
    message: 'Please call after 6 PM.',
    source: 'course_enquiry',
  });
  assert.equal(result.value.recaptchaToken, 'token');
});

test('normalizePayload — requires name, email, phone, and token', () => {
  const result = enquiry.normalizePayload({});
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['email', 'name', 'phone', 'recaptchaToken']);
});

test('normalizePayload — rejects unknown and oversized fields', () => {
  assert.equal(enquiry.normalizePayload({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+919876543210',
    occupation: '',
    message: '',
    recaptchaToken: 'token',
    role: 'admin',
  }).ok, false);
  assert.equal(enquiry.normalizePayload({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+919876543210',
    occupation: '',
    message: 'x'.repeat(1001),
    recaptchaToken: 'token',
  }).ok, false);
});
```

Use exact limits: name `2–80`, email `3–254`, phone input at most `32` characters containing `7–15` digits, occupation at most `80`, message at most `1000`, and reCAPTCHA token at most `4096`.

- [ ] **Step 2: Run the tests and confirm the red state**

Run:

```bash
node --test tests/course-enquiry.test.mjs
```

Expected: failure because `functions/lib/course-enquiry.js` does not exist.

- [ ] **Step 3: Implement pure normalization, origin, hashing, and limit helpers**

Start the module with these constants and exports:

```javascript
const crypto = require('crypto');

const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const RECAPTCHA_MIN_SCORE = 0.5;
const RECAPTCHA_ACTION = 'course_enquiry';
const ALLOWED_FIELDS = new Set([
  'name', 'email', 'phone', 'occupation', 'message', 'recaptchaToken',
]);
```

Implement the signatures listed in **Interfaces**. `normalizePayload` must never copy `recaptchaToken` into `lead`, and `hashLimitKey` must use:

```javascript
crypto.createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex')
```

`getClientIp` must use the first comma-separated value from `x-forwarded-for`, then `req.ip`, then an empty string. `isAllowedOrigin` must use the exact production origins and anchored localhost/127.0.0.1 regular expressions.

- [ ] **Step 4: Add and run rate-limit tests**

Test:

```javascript
test('rateDecision — allows five requests and resets after one hour', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(enquiry.rateDecision(null, now), {
    allow: true,
    next: { windowStart: now, count: 1, updatedAt: now },
  });
  assert.equal(enquiry.rateDecision({ windowStart: now - 1000, count: 5 }, now).allow, false);
  assert.equal(enquiry.rateDecision({
    windowStart: now - enquiry.RATE_WINDOW_MS - 1,
    count: 99,
  }, now).allow, true);
});

test('isDuplicate — blocks the same lead for ten minutes', () => {
  const now = 1_700_000_000_000;
  assert.equal(enquiry.isDuplicate(null, now), false);
  assert.equal(enquiry.isDuplicate({ lastSubmittedAt: now - 1000 }, now), true);
  assert.equal(enquiry.isDuplicate({
    lastSubmittedAt: now - enquiry.DUPLICATE_WINDOW_MS - 1,
  }, now), false);
});
```

Run:

```bash
node --test tests/course-enquiry.test.mjs
```

Expected: all pure helper tests pass.

- [ ] **Step 5: Add HTTP handler contract tests**

Use an in-memory `req` and chainable `res` helper. Cover:

- `405` for non-POST.
- `415` for non-JSON.
- `413` when `req.rawBody.length > 8192`.
- `403` for absent/disallowed origin.
- `400` for invalid fields.
- `403` for rejected reCAPTCHA.
- `429` when `submitLead` returns `{ ok: false, reason: "rate" }` or `{ ok: false, reason: "duplicate" }`.
- `200` with `{ ok: true }` only after `submitLead` succeeds.
- `500` with `{ ok: false, message: "We couldn’t submit your request. Please try again." }` without leaked exception text.

The handler dependency contract is:

```javascript
const handler = enquiry.createHandler({
  verifyRecaptcha: async ({ token, remoteIp, expectedAction, minScore }) => ({
    ok: token === 'good-token' &&
      expectedAction === 'course_enquiry' &&
      minScore === 0.5,
  }),
  submitLead: async ({ lead, ip, nowMs }) => ({ ok: true }),
  hashSecret: 'test-rate-secret',
  now: () => 1_700_000_000_000,
});
```

- [ ] **Step 6: Run the server contract tests**

Run:

```bash
node --test tests/course-enquiry.test.mjs
```

Expected: all tests pass.

---

### Task 2: Wire the Cloud Function, transactional throttles, and Hosting route

**Files:**
- Modify: `functions/index.js`
- Modify: `firebase.json`
- Modify: `firestore.rules`
- Modify: `tests/course-enquiry.test.mjs`

**Interfaces:**
- Consumes: `courseEnquiryLib.createHandler(...)`
- Produces: exported gen1 HTTPS function `courseEnquiry`
- Produces: same-origin route `POST /api/course-enquiry`

- [ ] **Step 1: Add a failing source-contract test**

Assert that `functions/index.js`:

- Requires `./lib/course-enquiry`.
- Exports `courseEnquiry` with `functions.https.onRequest`.
- Uses `admin.firestore.FieldValue.serverTimestamp()` for the lead.
- Runs the two rate documents, duplicate document, and lead write in one transaction.

Also assert that `firebase.json` contains `/api/course-enquiry` before `**`.

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --test tests/course-enquiry.test.mjs
```

Expected: source-contract assertions fail because the function and rewrite are absent.

- [ ] **Step 3: Add reCAPTCHA verification and transactional persistence**

At the top of `functions/index.js`, preserve the existing environment fallback and add:

```javascript
const courseEnquiryLib = require("./lib/course-enquiry");
```

Implement `verifyCourseEnquiryRecaptcha` using native `fetch` against:

```text
https://www.google.com/recaptcha/api/siteverify
```

POST URL-encoded `secret`, `response`, and `remoteip`. Return `ok: true` only when Google returns `success: true`, `action === "course_enquiry"`, and `score >= 0.5`.

Implement `submitCourseEnquiryLead({ lead, ip, nowMs })` with one Firestore transaction:

1. HMAC the IP, normalized email, and `${email}|${phone}` using `COURSE_ENQUIRY_HASH_SECRET`.
2. Read:
   - `courseEnquiryLimits/ip_<hash>`
   - `courseEnquiryLimits/email_<hash>`
   - `courseEnquiryLimits/duplicate_<hash>`
3. Apply `rateDecision` to both hourly documents and `isDuplicate` to the duplicate document.
4. If blocked, return a non-writing `{ ok: false, reason }`.
5. Otherwise set the two counters, set `lastSubmittedAt` on the duplicate doc, and create a new `leads` document with the exact schema and a server timestamp.
6. Set `expiresAt` values so old limiter records can be cleaned up later; do not require a TTL policy for correctness.

- [ ] **Step 4: Export the HTTP function with fail-closed configuration**

Wire:

```javascript
exports.courseEnquiry = functions.https.onRequest(courseEnquiryLib.createHandler({
  verifyRecaptcha: verifyCourseEnquiryRecaptcha,
  submitLead: submitCourseEnquiryLead,
  hashSecret: process.env.COURSE_ENQUIRY_HASH_SECRET || "",
}));
```

The handler must return `503` before validating user data when either `RECAPTCHA_SECRET_KEY` or `COURSE_ENQUIRY_HASH_SECRET` is missing.

- [ ] **Step 5: Add the Hosting rewrite**

Insert before the `**` rewrite:

```json
{
  "source": "/api/course-enquiry",
  "function": "courseEnquiry"
}
```

Do not commit or push `firebase.json`.

- [ ] **Step 6: Tighten only course-enquiry client writes**

Change the lead create rule to preserve non-course lead capture:

```text
allow create: if (
  request.resource.data.source != 'course_enquiry' &&
  request.resource.data.keys().hasAll(['email', 'source']) &&
  isValidEmail(request.resource.data.email)
) || isStaff();
```

Do not deploy this rule until the function, rewrite, and widget have been deployed and verified.

- [ ] **Step 7: Run backend and syntax checks**

Run:

```bash
node --test tests/course-enquiry.test.mjs
node --check functions/index.js
node --check functions/lib/course-enquiry.js
```

Expected: all tests and syntax checks pass.

---

### Task 3: Define the shared widget’s browser contract with failing tests

**Files:**
- Create: `tests/advisor-widget.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces test requirements for `window.AdvisorWidget.init`, `.open(trigger)`, `.close()`, `.setEnabled(boolean)`, and `.destroy()`.

- [ ] **Step 1: Add a Puppeteer fixture**

Launch Puppeteer once for the test file. For each test:

1. Use `page.setContent` with a `<button id="trigger">Open</button>`.
2. Set:

```javascript
window.SITE_CONFIG = {
  brand: { whatsappCommunity: 'https://example.com/whatsapp' },
  contact: { recaptchaSiteKey: 'test-site-key' },
};
window.grecaptcha = {
  ready: (cb) => cb(),
  execute: async () => 'test-token',
};
window.fetch = async (url, options) => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true }),
});
```

3. Load `advisor-widget.js` with `page.addScriptTag({ path })`.

- [ ] **Step 2: Add failing widget behavior tests**

Cover:

- Initialization creates exactly one `.advisor-widget-sticky`.
- Desktop text is **Talk to us** and the accessible name is **Talk to us**.
- `open(trigger)` creates a single `role="dialog"` modal, applies `body.modal-open`, and focuses the first field.
- `close()` removes the modal/body state and restores trigger focus.
- Escape and backdrop click close the dialog.
- `setEnabled(false)` hides the sticky control and closes an open dialog.
- The modal contains **Talk to us on WhatsApp** with the configured URL.
- Empty submission shows name/email/phone errors without calling fetch.
- Valid submission calls `grecaptcha.execute('test-site-key', { action: 'course_enquiry' })`.
- Fetch posts the normalized fields and `recaptchaToken` to `/api/course-enquiry`.
- Success copy matches the approved sentence.
- A failed request retains values and leaves WhatsApp available.
- Repeated submit clicks while pending make one request.

- [ ] **Step 3: Register the tests and confirm they fail**

Update `package.json`:

```json
"test": "node --test tests/logic.test.mjs tests/prerender.test.mjs tests/otp.test.mjs tests/course-enquiry.test.mjs tests/advisor-widget.test.mjs"
```

Run:

```bash
node --test tests/advisor-widget.test.mjs
```

Expected: failure because `advisor-widget.js` does not exist.

---

### Task 4: Implement the shared advisor widget and styling

**Files:**
- Create: `advisor-widget.js`
- Modify: `styles.css`
- Modify: `site.config.js`
- Test: `tests/advisor-widget.test.mjs`

**Interfaces:**
- Consumes: `window.SITE_CONFIG.brand.whatsappCommunity`
- Consumes: `window.SITE_CONFIG.contact.recaptchaSiteKey`
- Produces: `window.AdvisorWidget`

- [ ] **Step 1: Add the reCAPTCHA site configuration**

After creating a production reCAPTCHA v3 key for:

- `balajichippada.com`
- `www.balajichippada.com`
- `localhost`

Add `contact.recaptchaSiteKey` to `window.SITE_CONFIG` with the exact public
site-key value returned by Google.

The public key may be committed; `RECAPTCHA_SECRET_KEY` must exist only in Cloud Function environment variables. If keys cannot be created or supplied, stop this task and report the credential blocker instead of adding a sample key.

- [ ] **Step 2: Implement one self-initializing IIFE**

`advisor-widget.js` must:

- Guard against double initialization.
- Render the sticky button on `DOMContentLoaded`.
- Dynamically load `https://www.google.com/recaptcha/api.js?render=<site-key>` once.
- Implement local validation using the same limits as `normalizePayload`.
- Build modal DOM with `textContent` and fixed attributes; never inject user input with `innerHTML`.
- Submit JSON through `fetch('/api/course-enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })`.
- Store no enquiry values or tokens in localStorage/sessionStorage.
- Toggle `body.modal-open`.
- Trap Tab/Shift+Tab within the dialog.
- Restore focus on close.
- Respect `prefers-reduced-motion`.
- Remove all listeners and DOM from `destroy()`.

Expose exactly:

```javascript
window.AdvisorWidget = Object.freeze({
  init,
  open,
  close,
  setEnabled,
  destroy,
});
```

- [ ] **Step 3: Replace floating-contact styles**

Remove `.v2-whatsapp-float*` rules at the current desktop/mobile locations and replace them with:

- `.advisor-widget-sticky`
- `.advisor-widget-sticky__icon`
- `.advisor-widget-sticky__label`
- `.advisor-widget-modal`
- `.advisor-widget-dialog`
- `.advisor-widget-field`
- `.advisor-widget-error`
- `.advisor-widget-success`
- `.advisor-widget-whatsapp`

Use existing design tokens:

- `var(--c-rust)` on static pages.
- `var(--cv3-accent, var(--c-rust))` for the rust accent.
- Existing background/foreground/line variables for light/dark compatibility.

Required positioning:

```css
.advisor-widget-sticky {
  position: fixed;
  right: max(16px, env(safe-area-inset-right, 16px));
  bottom: max(24px, env(safe-area-inset-bottom, 24px));
  z-index: 899;
}

@media (max-width: 768px) {
  .advisor-widget-sticky {
    right: max(14px, env(safe-area-inset-right, 14px));
    bottom: max(92px, calc(80px + env(safe-area-inset-bottom, 0px)));
  }
}
```

Hide it under:

```css
body.modal-open .advisor-widget-sticky,
body.nav-menu-open .advisor-widget-sticky {
  display: none !important;
}
```

- [ ] **Step 4: Run widget tests**

Run:

```bash
node --test tests/advisor-widget.test.mjs
```

Expected: all widget tests pass.

- [ ] **Step 5: Check browser script syntax**

Run:

```bash
node --check advisor-widget.js
```

Expected: exit code `0`.

---

### Task 5: Integrate the widget with the React application

**Files:**
- Modify: `app.jsx`
- Modify: `v2.jsx`
- Modify: `tests/prerender.test.mjs`
- Test: `tests/advisor-widget.test.mjs`

**Interfaces:**
- Consumes: `window.AdvisorWidget.open(trigger)`
- Consumes: `window.AdvisorWidget.setEnabled(isPublic)`

- [ ] **Step 1: Replace old prerender assertions with shared-widget assertions**

Update the course-advisor test to read `advisor-widget.js` and assert:

- POST to `/api/course-enquiry`.
- Exact lead fields and `source`.
- Mandatory phone validation.
- Approved success copy.
- WhatsApp fallback.

Add assertions that:

- `app.jsx` calls `window.AdvisorWidget.open`.
- `app.jsx` no longer defines `CoursesEnquiryCard`.
- `v2.jsx` no longer defines `V2WhatsAppButton`.
- `app.jsx` no longer renders `<V2WhatsAppButton />`.

- [ ] **Step 2: Run the targeted prerender test and confirm it fails**

Run:

```bash
node --test tests/prerender.test.mjs
```

Expected: shared-widget source assertions fail before integration.

- [ ] **Step 3: Remove the duplicate React modal**

In `app.jsx`:

- Delete `CoursesEnquiryCard`.
- Delete `advisorOpen` from `CoursesTabView`.
- Delete its conditional render.
- Change the hero advisor button to:

```javascript
onClick={(event) => window.AdvisorWidget?.open(event.currentTarget)}
```

- Delete the root `<V2WhatsAppButton />`.

In `v2.jsx`, delete `V2WhatsAppButton`.

- [ ] **Step 4: Gate the widget by active application view**

In the root `App`, add an effect keyed by `activeMainTab`, authentication resolution, `navMenuOpen`, and `anyModalOpen`.

The public set is:

```javascript
const publicTabs = new Set(['home', 'roadmap', 'masterclass']);
```

Call:

```javascript
window.AdvisorWidget?.setEnabled(publicTabs.has(activeMainTab));
```

Continue using `body.modal-open` and `body.nav-menu-open` so the shared CSS hides the sticky control while other overlays are active.

- [ ] **Step 5: Build JavaScript and run targeted tests**

Run:

```bash
npm run build:js
node --test tests/advisor-widget.test.mjs tests/prerender.test.mjs
```

Expected: bundles compile and targeted tests pass.

---

### Task 6: Load the widget on every public page and synchronize cache busts

**Files:**
- Modify: `index.html`
- Modify: `roadmap.html` through prerender generation
- Modify: `about.html`
- Modify: `privacy.html`
- Modify: `terms.html`
- Modify: `glossary.html`
- Modify: `masterclasses.html`
- Modify: `guides/how-to-become-an-agentic-ai-engineer.html`
- Modify: `tests/prerender.test.mjs`

**Interfaces:**
- Consumes: `/site.config.js?v=19`
- Consumes: `/advisor-widget.js?v=1`
- Consumes: `/styles.css?v=142`

- [ ] **Step 1: Add failing asset-coverage tests**

Define:

```javascript
const PUBLIC_PAGES = [
  'index.html',
  'roadmap.html',
  'about.html',
  'privacy.html',
  'terms.html',
  'glossary.html',
  'masterclasses.html',
  'guides/how-to-become-an-agentic-ai-engineer.html',
];
```

For every page assert one `site.config.js`, one `advisor-widget.js`, and `styles.css?v=142`. For `index.html` and `roadmap.html`, assert matching versions for `app.build.js`, `v2.build.js`, `site.config.js`, `styles.css`, and `advisor-widget.js`.

- [ ] **Step 2: Run the coverage test and confirm it fails**

Run:

```bash
node --test tests/prerender.test.mjs
```

Expected: static pages fail because they do not yet load the shared scripts.

- [ ] **Step 3: Add scripts to the source HTML**

In every hand-authored public page, load before `</body>`:

```html
<script src="/site.config.js?v=19"></script>
<script src="/advisor-widget.js?v=1"></script>
```

In `index.html`, load `advisor-widget.js` after `site.config.js` and before `v2.build.js`/`app.build.js`.

- [ ] **Step 4: Bump all changed assets consistently**

Use:

- `styles.css?v=142`
- `site.config.js?v=19`
- `advisor-widget.js?v=1`
- `v2.build.js?v=37`
- `app.build.js?v=120`

Ensure `index.html` and generated `roadmap.html` agree exactly. Do not hand-edit generated `roadmap.html`; run the build.

- [ ] **Step 5: Build, prerender, and run coverage tests**

Run:

```bash
npm run build
node --test tests/prerender.test.mjs
```

Expected: prerender completes and every public page has the widget assets exactly once.

---

### Task 7: Full verification and release handoff

**Files:**
- Verify all files changed in Tasks 1–6.

**Interfaces:**
- Produces a locally verified release candidate.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm test
npm run verify
node --check advisor-widget.js
node --check functions/index.js
node --check functions/lib/course-enquiry.js
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run local light/dark and responsive checks**

Start the existing local server after checking that port `8000` is not already serving this workspace:

```bash
node scripts/serve.mjs
```

Verify at desktop and mobile widths:

- Course hero CTA and sticky button open the same modal.
- Static About, guide, Glossary, Privacy, and Terms pages open the modal in place.
- The green floating WhatsApp button is absent.
- WhatsApp remains inside the modal.
- Mobile control stays above the enrollment bar and safe area.
- Light/dark colors match existing tokens.
- Escape, backdrop, focus trap, focus restoration, loading, failure, and success states work.
- `/account`, `/dashboard`, `/email-tasks`, and `/courses` do not show the sticky control.

- [ ] **Step 3: Review the deployment sequence without executing it**

When the user explicitly authorizes deployment, execute in this order:

1. Set `RECAPTCHA_SECRET_KEY` and `COURSE_ENQUIRY_HASH_SECRET` on the new function. Do not expose either value in logs or Git.
2. Deploy `courseEnquiry` with `functions/lib/course-enquiry.js` included.
3. Update the live Hosting config so `/api/course-enquiry` precedes the SPA catch-all.
4. Deploy Hosting with the widget and verified cache-bust versions.
5. Submit one controlled enquiry through the live UI and confirm one compatible lead document.
6. Deploy the source-specific Firestore rule that blocks anonymous direct `course_enquiry` writes.
7. Confirm non-course lead capture still works.
8. Confirm the live HTML with a cache-busting request.

Do not write test data directly to production Firestore. The controlled enquiry must use the live public endpoint and be removed only if the user authorizes deletion.

- [ ] **Step 4: Report the verified result and remaining launch dependencies**

Report:

- Automated test status.
- Public pages checked.
- Whether reCAPTCHA credentials are configured.
- Whether function/Hosting/rules deployment remains pending.
- That requester email personalization and developer notifications remain separate tasks.
