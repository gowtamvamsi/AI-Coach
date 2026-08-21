# Advisor Country-Code Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan directly. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-locale-aware country-code dropdown to the shared advisor form while continuing to store one normalized `phone` field.

**Architecture:** Move the existing complete country-code dataset into one classic-script global consumed by both `v2.jsx` and `advisor-widget.js`. The advisor widget keeps country selection and national-number entry separate in the UI, but combines them into one `+<dial><digits>` value before existing validation and submission.

**Tech Stack:** Classic browser JavaScript, React globals, CSS, Puppeteer, Node test runner, Firebase Cloud Functions/Firestore contract tests.

## Global Constraints

- Use browser locale only; make no geolocation or IP lookup.
- Fall back to India (`IN`, `+91`).
- Keep the Firestore lead shape unchanged and store only `phone`.
- Keep the existing protected endpoint, rate limits, duplicate checks, and popup design.
- Do not add a runtime dependency.
- Do not commit, push, or deploy without a new explicit request.

---

### Task 1: Shared country data

**Files:**
- Create: `phone-countries.js`
- Modify: `v2.jsx:170-458`
- Modify: `tests/helpers/load-globals.mjs:1-56`
- Modify: `tests/logic.test.mjs`

**Interfaces:**
- Produces: `window.PHONE_COUNTRIES` as `{ iso, dial, name, max? }[]`.
- Produces: `window.PHONE_COUNTRY_UTILS.flag(iso)` and
  `window.PHONE_COUNTRY_UTILS.inferIso(languages)`.
- Consumes: those globals in `V2PhoneField` without changing its public props.

- [ ] Add failing tests proving the shared list contains representative regions,
  shared calling codes, and locale inference for `en-GB`, `en-US`, `hi-IN`,
  unsupported locales, and missing regions.
- [ ] Run `node --test tests/logic.test.mjs` and confirm the globals are absent.
- [ ] Move the exact country entries currently at `v2.jsx:179-383` into
  `phone-countries.js`; implement flag generation and locale inference with an
  `Intl.Locale` path plus BCP-47 region parsing fallback.
- [ ] Load `phone-countries.js` in the VM helper before `v2.build.js`, and make
  `V2_DIAL_CODES` and `v2Flag()` consume the shared globals with an India-only
  fallback.
- [ ] Run `npm run build:js` and `node --test tests/logic.test.mjs`.

### Task 2: Advisor selector and payload

**Files:**
- Modify: `advisor-widget.js`
- Modify: `styles.css`
- Modify: `tests/advisor-widget.test.mjs`
- Test contract: `tests/course-enquiry.test.mjs`

**Interfaces:**
- Consumes: `window.PHONE_COUNTRIES` and `window.PHONE_COUNTRY_UTILS`.
- Produces: a country `<select name="phoneCountry">` and national
  `<input name="phone">`.
- Produces: existing submission payload key `phone` formatted as
  `+<selected dial digits><national digits>`.

- [ ] Add failing browser tests for detected-country selection, India fallback,
  full option population, selected flag/code display, digit-only national input,
  country changes, and exact `phone` payload composition.
- [ ] Run `node --test tests/advisor-widget.test.mjs` and confirm the selector
  assertions fail.
- [ ] Load the shared data script in the Puppeteer fixture before the widget.
- [ ] Build the compact country selector inside the existing `.cv3-field` phone
  row, update its display and maximum national length on change, and combine the
  selected dial code with local digits inside `readFormValues()`.
- [ ] Add CSS for the compact selected flag/code, native select overlay,
  divider, caret, focus state, and narrow mobile widths without changing the
  surrounding popup.
- [ ] Keep server payload validation and lead fields unchanged; extend the
  existing exact-shape test to assert that `country` and `countryCode` are not
  stored.
- [ ] Run the widget and enquiry test files.

### Task 3: Public-page loading and verification

**Files:**
- Modify: `index.html`
- Generated: `roadmap.html`
- Modify: `about.html`
- Modify: `privacy.html`
- Modify: `terms.html`
- Modify: `glossary.html`
- Modify: `masterclasses.html`
- Modify: `guides/how-to-become-an-agentic-ai-engineer.html`
- Modify: `tests/prerender.test.mjs`

**Interfaces:**
- Loads: `phone-countries.js` before `advisor-widget.js` and `v2.build.js`.

- [ ] Add failing public-page asset assertions for exactly one
  `phone-countries.js` load before the widget.
- [ ] Add the shared script to every public page and assign synchronized
  cache-bust versions for `phone-countries.js`, `advisor-widget.js`,
  `v2.build.js`, and `styles.css`.
- [ ] Run `npm run build`, `npm test`, `npm run verify`, `node --check` on both
  classic scripts, lints, and `git diff --check`.
- [ ] Capture desktop/mobile light/dark popup screenshots and verify no clipping
  or horizontal overflow.
