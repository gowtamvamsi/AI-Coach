# Contact Bar, Audience Stats, and Projects 08–09 Design

## Goal

Keep audience metrics current, extend the project gallery to nine projects, and
provide a permanent support contact path above the main navigation.

## Audience Metrics

- YouTube subscribers: `35K+`
- Roadmap views: `230K+`
- Update all public UI, static metadata, structured SEO configuration, guide
  references, and internal public-facing course reference text so the site does
  not present conflicting figures.

## Projects

- Add Project 08 using `project8_light_mode.png` and
  `project8_dark_mode.png`.
- Title it `Memory-Powered Personalized Chatbot`.
- Describe short-term, summary, long-term, profile, and episodic memory with
  memory routing and personalization.
- Add Project 09 using `project9_light_mode.png` and
  `project9_dark_mode.png`.
- Title it `LangGraph Multi-Agent System`.
- Describe planner, researcher, coder, and reviewer agents collaborating
  through A2A and M2M protocols with shared tools and memory.
- Preserve the six-card collapsed gallery. Its expansion label updates
  automatically to `View all 9 projects`.

## Contact Utility Bar

- Add one permanent fixed strip above the main navigation on every SPA view.
- Desktop content: `Have a question?`, phone icon and `+91 XXXXXXXXXX`, then
  mail icon and `team@balajichippada.com`.
- The temporary phone value is text, not a `tel:` link.
- The email is a `mailto:` link.
- Use a deep neutral background, white text, rust hover/focus accents, and
  inline SVG icons.
- Use a compact mobile layout that hides the introductory phrase but retains
  both contact values without horizontal overflow.
- Replace the existing top enrollment banner render so only one fixed strip
  occupies the space above navigation.
- Reserve the bar height through the existing `--top-banner-h` and
  `--layout-top` layout variables so navigation and page content remain aligned.

## Verification

- Test updated metrics and absence of stale `26K+`/`170K+` public references.
- Test projects 08–09 artwork, copy, and nine-project expansion behavior.
- Test contact semantics, email target, non-linked temporary phone, responsive
  sizing, and removal of the enrollment banner render.
- Build, run all tests and route verification, lint edited files, and visually
  check desktop/mobile in light and dark themes.
