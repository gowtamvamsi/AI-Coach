# Website Feedback → Actionable Requirements

Source: _Website Feedback (Responses).xlsx_ — 15 student responses.
Avg overall rating **9.3/10**, avg ease-of-use **4.7/5**. Sentiment strongly positive
on UI/UX, navigation, and roadmap↔video integration. Actionable signal is concentrated
in a few bugs, missing video content, and mobile polish.

> ⚠️ Response 6 (Vijaya Rama Raju) attached a [Google Doc](https://docs.google.com/document/d/1lHg_RYofCDz5fQoB1GfFRyB7kdMQTi8ZOqdIP-mf5j0/edit)
> with additional usability notes — review separately; may extend this list.

## P0 — Broken functionality

| ID | Requirement | Acceptance criteria | Evidence | Status |
|----|-------------|---------------------|----------|--------|
| FB-01 | Fix the **Roadmap PDF download** — pointed to a GitHub raw URL that 404s; no PDF exists in the repo. | "Download Roadmap" (hero + lead modal) routes to a valid destination. | R2, R6 | ✅ done — repointed CTA to on-site `/roadmap`, lead capture preserved, copy de-PDF'd. Swap to a real PDF later if one is produced. |
| FB-02 | Fix the **WhatsApp community link** — group hit its member cap, invite is dead. | Link joins a working group (or a rotating/landing link). | R2 | ⏳ needs fresh invite link |
| FB-03 | **Video progress not persisting** — reopening a section restarts from the first video instead of resuming. | Last-watched position/module saved per user and restored. | R15 | open |
| FB-04 | **Playlist active-index out of sync** — on auto-advance the playlist highlight/number stays on the previous item. | Playlist highlights currently-playing video and advances with autoplay. | R14 | open |

## P1 — Content gaps + registration trust

| ID | Requirement | Acceptance criteria | Evidence | Status |
|----|-------------|---------------------|----------|--------|
| FB-05 | **Attach missing videos** to subtopics — explicitly 1.4 and 1.5; "almost all topics" per one user. | Audit every subtopic; each has a video or explicit "coming soon". | R1, R7, R9 | open (content) |
| FB-06 | Send an **automated confirmation email** after registration / seat reservation. | Confirmation email on signup and on seat reservation (Zoom/calendar for seats). | R8, R10 | open (backend) |
| FB-07 | Make the **module progress ring** work (reported not updating). | Ring reflects real completion %; advances as modules complete. | R2 | open (likely same root as FB-03) |
| FB-08 | Finish the **Return/Refund Policy** page (currently incomplete). | Final reviewed copy; no placeholder text. | R4 | open |

## P2 — Mobile & UX polish

| ID | Requirement | Acceptance criteria | Evidence | Status |
|----|-------------|---------------------|----------|--------|
| FB-09 | Fix **scroll jank / "stuck" scrolling**, especially Roadmap page on mobile. | Smooth scroll on mobile; no frozen states. | R7, R9, R10 | ✅ done — see "Mobile load + scroll fixes" below |
| FB-10 | On **mobile**, make the **Agentic AI Roadmap the hero/highlight** — masterclasses currently dominate the top. | Roadmap is primary above-the-fold on mobile. | R1 | open |
| FB-11 | Fix the **Module 1 / 1.1 "Core Python" playlist layout** on mobile. | Playlist renders cleanly at mobile widths. | R10 | open |
| FB-12 | Style the **WhatsApp link as a button**, not a raw URL (Contact modal). | WhatsApp CTA is a styled, clickable link/button. | R4 | ✅ done |

## P3 — Enhancements (backlog)

| ID | Requirement | Evidence |
|----|-------------|----------|
| FB-13 | Add a **chatbot** for basic query clarification. | R7 |

## Mobile load + scroll fixes (this pass)

Root causes found for "not loading correctly / not good on mobile":

1. **Uncaught `module is not defined` on every page load.** The Lenis smooth-scroll
   script referenced a CommonJS build (`@studio-freight/lenis@1.0.28/dist/lenis.min.js`)
   that throws when loaded via a plain `<script>` tag. It also meant `window.Lenis` was
   never defined, so smooth scroll never actually ran. **Fix:** removed the broken
   `<script>` from `index.html` (propagates to `roadmap.html` via prerender) and deleted
   the dead Lenis `useEffect` in `app.jsx`. Both routes now load with **zero console
   errors** on mobile.
2. **Janky / "stuck" touch scrolling.** Two always-visible *fixed* elements —
   the floating nav pill (`backdrop-filter: blur(14px)`) and the bottom sticky reserve
   bar (`blur(18px) saturate(1.3)`) — re-blurred the page behind them on every scroll
   frame, which is a well-known mobile scroll-perf killer. **Fix:** on `≤768px` both now
   use near-opaque backgrounds with **no backdrop-filter** (equally legible, far cheaper).

Still open: FB-10 (roadmap-first ordering on mobile) and FB-11 (Module 1.1 playlist
layout polish) — separate layout work, not bundled here.

## Already addressed by recent work

- R8 ("seat confirmation not visible") — closed in recent sessions: reserved state now
  shows in the navbar ("Seat booked ✓"), hero ("Upcoming session for you"), and My Account.
  Confirm it satisfies this once deployed. The **email** half is still FB-06.
