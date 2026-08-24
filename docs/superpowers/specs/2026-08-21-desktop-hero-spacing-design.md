# Desktop Hero Spacing Design

## Goal

Move the course hero content upward on desktop and laptop screens so the initial
viewport matches the supplied reference: less empty space below navigation and
the trust-logo strip visible sooner.

## Scope

- Apply only above the existing desktop breakpoint (`min-width: 1041px`).
- Remove the hero's current `64px` top padding at that breakpoint.
- Reduce the course page's desktop top offset from
  `calc(var(--layout-top) + 16px)` to `calc(var(--layout-top) - 48px)`,
  moving the complete hero another `64px` upward.
- Preserve the hero's horizontal and bottom padding.
- Preserve headline, CTA, statistics, portrait, and artwork dimensions.
- Preserve all tablet and mobile spacing rules.
- Do not crop, scale, translate, or otherwise alter the supplied hero artwork.

## Implementation

Add desktop-only CSS overrides that set `.cv3` to
`padding-top: calc(var(--layout-top) - 48px)` and `.cv3-hero` to
`padding-top: 0`. This uses normal document flow rather than transforms or
negative margins, so the hero and following trust section remain stable and
responsive.

## Verification

- Add a regression assertion for the desktop-only override.
- Confirm the existing mobile hero padding remains unchanged.
- Run the full build, tests, and prerender verification.
- Visually compare the desktop page in light and dark themes.
