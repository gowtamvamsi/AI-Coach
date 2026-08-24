# Shared Instructor Card Redesign

## Goal

Restyle the shared “Your instructor” section as a unified editorial card that
matches the visual language of the course-certificate card.

## Scope

Apply the design to every `CoursesInstructorSection` instance: Course, Home,
and Full Roadmap. Keep all existing biography copy, quote, statistics, and
social links unchanged.

## Layout

- Use one rounded, bordered, softly tinted outer card.
- Keep the portrait on the left and all content on the right at desktop widths.
- Frame the portrait as an inset image with a subtle border and shadow.
- Preserve the existing portrait crop and aspect ratio.
- Present the statistics as compact, low-contrast chips so they do not compete
  with the outer card.
- Stack portrait first and content second below the existing tablet breakpoint.
- Center the portrait in the stacked layout and prevent horizontal overflow at
  mobile widths.

## Visual System

- Reuse the certificate card's `28px` radius, semantic border, elevated surface,
  and restrained rust-tinted radial accent.
- Use existing `--cv3-*` tokens so both themes remain consistent.
- Do not add hover behavior to the non-interactive outer card.

## Verification

- Add source-level regression coverage for the shared card surface, desktop
  image-left/content-right grid, lightweight stat chips, and stacked layout.
- Run the full build, tests, prerender verification, and lints.
- Visually verify Course, Home, and Full Roadmap in light and dark themes,
  including a mobile viewport.
