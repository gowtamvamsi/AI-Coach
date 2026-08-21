# Course Certificate Showcase Design

## Goal

Show prospective learners that the course includes a completion certificate
whose eligibility depends on demonstrated participation and approved work, not
enrolment alone.

## Placement

Place the section immediately after Projects and before Highlights. This ties
the credential to the practical work learners build before the page moves into
the broader course benefits.

## Content

- Eyebrow: `COURSE CREDENTIAL`
- Heading: `Earn a certificate that means something.`
- Explain that this is not a participation certificate.
- Eligibility requires all three conditions:
  1. Complete the full course.
  2. Have every assignment reviewed and approved.
  3. Complete all mock interviews.
- Explain that the standard protects the certificate's authenticity and makes
  it evidence of demonstrated, practical skills.
- Do not advertise public certificate verification until a verification system
  exists.

## Layout and Interaction

- Use a responsive split layout: eligibility copy on the left and the supplied
  landscape certificate on the right.
- Preserve the certificate's full aspect ratio without cropping.
- Keep the certificate white in both themes, framed by a subtle border and
  shadow.
- Label the image as a sample certificate.
- Make the preview a real button. Activating it opens a full-size modal.
- The modal closes via its close button, Escape, or backdrop click; opening it
  moves focus to the close button and closing it restores focus.
- On mobile, stack the copy above the certificate and keep all controls at
  least 44px tall.

## Asset

Use `logos/FLA Course Completion Certificate.svg` with lazy loading and
asynchronous decoding.

## Verification

- Regression tests cover section placement, exact eligibility language,
  certificate asset usage, semantic image alternative text, and accessible
  modal behavior.
- Visually verify at desktop and mobile widths in both light and dark themes.
- Run the full build, test, prerender verification, and lint checks.
