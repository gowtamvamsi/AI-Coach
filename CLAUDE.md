# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**balajichippada.com** — a Firebase-backed static site (HTML + React) for an Agentic AI Engineer roadmap and live masterclasses. Two deep references already exist and are authoritative; read them before non-trivial work:
- `Balaji Chippada Website.md` — golden-standard patterns & decisions (architecture, Firebase, forms, pricing, gotchas).
- `DEPLOYMENT.md` — exact build + deploy procedure, including the REST-API deploy scripts.

> The `README.md` is outdated (it describes an old "React-via-CDN + Babel, no build step, GitHub Pages" setup). Ignore it; the project now uses esbuild + Firebase Hosting as described below.

## Commands

```bash
npm run build       # build:js (esbuild transform) + prerender — run before deploying
npm run build:js    # transpile app.jsx/v2.jsx -> app.build.js/v2.build.js only
npm run prerender   # regenerate roadmap.html (+ other crawlable routes) via headless Chrome
npm test            # offline unit tests (38 as of 2026-07-02); pretest re-runs the full build
npm run verify      # sanity-check the prerendered output

# Run one test file (skips the build that `npm test` forces):
node --test tests/otp.test.mjs
# Run one test by name:
node --test --test-name-pattern="canSend" tests/otp.test.mjs

# Serve locally
node scripts/serve.mjs        # or: python3 -m http.server 8000
```

Deploy is **not** `firebase deploy` — see "Deploying" below and `DEPLOYMENT.md`.

## Architecture: the no-bundler global-scope model

This is the single most important thing to understand. There is **no module system at runtime** — no imports/exports, no bundler output.

- `app.jsx` and `v2.jsx` are transpiled by **esbuild `transform`** (not `bundle`) into `app.build.js` / `v2.build.js`. Transform keeps top-level declarations as **globals** — every top-level `function`/`const` in `v2.jsx` becomes a `window` global that `app.jsx` reads directly.
- **Load order matters** (see the `<script>` tags in `index.html`): config files → React/Firebase CDN → `data.js` → `videos.js` → **`v2.build.js` before `app.build.js`**. `v2.jsx` defines shared globals (`V2_VALIDATE`, `V2PhoneField`, pricing/date helpers, `V2ClickToPlayVideo`) that `app.jsx` depends on at parse time.
- Because names are global, the build **never minifies identifiers**. Never introduce `import`/`export` in these files.
- `*.build.js` are **generated artifacts** — edit the `.jsx`, then run `npm run build:js`. Never hand-edit `*.build.js`.

### Content vs. code
Curriculum/config live in plain global-object JS files loaded as `window.*`, editable without touching React: `data.js` (roadmap phases/modules), `videos.js` (video↔module tags), `site.config.js` (stats, next masterclass, roadmap video id), `seo.config.js` / `seo-inject.js`, `firebase.config.js` (public web config — the `apiKey` is public by design).

### Prerender / SEO
`scripts/prerender.mjs` runs the React app in headless Chrome and writes **static, route-specific HTML + JSON-LD** so crawlers see real content. `index.html` is the template; `roadmap.html` is **generated** from it — never hand-edit `roadmap.html`; change `index.html` + `data.js` and rerun `npm run build`. `/masterclasses` and `/about` are hand-authored static pages, not prerendered.

### Backend (Firebase)
- **Firestore** via `onSnapshot` (live everywhere). Offline persistence is enabled in `app.jsx` so reloads render from cache instantly.
- **Roadmap video ✓ "Watched" markers are account-synced, not device-local.** `app.jsx` mirrors Firestore `roadmapProgress.videoProgress` to `window.__VIDEO_PROGRESS` and fires a `roadmap-progress-sync` event on every snapshot; `V2_VIDEO_RESUME.isWatched()` (v2.jsx) returns true on localStorage **or** that global, so the same signed-in account shows identical badges in every tab/device. Don't revert the markers to reading only localStorage.
- **Auth**: email/password + Google. Email/password sign-up and password reset go through a **6-digit OTP** verified server-side (`functions/lib/otp.js` is pure/unit-tested; the callables live in `functions/index.js`).
- **Cloud Functions** (gen1, nodejs20): payments (Razorpay), email/comms, OTP callables, Firestore triggers.
  - **Email provider: Resend** (switched from Hostinger SMTP; `sendEmailHelper` in `functions/index.js` prefers Resend whenever `RESEND_API_KEY` is set). Hostinger SMTP env vars are kept on every function as an instant rollback — remove the key to revert. Resend Pro (no daily cap) is required for any 1,000+ recipient send; the free tier caps at 100/day.
  - **Bulk email architecture**: `emailJobs` progress docs + `processEmailBatch` Cloud Tasks fan-out (`EMAIL_BATCH_SIZE = 100`, 3 concurrent workers). Each ad-hoc (no-`regId`) recipient carries an `idx` into the job's stored recipient list; delivered indices land in `deliveredIdx` on the job doc as sending progresses, flushed every 10 sends. This makes retries safe: a Cloud Tasks retry (or the admin **Retry** button on a finished task, wired to the `retryEmailJob` callable) re-sends only to recipients missing from `deliveredIdx`, never everyone in the batch again.
    - `processEmailBatch` serves **both** registration-backed sends and ad-hoc lists: a recipient **with** a `regId` gets the reg-doc read + `flagField` dedupe + flag-write (retry-safe); a recipient **without** a `regId` is sent directly (no reg doc). Don't reintroduce an unconditional `registrations.doc(r.regId)` read — it skips every ad-hoc recipient.
    - **Bulk Email from Spreadsheet** (dashboard Marketing tab): admin uploads a Name/Email/Phone `.xlsx`/`.csv`, parsed client-side by lazily-loaded SheetJS (`loadXlsxLib`, CDN, loaded only on first upload). Uploads **accumulate** across files (`bulkRows`/`bulkFiles`) and are **not** de-duplicated — every valid-email row is kept and emailed (same address twice ⇒ two sends), so the `sendBulkEmail` callable and the UI count agree. Only empty/malformed emails are dropped.
  - **Registration confirmation email**: `onRegistrationCompleted` builds a generic confirmation by default, but a masterclass doc can set `emailConfirmationBody` (full-body override, supports `{{name}} {{title}} {{date}} {{zoom}}`) plus `emailConfirmationSubject` to replace it entirely — used for the Claude Code Masterclass. Every confirmation attaches an `.ics` built from `buildMasterclassICS()`.
  - **Email body rendering**: `sendEmailHelper` sends both `text` and `html` — `emailBodyToHtml`/`emailBodyToText` convert a small markdown-lite subset (`**bold**`, `[label](url)`) before sending, since these are otherwise plain-text emails.

### SPA routing
History-API based; each account view has its own URL so reloads restore the tab: `/account` → My Account, `/dashboard` → staff Dashboard, `/email-tasks` → Email Tasks, `/courses` → admin Courses tab. The `ACCOUNT_TAB_PATHS` map in `app.jsx` drives init, tab-switch, and popstate. Hosting rewrites `**` → `/index.html` — a plain local static server (e.g. `npx http-server`, `scripts/serve.mjs`) does **not**, so reloading on a deep link like `/courses` 404s locally; navigate back to `/` first when testing with the preview tools.

### Admin-only tabs
Pattern used by both **Email Tasks** and **Courses**: a nav button gated on `userRole === 'admin'` (`app.jsx`, `mainNavTabs`), plus a matching `{activeMainTab === 'x' && userRole === 'admin' && (...)}` render guard. To add another one, copy this pair — don't invent a new permission check.

## Mandatory workflow after editing frontend

1. Edit the `.jsx` (or a config/content `.js`).
2. `npm run build`.
3. **Bump the `?v=` cache-bust query for every changed asset in BOTH `index.html` AND `roadmap.html`** (`app.build.js`, `v2.build.js`, `styles.css`, `data.js`, `site.config.js`, `videos.js`, …). The two files must agree on every version. Skipping this means users keep the cached old file.
4. `npm test`.
5. Deploy (below), then verify live with a cache-busting curl.

## Deploying

`firebase-tools` rejects the service-account credential in this environment, so deploys call the **Firebase REST APIs directly** via a short ephemeral script written into `functions/` (for `firebase-admin` resolution), authenticated with the service-account key at the path in `DEPLOYMENT.md`. Full copy-paste scripts are in `DEPLOYMENT.md`.

- **Hosting** uploads the **working tree as-is** — build + bump versions *before* deploying; the deploy does neither. Verify: `curl -s "https://balajichippada.com/?cb=$(date +%s%N)" | grep -oE "app\.build\.js\?v=[0-9]+"`.
- **Cloud Functions** deploy only when `functions/` changed. It requires **active billing** on the project (a deploy triggers Cloud Build) and the `lib/` dir must be in the source zip (the callables `require("./lib/otp")` at module top — omitting `lib/` crashes every function on load). A `403 "check billing account"` means billing is disabled, not a permissions problem.

## Gotchas that have bitten before

- **Falsy-zero:** `0` is a valid price (free masterclass). Never gate on `!price`; check `price === '' || price == null`.
- **Firestore `orderBy('createdAt')`** silently drops docs missing the field — sort client-side (`sortByCreatedAtDesc`) instead.
- **`*.build.js` can outlive/diverge from broken source.** A mid-refactor `app.jsx` that won't parse fails `npm run build` — compile-check first with esbuild `transform` (`jsx:'transform'`). `app.build.js` is one ~50k-token minified line the Read/Edit tools can't load; patch it with a `node` string-replace + `node --check`, but always fix the `.jsx` too or the next build reverts you. (Seen: an orphaned block left after `root.render()` and dangling `<div>`s from a gutted 2-col layout both broke the build.)
- **Never write test data to production Firestore docs** while debugging.
- **CDN edge lag is normal** — verify deploys with a cache-busting query, not a plain reload.
- Deploying does **not** commit or push; those are separate explicit steps.
- **`GCLOUD_PROJECT` caused a real outage (2026-07-06):** the Cloud Functions API *rejects* it as a "reserved" env var if you try to PATCH `environmentVariables`, but gen1 runtimes never actually inject it — so stripping it silently breaks every `firebase-functions` v1 **event-triggered** function (Firestore/pubsub triggers throw `process.env.GCLOUD_PROJECT is not set` in ~6ms; HTTPS callables are unaffected, which makes the outage easy to miss). Fixed permanently in `functions/index.js`: `GCLOUD_PROJECT` is derived from `FIREBASE_CONFIG` (which the API does allow) at module load, before `require("firebase-functions")`. **Never remove that fallback block**, and never blindly PATCH `environmentVariables` with a full env snapshot without this in place.
- **Cloud Functions env-var PATCHes can 400 on other reserved names too**, and can 400 with "an operation … is already in progress" if another PATCH on the same function is mid-flight — when scripting a bulk env update across many functions, retry on the "already in progress" case and strip any field the error names as reserved rather than failing the whole batch.
- **The deploy service account has no log/metrics access by default.** Reading Cloud Functions logs or execution-count metrics needs **Logs Viewer** + **Monitoring Viewer** granted to it in Cloud Console IAM — without it, debugging a silent function failure is much harder (had to resort to controlled create/wait/delete probes on Firestore docs to prove a trigger wasn't firing).
- **The Dashboard tab is five switched workspaces, not one long scroll.** `dashSection` state in `DashboardView` (`overview` | `classes` | `videos` | `audience` | `enquiries`) gates each group behind `{dashSection === "x" && ...}`, and `<DashboardTabs>` renders the rail — each tab carries a live count (`<DashCount collection=... />`, its own Firestore listener so the count never re-renders `DashboardView`). Only one workspace is mounted at a time, so **JSX order between groups is irrelevant but order within a group is what renders**. All business KPIs live in the Overview `.dash-statrail` — don't re-add stat tiles inside Marketing or Registrations, that duplication is what made the old dashboard feel scattered.
- **`DashboardView` in `app.jsx` is one ~5,000-line component with 100+ `useState` hooks.** Any input whose state lives at that level re-renders the *entire* dashboard on every keystroke (visible as typing lag, worse with large lists mounted, e.g. a 1,000-row recipients table). Fix pattern: extract the form into its own component that owns the field state locally (parent only gets the final value on submit), and `useMemo` any heavy list/table keyed on its actual data dependencies. Don't add more state to `DashboardView` itself if a child component will do.
- **`.reveal` (scroll-in-view fade) only animates on the roadmap tab.** Its `IntersectionObserver` is wired in a `useEffect` gated on `activeMainTab !== 'roadmap' → return` (`app.jsx`). Using the `.reveal` class on any other tab's markup leaves those elements permanently at `opacity: 0` — they never get observed, so `.in-view` never gets added. Don't reuse `.reveal` outside the roadmap tab.
- **`.v2-hero`'s full-bleed trick breaks if you add a margin override.** It escapes its (centered, max-width) parent via `width: 100vw; margin-left: calc(50% - 50vw)` — this only works when nothing else touches `margin`/`margin-left` on it or a wrapping selector. Adding e.g. `.some-page .v2-hero { margin: 0 -5vw ... }` clobbers the `calc()` offset and misaligns the whole hero (title/video overlap). If you need a hero full-bleed inside a padded container, put the hero *outside* that container instead of fighting the existing rule.
- **Design consistency check before styling anything new**: this site colors section/card **titles neutrally** (`var(--fg)`) and puts color only on a small accent (a dot, left-border, or icon), cycling through `PHASE_COLORS` on the roadmap or a single `var(--c-rust)` elsewhere (CTAs, prices, hover borders) — see `.phase__title`/`.phase__title-accent[data-color=...]` for the canonical pattern. Don't invent a new accent color (e.g. indigo/blue) or tint whole title text; grep for how existing sections (`.v2-section-header`, `.phase__title`, `.capstone__title`) handle color before adding a new component.
- **QA-testing anything gated on `userRole === 'admin'` locally**: there's no quick way to sign in as a real admin in the preview. Temporarily change the `useState(null)` default to `useState('admin')` for `userRole` *and* comment out the `setUserRole(null)` inside the signed-out branch of the `onAuthStateChanged` handler (both in `app.jsx`), rebuild, verify in the preview browser, then **revert both edits and rebuild again** before considering the work done — grep for `TEMP QA` to confirm nothing was left in.
