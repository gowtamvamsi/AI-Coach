# Course Highlights Expansion

## Goal

Expand the course highlights section from eight to twelve cards so prospective
learners can clearly see the course's learning support, career preparation, and
module-level practice benefits.

## Content

The section keeps its existing heading and introductory copy. It presents these
twelve highlights in this order:

1. **Full Course Access** — Access every module from foundations through production.
2. **Live Sessions & Office Hours** — Join regular live sessions for guidance and deeper learning.
3. **Production Projects & Code** — Build hands-on projects with production-ready code.
4. **Reviewed Assignments** — Submit practical assignments for review and approval.
5. **Completion Certificate** — Earn a shareable certificate after meeting all completion requirements.
6. **Two Years of Access** — Learn at your own pace with two years of course access.
7. **Community & Network** — Connect with fellow learners and AI builders.
8. **Templates & Resources** — Use practical templates, cheat sheets, and exclusive resources.
9. **Two 1-to-1 Mock Interviews** — Complete two personal mock interviews with actionable feedback.
10. **Resume Preparation** — Get guidance to present your skills and projects effectively.
11. **Doubt Resolution Within 24 Working Hours** — Receive answers to course doubts within 24 working hours.
12. **Practice in Every Module** — Reinforce each module with quizzes, interview questions, and assignments.

## Presentation

- Reuse the existing course-highlight card component and neutral card styling.
- Give each new or revised card a relevant line icon using the existing visual language.
- Keep the current four-column desktop grid, producing three balanced rows.
- Keep two columns on tablet and one column on mobile.
- Preserve the current hover, reveal-animation, light-mode, and dark-mode behavior.
- Do not add accordions, expansion controls, or additional section navigation.

## Scope

- Update the highlight data and icons in `app.jsx`.
- Add or update tests that assert all twelve approved highlights and the responsive grid contract.
- Rebuild generated JavaScript and prerendered HTML.
- Bump the changed frontend asset versions in both React-shell HTML files.
- Do not change pricing, curriculum data, certificate eligibility, or backend behavior.

## Acceptance Criteria

- Exactly twelve highlight cards render.
- All approved benefits and timing/count promises appear exactly once.
- Desktop displays four columns, tablet two, and mobile one.
- The section remains visually consistent in both themes.
- The build, automated tests, and prerender verification pass.
