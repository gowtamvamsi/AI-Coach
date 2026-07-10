# Courses Tab UI Polish Design

## Scope

Refresh the admin Courses tab so it feels consistent with the rest of the site: warm neutral surfaces, rust accent, mono metadata, restrained motion, and clear curriculum hierarchy.

## Approach

Use the existing React structure and CSS tokens. Keep the current hero, overview, curriculum, and instructor sections, but improve the curriculum surface with stronger visual rhythm, better card depth, cleaner module metadata, and mobile-safe lesson rows.

## Components

- `CoursesTabView`: add a compact proof strip below the hero and keep page sections aligned with existing `V2SectionHeader`.
- `CoursesCurriculumModule`: keep collapsible modules, but present module number, title, and stats as a cleaner stacked header.
- `CoursesCurriculumSubmodule`: keep collapsible submodules, with subtle accent markers and lesson rows.

## UX Rules

- No new dependencies.
- No new color palette.
- No marketing-only sections.
- Preserve keyboard focus and native button semantics.
- Keep motion limited to hover/focus micro-interactions.

## Verification

Run the existing build and render checks, then visually inspect the Courses tab in desktop and mobile widths.
