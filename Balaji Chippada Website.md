# Balaji Chippada Website — Golden Standard Patterns & Decisions

A reference for how this site is built and the decisions behind it. Read this
before changing anything; most "why is it like this?" answers are here.

Site: **balajichippada.com** · Free agentic-AI roadmap + live masterclasses.
Stack: static HTML + React (via JSX, no bundler runtime) + Firebase (Firestore,
Cloud Functions, Hosting).

---

## 1. Architecture at a glance

- **No SPA framework / no bundler at runtime.** Scripts are plain `<script>`
  tags that attach to `window`. React components are global functions shared
  across files. esbuild only **transforms** JSX → JS (it does **not** bundle).
- **Load order matters.** `v2.build.js` loads **before** `app.build.js`. Top-level
  functions/components in `v2.jsx` are therefore available as globals inside
  `app.jsx` (e.g. `<V2PhoneField>`, `<V2ClickToPlayVideo>`, `window.V2_VALIDATE`).
- **Single source of truth for content:** [`site.config.js`](site.config.js) →
  `window.SITE_CONFIG`. Edit this to change brand, stats, the live masterclass,
  FAQs, feature flags — no code change needed.
- **Curriculum data:** [`data.js`](data.js) (`window.PHASES`) — phases → `sections[]`
  (`{ n, title, items[] }`). **Video tags:** [`videos.js`](videos.js) seed
  (`window.ROADMAP_VIDEOS`) merged with the Firestore `roadmapVideos` collection.
- **SEO:** [`seo.config.js`](seo.config.js) + [`seo-inject.js`](seo-inject.js)
  (per-route meta, JSON-LD). `llms.txt` is served for agent crawlers.

### Source → build artifact map
| Edit this | Produces / drives | Cache-bust token |
|---|---|---|
| `v2.jsx` | `v2.build.js` | `?v=` in index.html + roadmap.html |
| `app.jsx` | `app.build.js` | `?v=` |
| `data.js`, `videos.js`, `site.config.js`, `seo.config.js`, `seo-inject.js` | served as-is | each has its own `?v=` |
| `styles.css` | served as-is | `?v=` |

---

## 2. Build & deploy workflow (GOLDEN — follow exactly)

```bash
npm run build      # = build:js (esbuild transform) + prerender (regenerates roadmap.html, index.html)
npm run verify     # asserts all prerendered routes render
```

1. **Edit `.jsx`** → run `npm run build` (transforms JSX **and** re-runs the prerender).
2. **Bump the `?v=` cache-bust** for every changed asset in **BOTH** `index.html`
   **and** `roadmap.html`. This is mandatory — without it, browsers/CDN serve the
   stale file after deploy. (Current versions live in `index.html`.)
3. **Prerender pipeline:** `index.html` is the **template**; `roadmap.html` is
   **generated** from it. Static pages (`about.html`, `guides/*`, `glossary`) are
   **NOT** regenerated — edit those directly (and run the same content change
   across them, e.g. a stat update).
4. **CSS / `data.js` / `videos.js` / `site.config.js` changes** don't need a JS
   rebuild (served directly), but **do** need their `?v=` bumped + a redeploy.

### Deploying (the non-obvious part)
`firebase-tools` **will not accept the service-account credential** for hosting
deploys (it wants an interactive login, which is unavailable here). We deploy via
the **Firebase Hosting REST API** using the service account instead:

- Mint an access token from the service account (`admin.credential.cert(sa).getAccessToken()`).
- **Clone the config from the currently-live version** (`GET .../releases?pageSize=1`
  → version → `.config`) and reuse it verbatim — never hand-translate
  `firebase.json` rewrites/headers (one mistake breaks SPA routing).
- `POST versions` → `:populateFiles` (gzip + sha256 each file) → upload required
  hashes → `PATCH status=FINALIZED` → `POST releases`.
- File selection mirrors `firebase.json` `hosting.ignore`, **plus** exclude
  `functions/**` and any service-account JSON (never web-serve backend/secrets).
- **CDN edge lag is normal:** right after release, a plain `curl` may show the old
  version for a few seconds. Verify with a cache-busting query +
  `Cache-Control: no-cache`.

> The deploy script is recreated ad-hoc as `functions/_deploy_hosting.js`, run, then
> deleted. It is **not** committed.

### Deploy scope
- **Hosting only** is the default. Cloud **Functions** and **Firestore rules** are
  deployed separately and deliberately (they have independent, sometimes
  in-progress changes). Don't bundle them into a hosting deploy.

---

## 3. Firebase / Firestore patterns

### NEVER `orderBy` on an optional field in a live query
`db.collection('masterclasses').orderBy('createdAt')` **silently drops** any doc
missing `createdAt` from the result — it doesn't error, the doc just vanishes.
This hid a hand-seeded masterclass from the dashboard **and** the home page (they
fell back to `site.config` values), even though edits were saving fine.

**Rule:** fetch unordered with `onSnapshot`, **sort on the client**
(`sortByCreatedAtDesc` in `app.jsx` — treats a missing `createdAt` as oldest so it's
never excluded). Backfill `createdAt` on any legacy doc.

### Live data, always
Masterclasses/sessions load via `onSnapshot` (not one-time `get`) in both the
dashboard and the public app, so dashboard edits reflect immediately.

### Config ↔ Firestore drift is a real bug class
The home page prerenders/first-renders from `site.config.js`, then Firestore's
`onSnapshot` swaps in live values. If the two disagree (e.g. masterclass date),
users see the **old value flash** for a frame before React reconciles.

**Rule:** keep `site.config.js.nextMasterclass` (date, price, videoUrl) **in sync**
with the live Firestore masterclass doc. `mergeMcWithConfig()` (v2.jsx) is the
single merge point — Firestore values win when present, config is the fallback.

### Deterministic registration doc ids
Free registrations write to `registrations/{sessionId__email}` with `set(merge:true)`.
- **First** registration → a `create` (allowed by rules).
- **Re-submit** → an `update`, and rules only allow staff to update registrations
  → throws `permission-denied`. We treat that specific error as **"already
  registered"** and show the success screen (not a scary error). Transient/network
  errors still say "try again" (we only special-case permission errors).

### Security rules: bootstrap admins
Admin-gated writes (masterclasses, sessions, video links) require either
`isStaff()` (Firestore `users/{uid}.role ∈ {admin,teacher,support}`) **or** an
email in the hardcoded `BOOTSTRAP_ADMIN_EMAILS` (token-email check, bypasses the
users-doc dependency). `create` on masterclasses is bootstrap-email only;
`update` also allows `isStaff()`. Keep the bootstrap list in `functions/index.js`
and `firestore.rules` identical.

### Verifying rules / repro client behavior without a login
The service account can read deployed rules (Firebase Rules REST API) and can
**reproduce a client write through the rules** by minting a custom token for a
user uid → exchanging it for an ID token → doing the Firestore REST write. Use
this to diagnose "saves but doesn't stick" without guessing. **Never write test
data to a production doc** — if you must, snapshot/restore the exact fields.

### Falsy-zero guards
A **free** masterclass has `price: 0`. `if (!price)` treats `0` as missing and
blocked saves. **Rule:** check `price === '' || price == null`, never `!price`,
anywhere price/amount can legitimately be `0`.

---

## 4. Forms & validation (`window.V2_VALIDATE`, shared everywhere)

One shared validator object in `v2.jsx`, used by every public form (booking,
profile, sign-up) so client checks match Firestore rules.

### Phone — country-code dropdown + E.164
- **`V2PhoneField`** (v2.jsx) is the single phone component: a country-code
  `<select>` + a number input. Used in all four phone fields.
- Stores the full **E.164** string (`+<dial><number>`) in the parent's phone state.
  `v2SplitE164()` parses a stored value back into `{dial, local}` via **longest
  dial-code prefix match**; bare/legacy digits are treated as Indian (`+91`).
- **Defaults to India (+91)** so a country code is always selected.
- **Per-country number length:** default **10** digits (covers India/US/UK and most),
  with a `max` override on the dial-code entry where it differs (e.g. **China = 11**).
  Don't hard-cap everyone at 10 — it truncates valid Chinese mobiles.
- **Native `<select>` overlay trick:** the select's text is `color: transparent`
  and a short `flag + dial` overlay is painted for the closed state, so long
  country names ("United Arab Emirates") never clip — while the open list still
  shows full names. Native arrow is removed (`appearance: none`) in favor of a
  custom `▾` caret for a consistent, visible affordance.

### Email — two layers
1. **Synchronous** (`emailError`): format + disposable-domain blocklist +
   placeholder/test domains (`testing.com`, `example.com`) + common typo
   detection (`gmail.con` → "did you mean gmail.com?"). Catches the junk-email
   complaints.
2. **Async deliverability** via DNS-over-HTTPS MX/A lookup — **fail-open** (never
   blocks a real user on a transient DNS error). ⚠️ **Security-filter caveat:**
   client-side DoH (`dns.google`) is a signal that ISP security boxes (e.g. SAM
   Seamless Network / Virgin Media) may flag as "evasive." If reputation blocks
   recur, prefer a **server-side** MX check or drop the DoH layer.

### Phone is mandatory for masterclass registration.

---

## 5. Pricing model

- Two fields on a masterclass: **`price`** (offering price, what they pay; `0` = Free)
  and **`originalPrice`** (the struck-through "actual" anchor).
- `V2McPrice` shows `~~₹actual~~ offered` (or "Free" when offered is 0), and
  **only strikes when `actual > offered`** — so a blank/misconfigured anchor never
  renders a nonsensical strikethrough. Free class with no anchor falls back to a
  default ₹299 strike.
- Dashboard exposes both as **"Actual Price"** and **"Offering Price (0 = Free)"**.

---

## 6. Time & timezone

- **Store an absolute instant** (ISO string with offset; Firestore keeps UTC).
  Never store wall-clock without a zone.
- **Display in the viewer's local timezone:** formatters use
  `toLocaleString(undefined, { …, timeZoneName: 'short' })` — no forced
  `Asia/Kolkata`, no literal " IST". Same instant reads "7:00 PM GMT+5:30" in
  India, "9:30 AM EDT" in New York. Countdown is a `Date` diff (zone-agnostic).
- **`.ics` calendar files** keep an explicit `TZID=Asia/Kolkata`; calendar apps
  convert to the user's zone on import (correct by design — leave it).
- **Emails** are server-side and can't know each recipient's zone → they state IST;
  the `.ics` attachment handles per-user conversion.

---

## 7. Video components

- **`V2TrackableVideo`** (`inline`) = embedded YouTube **iframe**, plays on-page,
  tracks watch progress. Comes with YouTube's player chrome (title bar, "Watch on
  YouTube") which **cannot be removed via CSS**.
- **`V2RedirectVideo`** (default) = clean custom poster + play button; opens YouTube
  in a new tab on click. No YouTube chrome.
- The home hero and Full Roadmap top video both use the **clean poster**
  (`V2RedirectVideo`) for a consistent, chrome-free look — and it aligns with the
  "watch on YouTube" / ad-revenue goal.
- **Posters use `maxresdefault.jpg`** (16:9). Earlier `sddefault`/`hqdefault` are
  **4:3** and got top/bottom-cropped by `background-size: cover` in the 16:9 frame.
  All channel videos have custom HD thumbnails, so `maxresdefault` is reliable
  (verified HTTP 200 before relying on it).
- **Home hero vs Full Roadmap top video are independent** — home reads
  `V2_BRAND.roadmapVideoId`; the Full Roadmap walkthrough is set explicitly.
- **All videos are sign-in gated** (`V2VideoGate`) — logged-out visitors see a
  "sign in to watch" panel, so signed-in-only UI can't be screenshotted headlessly.

---

## 8. Email & comms system (Cloud Functions)

- **Fan-out at scale (50k+):** a dispatcher enqueues batches into a Cloud Tasks
  **task queue** (`processEmailBatch` worker, `EMAIL_BATCH_SIZE = 100`) instead of
  sending sequentially. Sequential SMTP + the default 60s function timeout caused
  the original "Internal" failure on ~132 emails.
- Bulk senders use `runWith({ timeoutSeconds: 540, memory: '512MB' })` and a
  **pooled** SMTP transporter (`pool:true, maxConnections:5`).
- **Per-masterclass lifecycle:** confirmation email (with `.ics` attachment) on
  register; Zoom link broadcast when an admin adds it (admin can edit the email
  body first); daily reminders the 2 days before; cancellation email on
  delete/cancel (also marks registrations `cancelled` so reminders stop).
- Sender identity: **"Balaji Chippada Masterclass"** (not "The Agent Engineer").

---

## 9. CSS / UI patterns

- **Theme tokens** (CSS vars): `--fg`, `--fg-dim`, `--fg-faint`, `--c-rust`,
  `--bg-card`, `--bg-elev`, `--line`, `--nav-h`. Light + dark themes — never
  hardcode colors that need to flip.
- **Contrast / WCAG 4.5:1.** White on `#e0664c` is 3.4:1 (fails); use `#a23d22`
  (≈6.5:1). Don't dim text with low `opacity` — it tanks contrast; use a theme
  token or `currentColor`.
- **Inherit the parent's color with `currentColor`** for elements inside
  inverted/colored surfaces (e.g. the struck price inside the theme-inverting nav
  pill and the colored promo banner). A page-foreground token there collides with
  the surface background and becomes invisible.
- **Inline feedback near the action.** The dashboard status banner originally
  rendered at the top of a long form — a successful save looked like "nothing
  happened." Render success/error **next to the button** the user clicked, and
  `console.error` the raw error for diagnosis.
- **Native-select overlay** (see Phone, §4) when you need a compact closed display
  but full option labels.

---

## 10. Operational / data-hygiene

- **Service-account scripts** (run from `functions/`, `KEY=<path> node script.js`)
  are the tool for admin/data ops: pre-launch cleanup (delete non-admin users +
  registrations, preserving bootstrap admins, **dry-run first**), reading deployed
  rules, reproducing client writes, backfilling fields, REST deploys.
- **Always dry-run destructive ops** (count + list what would change) and
  **preserve admins** (by `role` and by bootstrap email) before executing.
- **Never commit** the service-account JSON. It's gitignored
  (`serviceAccountKey.json`, `*-firebase-adminsdk-*.json`).

---

## 11. Verification discipline

- Admin/sign-in-gated UI can't be screenshotted headlessly. Verify via:
  build + `npm run verify`, bundle/logic inspection, **numeric checks** (e.g. WCAG
  contrast ratios, E.164 parsing across cases), and the **chrome-devtools MCP**
  against the live site for anything reachable without login (the booking modal is
  open to everyone — good for verifying the phone field, posters, etc.).
- After a deploy, confirm the live `?v=` matches local with a cache-busted fetch.
- For "it doesn't work" reports: get the **exact symptom/error first** (or
  reproduce through the real rules) before guessing — two of this project's bugs
  ("save reverts", "date flash") were misdiagnosed until reproduced.

---

## 12. Quick "don't break these" checklist

- [ ] Bumped `?v=` for every changed asset in **both** index.html and roadmap.html.
- [ ] No `orderBy` on an optional field in a live query.
- [ ] No `!price` / `!amount` guards where `0` is valid.
- [ ] `site.config.js` masterclass date/price in sync with Firestore.
- [ ] Bootstrap admin list identical in `functions/index.js` and `firestore.rules`.
- [ ] Phone stored as E.164; per-country length respected.
- [ ] Colors use theme tokens / `currentColor`; contrast ≥ 4.5:1.
- [ ] Destructive data ops dry-run first and preserve admins.
- [ ] Service-account key never committed; deploy excludes `functions/**`.
