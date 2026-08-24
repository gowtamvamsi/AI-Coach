# Previous Advisor Popup UI Restoration

## Goal

Restore the visual design of the previous **Talk to a Course Advisor** popup
while preserving the new shared widget and secure submission functionality.

## Visual Requirements

- Reuse the previous `cv3` advisor-modal visual system across every public page.
- Show the **Course guidance** eyebrow and serif popup title.
- Use icon-led fields with placeholders for name, email, phone, occupation, and
  optional message.
- Restore the original rounded enquiry card, blurred backdrop, close SVG,
  secure-information note, callback button, and WhatsApp row.
- Restore the original centered checkmark success state and Close button.
- Preserve light/dark theme behavior and fit the same design responsively on
  mobile without clipping or horizontal overflow.

## Functional Requirements

- Keep `window.AdvisorWidget` as the only popup implementation.
- Keep the current `/api/course-enquiry` endpoint, reCAPTCHA, validation,
  throttling, payload schema, async-generation guard, and error handling.
- Keep keyboard focus trapping, Escape/backdrop dismissal, focus restoration,
  associated field errors, and reduced-motion behavior.
- Keep the sticky **Talk to us** button unchanged.

## Verification

- Browser tests assert the restored eyebrow, field icons, placeholders, secure
  note, close SVG, WhatsApp row, and success state.
- Desktop and mobile visual checks cover both themes and verify the dialog
  remains fully inside the viewport throughout its animation.
- Full build, test, route verification, syntax checks, and lint checks pass.
