# Sticky Advisor Widget Design

## Goal

Give visitors a persistent, low-friction way to contact the course team from
every public page. Replace the existing floating WhatsApp button with one
sticky **Talk to us** control that opens the existing course-advisor form.
WhatsApp remains available as the secondary action inside that form.

## Scope

The widget appears on all public pages:

- Course
- Full Roadmap
- About
- Agentic AI guide
- Glossary
- Privacy
- Terms
- Any other public static page using the shared site shell

It does not appear in account, dashboard, email-task, course-admin, or other
staff workspaces. It is hidden while a navigation drawer, legal dialog, advisor
dialog, booking dialog, or other modal is open.

## Interaction

- Clicking the sticky control opens the advisor form in place on the current
  page.
- The existing hero **Talk to an Advisor** CTA opens the same shared form.
- Submitting a valid form requests a callback.
- The existing WhatsApp action remains inside the form as an alternative.
- The existing success message remains:
  `Thanks—your request is in. A course advisor will call you within 24 hours.`
- Escape, backdrop click, and the close control dismiss the dialog.
- Focus moves into the dialog on open and returns to the invoking control on
  close.

## Visual Design

### Desktop

- Fixed at the bottom-right using the current floating-contact position.
- Rust-tinted pill with rust border, phone icon, and **Talk to us** label.
- Uses the existing course accent tokens rather than introducing a new color.
- Retains a visible focus state and restrained hover lift.

### Mobile

- Compact rust phone button positioned above the existing mobile enrollment
  bar and safe-area inset.
- Accessible name and title remain **Talk to us** even when the visible label
  is omitted.
- The control must not cover navigation, primary CTAs, or form controls.

### Removed UI

- Remove the standalone green floating WhatsApp button.
- Do not remove the WhatsApp button inside the advisor form.

## Shared Widget Architecture

Create one lightweight shared advisor widget loaded by the React application
and each hand-authored public HTML page.

The widget owns:

- Sticky-button rendering and responsive state.
- Advisor-dialog rendering.
- Field state and validation.
- Open, close, focus, and scroll-lock behavior.
- Submission status, error state, and success state.
- WhatsApp secondary action.

Expose a small global interface such as:

- `window.AdvisorWidget.open(trigger)`
- `window.AdvisorWidget.close()`

The course hero CTA calls this interface. Static pages use the same widget
directly, avoiding duplicated forms and divergent validation.

## Submission Endpoint

Add a same-origin `/api/course-enquiry` endpoint backed by a Cloud Function and
a Firebase Hosting rewrite. The shared widget posts JSON to this endpoint
instead of loading the complete Firebase SDK on every static page.

The endpoint:

- Accepts POST only.
- Enforces a conservative request-body limit.
- Accepts requests from the canonical site origin and explicitly configured
  local-development origins.
- Verifies a Google reCAPTCHA v3 token for the `course_enquiry` action and
  rejects scores below `0.5`.
- Allows at most five submissions per IP hash or normalized email per hour and
  rejects an identical email-and-phone submission for ten minutes.
- Validates and normalizes all fields.
- Requires name, valid email, and valid phone.
- Applies explicit field-length limits.
- Rejects unknown fields and malformed payloads.
- Writes one document to the existing `leads` collection.
- Returns a generic success response without exposing internal errors.
- Sets the timestamp server-side.
- Provides the boundary for developer notifications in subsequent work.
- Is deployed before direct anonymous `leads` creation is removed from
  Firestore rules, so the public form never has a broken transition.

The stored schema remains compatible with the current dashboard:

- `name`
- `email`
- `phone`
- `occupation`
- `message`
- `source: "course_enquiry"`
- `createdAt`

The existing generic 26-week-roadmap requester email is not changed as part of
this widget. Replacing that email and adding internal developer notifications
remain separate course-launch tasks.

## Visibility and Layering

- Use one shared body state while the advisor dialog is open.
- Place the sticky control below modal and navigation layers.
- Hide it when `body.modal-open` or `body.nav-menu-open` is active.
- Preserve mobile safe-area offsets.
- Do not render the widget inside signed-in account or staff views.
- Static legal pages still receive the widget because they are public pages;
  opening it must not navigate away from the current page.

## Error Handling

- Keep entered values after a recoverable network error.
- Prevent duplicate submissions while a request is in flight.
- Show a short retry message without exposing backend details.
- Preserve the WhatsApp fallback when submission fails.
- Do not show success until the endpoint confirms the Firestore write.

## Accessibility

- Sticky control is a real button, not a link.
- Dialog uses `role="dialog"`, `aria-modal="true"`, and a labelled heading.
- Keyboard focus is trapped within the open dialog.
- Escape closes the dialog.
- All fields have labels, invalid-state semantics, and associated error text.
- Motion respects `prefers-reduced-motion`.

## Verification

- The existing floating WhatsApp control is absent.
- The sticky advisor control appears on every public page and not in private
  account/admin workspaces.
- Hero and sticky controls open the same dialog.
- WhatsApp remains available inside the dialog.
- Desktop and mobile controls do not overlap navigation, dialogs, or the mobile
  enrollment bar.
- Valid submissions write the exact compatible schema once.
- Direct anonymous writes to `leads` are denied after the endpoint cutover.
- Missing/invalid challenge tokens and throttled submissions are rejected.
- Invalid and oversized payloads are rejected by the endpoint.
- The phone field remains mandatory.
- The success message is unchanged.
- Build, unit tests, endpoint tests, prerender verification, light/dark visual
  checks, and cache-bust checks pass.

## Out of Scope

- Selecting final internal-notification recipients or channels.
- Replacing or personalising the requester’s current roadmap welcome email.
- Replacing the temporary public phone number.
- Updating the WhatsApp Business URL or automated WhatsApp replies.
- Redesigning the admin enquiries dashboard.
- Fixing unrelated security-audit findings.
