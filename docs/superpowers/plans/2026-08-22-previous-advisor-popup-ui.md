# Previous Advisor Popup UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan directly. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the previous advisor popup appearance without changing the shared widget’s current behavior or backend.

**Architecture:** Keep `advisor-widget.js` as the single implementation. Rebuild only its generated modal DOM with the previous `cv3` card, icon-field, WhatsApp, and success-state structure, then reuse the retained previous CSS with widget-scoped theme-variable fallbacks for static pages.

**Tech Stack:** Vanilla browser JavaScript, existing CSS tokens, Puppeteer, Node test runner.

## Global Constraints

- Do not change the sticky **Talk to us** button.
- Do not change submission, validation, reCAPTCHA, endpoint, throttling, or stored lead schema.
- Preserve all current accessibility and stale-async protections.
- The popup must remain fully inside desktop and mobile viewports throughout its animation.
- Do not commit, push, or deploy.

---

### Task 1: Restore and verify the previous popup UI

**Files:**
- Modify: `tests/advisor-widget.test.mjs`
- Modify: `advisor-widget.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: existing `window.AdvisorWidget` lifecycle and submission methods.
- Produces: previous popup DOM and styling with unchanged widget API.

- [ ] Add failing browser assertions for `.cv3-eyebrow`, five icon-led
  `.cv3-field` controls, placeholders, `.cv3-enquiry-note`, close SVG,
  `.cv3-whatsapp-btn`, and `.cv3-advisor-success`.
- [ ] Run `node --test tests/advisor-widget.test.mjs` and confirm the new UI
  assertions fail against the current popup.
- [ ] Rebuild `buildModal()` using the previous nested backdrop/dialog/card
  structure while retaining current `advisor-widget-*` hooks and accessibility
  attributes.
- [ ] Update `showSuccess()` to render the previous checkmark, confirmation
  text, and Close button.
- [ ] Reuse the retained previous `cv3` modal/form styles, define the required
  `--cv3-*` variables on the shared modal for static pages, and remove
  conflicting current widget-form presentation rules.
- [ ] Run widget tests, then `npm test`, `npm run verify`, syntax checks, lint
  checks, and light/dark desktop/mobile visual validation.
