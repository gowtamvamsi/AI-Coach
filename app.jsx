const { useState, useEffect, useRef } = React;

// Framer Motion — loaded via CDN. Try both known UMD global names.
const {
  motion, AnimatePresence,
  useAnimation, useMotionValue, useTransform,
  useScroll, useMotionValueEvent,
  animate: motionAnimate,
  useReducedMotion,
} = window.Motion || window.FramerMotion || {};

// ── Global error reporter (production-safe) ───────────────────────
window.onerror = function(msg, src, line, col, err) {
  if (!msg || msg === 'undefined' || msg === 'Script error.') return false;
  console.error('Runtime Error:', msg, src, line, col, err && err.stack);
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled Promise Rejection:', e.reason);
});



// ===============================================================
// Firebase Web Compat Configuration & Initialization
// Config lives in firebase.config.js → window.FIREBASE_CONFIG
// ===============================================================
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: 'AIzaSyAXE0--FXvV31_SWJ4RCxQIV3cAEg99sBI',
  authDomain: 'balajichippada.com',
  projectId: 'balaji-chippada-agentic-ai',
  storageBucket: 'balaji-chippada-agentic-ai.firebasestorage.app',
  messagingSenderId: '290086119185',
  appId: '1:290086119185:web:34c21c5beae8bada71ceb0',
  measurementId: 'G-JQVMXXW096',
};
const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Global Firebase services variables
let auth = null;
let db = null;
let functions = null;

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();
  db = firebase.firestore();
  // Offline cache: on reload, onSnapshot serves locally-cached data instantly
  // (then syncs), so the dashboard shows real numbers immediately instead of
  // flashing zeros while the network round-trip completes. Must run before any
  // Firestore read. Rejections (multi-tab/unsupported browser) are non-fatal.
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (e) { /* persistence unavailable — falls back to network-only */ }
  functions = firebase.functions();
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalHost && firebaseConfig.measurementId && typeof firebase.analytics === 'function') {
    firebase.analytics();
  }
}

// Each signed-in/account view gets its own URL so a reload restores the tab the
// user was on (instead of every account view collapsing to /account).
const ACCOUNT_TAB_PATHS = { mybookings: '/account', dashboard: '/dashboard', emailtasks: '/email-tasks' };
function accountTabForPath(pathname) {
  const p = String(pathname || '/').replace(/\/+$/, '') || '/';
  for (const tab in ACCOUNT_TAB_PATHS) {
    if (ACCOUNT_TAB_PATHS[tab] === p) return tab;
  }
  return null;
}

function loadRazorpaySdk() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout SDK.'));
    document.head.appendChild(script);
  });
}

// Lazily load SheetJS (xlsx) only when an admin actually uploads a spreadsheet —
// keeps the ~900KB parser off the critical path for everyone else. Parses both
// .xlsx/.xls and .csv. Resolves with the global `XLSX`.
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const done = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX failed to initialize.')));
    const existing = document.querySelector('script[data-xlsx-lib]');
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Failed to load the spreadsheet parser.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.dataset.xlsxLib = 'true';
    script.onload = done;
    script.onerror = () => reject(new Error('Failed to load the spreadsheet parser.'));
    document.head.appendChild(script);
  });
}

const GOOGLE_AUTH_INTENT_KEY = 'googleAuthIntent';
const PENDING_BOOKING_KEY = 'pendingBookingSession';
const PENDING_BOOKING_TIER_KEY = 'pendingBookingTier';

function saveGoogleAuthIntent(intent) {
  try {
    sessionStorage.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify(intent));
  } catch (err) {
    console.warn('Could not save Google auth intent:', err);
  }
}

function consumeGoogleAuthIntent() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_AUTH_INTENT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(GOOGLE_AUTH_INTENT_KEY);
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Helper: Check if platform is Mac/iOS
const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

// Sort Firestore docs by createdAt (newest first) on the CLIENT. We must NOT use
// Firestore's .orderBy('createdAt') for this, because that query silently drops
// any document missing the createdAt field — which hid hand-seeded masterclasses
// (e.g. the featured class) from the dashboard list AND the home page. Docs with
// no createdAt sort last but are always included.
function sortByCreatedAtDesc(list) {
  const ms = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis()
    : (t && typeof t.seconds === 'number') ? t.seconds * 1000
    : (typeof t === 'number') ? t : 0;
  return list.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}


// ===============================================================
// HELPER COMPONENTS
// ===============================================================

// "Attach a calendar invite" fields shared by the two bulk-email composers
// (spreadsheet upload + saved contacts). `event` is null when unchecked, else
// { title, dateTime, duration, location } — sent as `event` to sendBulkEmail.
function EventInviteFields({ event, setEvent, disabled }) {
  return (
    <div className="form-group">
      <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--fg)", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!!event}
          onChange={(e) => setEvent(e.target.checked ? { title: "", dateTime: "", duration: "60", location: "" } : null)}
          disabled={disabled}
        />
        📅 Attach a calendar invite (.ics) with meeting details
      </label>
      {event && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          <div>
            <label className="form-label">Event title</label>
            <input className="form-input" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} placeholder="e.g. Claude Code Masterclass" disabled={disabled} />
          </div>
          <div>
            <label className="form-label">Date & time</label>
            <input className="form-input" type="datetime-local" value={event.dateTime} onChange={(e) => setEvent({ ...event, dateTime: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <label className="form-label">Duration (minutes)</label>
            <input className="form-input" type="number" min="15" step="15" value={event.duration} onChange={(e) => setEvent({ ...event, duration: e.target.value })} disabled={disabled} />
          </div>
          <div>
            <label className="form-label">Meeting link (optional)</label>
            <input className="form-input" value={event.location} onChange={(e) => setEvent({ ...event, location: e.target.value })} placeholder="https://teams.microsoft.com/…" disabled={disabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// Bulk-email composer (subject + body + optional calendar invite + send).
// Owns its field state locally so each keystroke re-renders only this small
// form — NOT the ~5000-line DashboardView (which caused visible typing lag).
// onSend receives { subject, body, event } and returns true to clear the form.
function EmailComposer({ subjectPlaceholder, bodyPlaceholder, bodyRows, buttonLabel, sending, onSend }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [event, setEvent] = useState(null);
  const canSend = !sending && subject.trim() && body.trim();
  const handleSend = async () => {
    const ok = await onSend({ subject, body, event });
    if (ok) { setSubject(""); setBody(""); setEvent(null); }
  };
  return (
    <React.Fragment>
      <div className="form-group">
        <label className="form-label">Subject</label>
        <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={subjectPlaceholder} disabled={sending} />
      </div>
      <div className="form-group">
        <label className="form-label">Body (use {"{{name}}"} to personalize · **bold** and [links](https://…) supported)</label>
        <textarea className="form-input" value={body} onChange={(e) => setBody(e.target.value)} rows={bodyRows} placeholder={bodyPlaceholder} disabled={sending} style={{ resize: "vertical", fontFamily: "inherit" }} />
      </div>
      <EventInviteFields event={event} setEvent={setEvent} disabled={sending} />
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className="form-btn form-btn--accent"
        style={{ width: "auto", margin: 0, padding: "14px 28px", background: sending ? "var(--bg-faint)" : "var(--c-rust)", cursor: canSend ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: "8px" }}
      >
        {sending ? (<><span className="ai-status__spinner"></span> Queuing…</>) : buttonLabel}
      </button>
    </React.Fragment>
  );
}

function PhaseTabBox({ phase, videoLinks, completedModules, tracking, onVideoProgress }) {
  const [activeTab, setActiveTab] = useState(0);
  const section = phase.sections[activeTab];
  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const embedVideos = H.getModuleEmbedVideos ? H.getModuleEmbedVideos(videoLinks, section.n) : [];
  const isComplete = (completedModules || []).includes(section.n);
  const phaseLabel = `Phase ${String(phase.id).padStart(2, '0')}`;

  return (
    <div className="tabbox tabbox--theater">
      <aside className="tabbox__nav" aria-label={`${phaseLabel} modules`}>
        <div className="tabbox__nav-head">
          {phase.capstone && (
            <div className="tabbox__capstone-pill">Capstone {phase.capstone}</div>
          )}
        </div>
        <div className="tabbox__tabs" role="tablist">
          {phase.sections.map((s, i) => {
            const done = (completedModules || []).includes(s.n);
            const hasVideo = H.getModuleEmbedVideos
              ? H.getModuleEmbedVideos(videoLinks, s.n).length > 0
              : false;
            return (
            <button key={i} role="tab" aria-selected={i === activeTab}
              id={`phase-${phase.id}-tab-${i}`}
              aria-controls={`phase-${phase.id}-panel`}
              tabIndex={i === activeTab ? 0 : -1}
              className={`tabbox__tab ${i === activeTab ? 'active' : ''} ${done ? 'is-done' : ''} ${hasVideo ? 'has-video' : ''}`}
              onClick={() => setActiveTab(i)}>
              <span className="tabbox__tab-num">{s.n}</span>
              <span className="tabbox__tab-title">{s.title}</span>
              {hasVideo && <span className="tabbox__tab-video" aria-label="Has video">▶</span>}
              {done && <span className="tabbox__tab-check" aria-label="Complete">✓</span>}
            </button>
          );})}
        </div>
      </aside>

      <div className="tabbox__panel" role="tabpanel"
        id={`phase-${phase.id}-panel`}
        aria-labelledby={`phase-${phase.id}-tab-${activeTab}`}
        tabIndex={0}>
        <div className="tabbox__panel-content" key={activeTab}>
          <div className="tabbox__module-head">
            <span className="tabbox__panel-num">
              Module {section.n}
              {isComplete && <span className="tabbox__done-badge">Complete</span>}
            </span>
            <h3 className="tabbox__module-title">{section.title}</h3>
          </div>

          {embedVideos.length > 0 && (
            <div className="tabbox__videos tabbox__videos--hero">
              {embedVideos.map((link) => (
                <div key={link.id} className="tabbox__video-embed">
                  <div className="tabbox__video-head">
                    <span className="tabbox__video-kind">{link.kind === 'playlist' ? 'Playlist' : 'Video'}</span>
                    <h4 className="tabbox__video-title">{link.title}</h4>
                  </div>
                  <V2ClickToPlayVideo
                    videoId={link.youtubeId}
                    playlistId={link.playlistId}
                    title={link.title}
                    startSec={link.startSec}
                    hideCaption
                    trackable={tracking && !link.playlistId}
                    mappingId={link.id}
                    modules={link.modules}
                    codeUrl={link.codeUrl}
                    onVideoProgress={onVideoProgress}
                  />
                </div>
              ))}
            </div>
          )}

          {section.note && (
            <div className="tabbox__note-card" role="note">
              <span className="tabbox__note-icon" aria-hidden="true">🛠️</span>
              <span className="tabbox__note-text">{section.note}</span>
            </div>
          )}

          <div className="tabbox__topics">
            <div className="tabbox__topics-label">Topics Covered in this Video</div>
            <table className="tabbox__topics-table">
              <tbody>
                {section.items.map((item, ii) => (
                  <tr key={ii} className="tabbox__topics-row">
                    <td className="tabbox__item-marker">{String(ii + 1).padStart(2, '0')}</td>
                    <td className="tabbox__topics-cell">{item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseProgressRing({ pct = 0, color }) {
  const r = 15.9155;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(100, pct)) / 100 * c;
  return (
    <div className="phase__progress-ring" role="img" aria-label={`${pct}% complete`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="phase__progress-ring-track" cx="18" cy="18" r={r} fill="none" strokeWidth="2.8" />
        <circle
          className="phase__progress-ring-fill"
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="2.8"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          data-color={color}
        />
      </svg>
      <span className="phase__progress-ring-text">{pct}%</span>
    </div>
  );
}

function PhaseTheaterHeader({ phase, phaseStat, tracking, user, onGatedDownloadClick }) {
  const materials = phase.materials || {};
  const hasMaterials = materials.driveZipUrl || materials.driveFolderUrl;
  const phaseLabel = `Phase ${String(phase.id).padStart(2, '0')}`;
  const pct = phaseStat?.pct ?? 0;

  return (
    <header className="phase__theater-header">
      <div className="phase__theater-main">
        <h2 className="phase__theater-title">
          <span className="phase__theater-title-row">
            <span className="phase__theater-title-text">{phase.title}</span>
            <span className="phase__theater-badge" data-color={phase.color}>{phaseLabel}</span>
          </span>
        </h2>
        <p className="phase__theater-summary">{phase.summary}</p>
        {hasMaterials && (
          <div className="phase__theater-downloads">
            <button
              className="phase__materials-btn tabbox__materials-btn"
              style={{ background: 'none', border: '1px solid var(--line-strong)', cursor: 'pointer', padding: '10px 18px', borderRadius: '6px' }}
              onClick={(e) => {
                const url = materials.driveZipUrl || materials.driveFolderUrl;
                if (user && !user.isAnonymous) {
                  window.open(url, '_blank');
                } else {
                  e.preventDefault();
                  onGatedDownloadClick && onGatedDownloadClick(url, `phase_materials_${phase.id}`);
                }
              }}
            >
              Download materials
            </button>
            {materials.label && (
              <span className="phase__materials-label tabbox__materials-label">{materials.label}</span>
            )}
          </div>
        )}
      </div>

      <div className="phase__theater-right">
        <div className="phase__theater-aside">
          <div className="phase__theater-meta-line">
            <span className="phase__theater-meta-label">Time Frame:</span>
            <span className="phase__theater-meta-value">{phase.weeks}</span>
          </div>
          <div className="phase__theater-meta-line">
            <span className="phase__theater-meta-label">Difficulty:</span>
            <span className="phase__diff-dots" aria-label={`Difficulty ${phase.difficulty} out of 5`}>
              {[1, 2, 3, 4, 5].map((d) => (
                <span key={d} className={`phase__diff-dot ${d <= phase.difficulty ? 'on' : ''}`} />
              ))}
            </span>
          </div>
          {phase.weeksDetail && (
            <span className="phase__theater-meta-detail">{phase.weeksDetail}</span>
          )}
        </div>
        <PhaseProgressRing pct={tracking ? pct : 0} color={phase.color} />
      </div>
    </header>
  );
}

function CommandPalette({ open, onClose, onJumpPhase, onJumpCapstone, videoLinks }) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = React.useMemo(() => {
    const out = [];
    window.ROADMAP.forEach((phase, pi) => {
      out.push({
        kind: 'phase',
        label: phase.title,
        sub: `Phase ${String(phase.id).padStart(2, '0')} · ${phase.weeks}`,
        haystack: `${phase.title} ${phase.short} ${phase.summary}`.toLowerCase(),
        action: () => onJumpPhase(pi)
      });
      phase.sections.forEach((s) => {
        out.push({
          kind: 'module',
          label: s.title,
          sub: `Module ${s.n} · ${phase.title}`,
          haystack: `${s.title} ${s.n} ${(s.items || []).join(' ')}`.toLowerCase(),
          action: () => onJumpPhase(pi)
        });
      });
    });
    window.CAPSTONES.forEach((c, ci) => {
      out.push({
        kind: 'capstone',
        label: c.title,
        sub: `Capstone ${c.n} · ${c.domain}`,
        haystack: `${c.title} ${c.domain} ${(c.build || []).join(' ')}`.toLowerCase(),
        action: () => onJumpCapstone(ci)
      });
    });
    const seenVideos = new Set();
    (videoLinks || []).forEach((link) => {
      const vk = `${link.youtubeId}-${link.title}`;
      if (seenVideos.has(vk)) return;
      seenVideos.add(vk);
      const pi = link.phaseId ? link.phaseId - 1 : -1;
      out.push({
        kind: 'video',
        label: link.title,
        sub: link.phaseId ? `Video · Phase ${String(link.phaseId).padStart(2, '0')}` : 'Roadmap video',
        haystack: `${link.title} ${link.kind} video youtube`.toLowerCase(),
        action: () => { if (pi >= 0) onJumpPhase(pi); }
      });
    });
    return out;
  }, [videoLinks]);

  const q = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!q) return items.slice(0, 30);
    const tokens = q.split(/\s+/).filter(Boolean);
    return items
      .map(item => {
        const allMatch = tokens.every(t => item.haystack.includes(t));
        if (!allMatch) return null;
        let score = 0;
        if (item.label.toLowerCase().includes(q)) score += 50;
        if (item.label.toLowerCase().startsWith(q)) score += 30;
        if (item.kind === 'phase') score += 5;
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(x => x.item);
  }, [q, items]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => { setHighlight(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(h => Math.min(results.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(h => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[highlight];
        if (r) { r.action(); onClose(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, highlight, onClose]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  if (!open) return null;
  return (
    <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search modules" onClick={onClose}>
      <div className="cmdk__panel" onClick={e => e.stopPropagation()}>
        <div className="cmdk__input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="cmdk__input"
            type="text"
            placeholder="Search phases, modules, capstones…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search"
            aria-controls="cmdk-list"
            aria-activedescendant={results[highlight] ? `cmdk-item-${highlight}` : undefined} />
          <kbd className="cmdk__esc">esc</kbd>
        </div>
        <div className="cmdk__list" ref={listRef} id="cmdk-list" role="listbox">
          {results.length === 0 ? (
            <div className="cmdk__empty">No matches for "{query}"</div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                id={`cmdk-item-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === highlight}
                className={`cmdk__item ${i === highlight ? 'is-active' : ''}`}
                onMouseMove={() => setHighlight(i)}
                onClick={() => { r.action(); onClose(); }}>
                <span className={`cmdk__kind cmdk__kind--${r.kind}`}>{r.kind}</span>
                <span className="cmdk__label">{r.label}</span>
                <span className="cmdk__sub">{r.sub}</span>
              </button>
            ))
          )}
        </div>
        <div className="cmdk__hint">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> jump</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}


// ===============================================================
// FULL INTERACTIVE ROADMAP TAB VIEW
// ===============================================================

function RoadmapView({
  searchOpen, setSearchOpen, scrollToPhase, scrollToCapstone, scrollToAgenda,
  agendaRef, totalSections, capstoneTiles, phaseRefs, capstoneRefs,
  videoLinks, user, roadmapProgress, onStartTracking, onVideoProgress, onOpenLogin,
  onDownloadRoadmap, onGatedDownloadClick,
}) {
  const H = window.ROADMAP_VIDEO_HELPERS || {};
  const tracking = Boolean(user && !user.isAnonymous && roadmapProgress?.startedAt);
  const progress = H.calcRoadmapProgress
    ? H.calcRoadmapProgress(roadmapProgress?.completedModules || [])
    : { phaseStats: [], overallPct: 0 };
  const nextModule = H.findNextModule
    ? H.findNextModule(roadmapProgress?.completedModules || [])
    : null;

  return (
    <main id="main">
      {/* HERO — 2-column: copy left, walkthrough video right */}
      <header className="hero hero--split" data-screen-label="01 Hero">
        <div className="hero__blob" />
        <div className="hero__blob-2" />
        <div className="hero__blob-3" />

        <div className="hero__grid">
          <div className="hero__copy">
            <div className="hero__eyebrow">
              The 2026 Edition · 26 Weeks · 9 Phases
            </div>
            <h1 className="hero__title">
              The only roadmap you need to become a{' '}
              <span className="hero__title-100x">100× AI Engineer</span> <em>in 2026.</em>
            </h1>
            <p className="hero__sub">
              A complete, production-grade journey from <em>script kid to agent engineer</em>.
              Every module grounded in real enterprise AI engineering — from Python fundamentals
              all the way to multi-agent systems shipping in regulated domains.
            </p>
            <div className="hero__actions" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <button className="hero__cta" type="button" onClick={scrollToAgenda}>
                Explore the roadmap
                <span aria-hidden="true">↓</span>
              </button>
              {!tracking && (
                <button
                  className="hero__cta hero__cta--ghost"
                  type="button"
                  onClick={() => {
                    if (user && !user.isAnonymous) onStartTracking && onStartTracking();
                    else onOpenLogin && onOpenLogin();
                  }}
                >
                  Start tracking progress
                </button>
              )}
            </div>
            {tracking && (
              <div className="roadmap-progress-banner">
                <div className="roadmap-progress-banner__bar">
                  <div className="roadmap-progress-banner__fill" style={{ width: `${progress.overallPct}%` }} />
                </div>
                <span className="roadmap-progress-banner__label">{progress.overallPct}% complete</span>
                {nextModule && (
                  <button type="button" className="roadmap-progress-banner__continue" onClick={() => scrollToPhase(nextModule.phaseId - 1)}>
                    Continue · {nextModule.moduleN}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="hero__video">
            <V2ClickToPlayVideo
              videoId="Eze6D8jAMjI"
              title="Agentic AI Engineer Roadmap 2026 — Balaji Chippada"
              caption={`${V2_SOCIAL.roadmapViews} views · Full 26-week walkthrough · Watch on YouTube`}
            />
          </div>
        </div>

        <div className="hero__stats">
          <div>
            <div className="hero__stat-num">{window.ROADMAP.length}</div>
            <div className="hero__stat-label">Phases</div>
          </div>
          <div>
            <div className="hero__stat-num">{totalSections}</div>
            <div className="hero__stat-label">Modules</div>
          </div>
          <div>
            <div className="hero__stat-num">26</div>
            <div className="hero__stat-label">Weeks</div>
          </div>
          <div>
            <div className="hero__stat-num">{window.CAPSTONES.length}</div>
            <div className="hero__stat-label">Capstones</div>
          </div>
        </div>
      </header>

      {/* AGENDA — 9 phase tiles */}
      <section className="agenda reveal" ref={agendaRef} data-screen-label="02 Agenda">
        <div className="agenda__head">
          <h2 className="agenda__title">What we'll <em>cover.</em></h2>
          <div className="agenda__sub">
            A complete production-grade journey. Every module grounded in real enterprise AI engineering.
          </div>
        </div>
        <div className="agenda__grid agenda__grid--phases">
          {window.ROADMAP.map((p) => (
            <button key={p.id}
              type="button"
              className="agenda__tile"
              data-color={p.color}
              aria-label={`Jump to phase ${String(p.id).padStart(2, '0')}: ${p.title}`}
              onClick={() => scrollToPhase(p.id - 1)}>
              <div className="agenda__tile-glow" />
              <div className="agenda__tile-num">{String(p.id).padStart(2, '0')}</div>
              <div className="agenda__tile-title">{p.short}</div>
              <div className="agenda__tile-weeks">{p.weeks}</div>
              <div className="agenda__tile-arrow">→</div>
            </button>
          ))}
        </div>

        {/* Projects in their own row */}
        <div className="agenda__projects-head">
          <span className="agenda__projects-label">◆ Capstone Projects</span>
          <span className="agenda__projects-line" />
        </div>
        <div className="agenda__grid agenda__grid--projects">
          {capstoneTiles.map((c) => (
            <button key={`cap-${c.n}`}
              type="button"
              className="agenda__tile is-capstone"
              data-color={c.color}
              aria-label={`Jump to capstone project ${c.n}: ${c.title}`}
              onClick={() => scrollToCapstone(c.n - 1)}>
              <div className="agenda__tile-glow" />
              <div className="agenda__tile-cap-label">Project {c.n}</div>
              <div className="agenda__tile-title">{c.title}</div>
              <div className="agenda__tile-domain">{c.domain}</div>
              <div className="agenda__tile-arrow">→</div>
            </button>
          ))}
        </div>
      </section>

      {/* INSTRUCTOR — shared Courses-tab (cv3) section */}
      <div className="cv3 cv3-embed" data-screen-label="03 Instructor">
        <CoursesInstructorSection />
      </div>

      {/* PHASES */}
      <section className="phases">
        {window.ROADMAP.map((phase, i) => {
          const phaseStat = progress.phaseStats.find((ps) => ps.phaseId === phase.id);

          return (
          <article key={phase.id} className="phase phase--theater"
            ref={el => phaseRefs.current[i] = el}
            data-screen-label={`${String(phase.id).padStart(2, '0')} ${phase.title}`}>
            <PhaseTheaterHeader phase={phase} phaseStat={phaseStat} tracking={tracking} user={user} onGatedDownloadClick={onGatedDownloadClick} />
            <PhaseTabBox
              phase={phase}
              videoLinks={videoLinks}
              completedModules={roadmapProgress?.completedModules}
              tracking={tracking}
              onVideoProgress={onVideoProgress}
            />
            {phase.difficultyNote && (
              <p className="phase__diff-note phase__diff-note--theater">{phase.difficultyNote}</p>
            )}
            <div className="phase__endstate reveal">
              <div className="phase__endstate-label">End state</div>
              <div className="phase__endstate-text">{phase.endState}</div>
            </div>
          </article>
        );})}
      </section>

      {/* CAPSTONES */}
      <section className="capstones reveal" data-screen-label="Capstones">
        <div className="capstones__eyebrow">Three Capstone Projects</div>
        <h2 className="capstones__title">Theory bound to <em>production reality.</em></h2>
        <p className="capstones__intro">
          Each capstone lands at the end of a phase cluster. They aren't toys — they're the proof
          that the curriculum stuck.
        </p>
        <div className="capstone-grid">
          {window.CAPSTONES.map((c, i) => (
            <article key={c.n}
              className="capstone reveal"
              ref={el => capstoneRefs.current[i] = el}>
              <div className="capstone__left">
                <div className="capstone__num">CAPSTONE {String(c.n).padStart(2, '0')}</div>
                <div className="capstone__title">{c.title}</div>
                <div className="capstone__phase">{c.phase}</div>
                <div className="capstone__domain">{c.domain}</div>
                <div className="capstone__stack">
                  {c.stack.map((s, i) => (
                    <span key={i} className="capstone__stack-pill">{s}</span>
                  ))}
                </div>
              </div>
              <div className="capstone__build">
                <div className="capstone__build-label">What you build</div>
                {c.build.map((b, i) => (
                  <div key={i} className="capstone__build-item">
                    <span className="capstone__build-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{b}</span>
                  </div>
                ))}
                <div className="capstone__proves">
                  <span className="capstone__proves-label">Proves</span>
                  {c.proves}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* OUT OF SCOPE */}
      <section className="outscope reveal" data-screen-label="Out of scope">
        <div className="outscope__head">
          <div className="outscope__eyebrow">◇ Out of scope (and why)</div>
          <h2 className="outscope__title">What this roadmap <em>doesn't</em> cover.</h2>
          <p className="outscope__intro">
            Every roadmap is as much about what's left out as what's in. These topics are real and useful —
            they're just not on the critical path to becoming a shipping AI engineer in 2026.
          </p>
        </div>
        <div className="outscope__grid">
          {window.OUT_OF_SCOPE.map((o, i) => (
            <article key={i} className="outscope__card">
              <div className="outscope__card-num">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="outscope__card-title">{o.title}</h3>
              <p className="outscope__card-why">{o.why}</p>
              <div className="outscope__card-pointer">
                <span className="outscope__card-pointer-label">Where to look</span>
                <span>{o.pointer}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* WHERE TO GO FROM HERE */}
      <section className="next reveal" data-screen-label="Where to go from here">
        <div className="next__head">
          <div className="next__eyebrow">→ After the roadmap</div>
          <h2 className="next__title">Where to go <em>from here.</em></h2>
          <p className="next__intro">
            You finished the curriculum and built three production systems. Now turn that work into interviews,
            offers, and the next thing you ship.
          </p>
        </div>
        <div className="next__grid">
          {window.NEXT_STEPS.map((n, i) => (
            <article key={i} className="next__card">
              <div className="next__card-label">{n.label}</div>
              <h3 className="next__card-title">{n.title}</h3>
              <p className="next__card-body">{n.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer reveal">
        <h2 className="footer__title">
          The journey ends where the <em>real work</em> begins.
        </h2>
        <div className="footer__meta">26 weeks · 9 phases · {totalSections} modules · 3 capstones · one engineer</div>
      </footer>
    </main>
  );
}



// ===============================================================
// REVEAL ON SCROLL — whileInView fade + slide entrance.
// Wraps any section/card. Respects prefers-reduced-motion.
// ===============================================================

function RevealOnScroll({ children, delay = 0, className }) {
  const shouldReduce = useReducedMotion ? useReducedMotion() : false;
  if (!motion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: shouldReduce ? 0 : 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-72px' }}
      transition={{
        duration: shouldReduce ? 0 : 0.6,
        ease: [0.22, 1, 0.36, 1],
        delay: shouldReduce ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

// ===============================================================
// ANIMATED COUNTER — counts up from 0 to `to` when in view.
// Uses plain useState to avoid rendering a MotionValue as a React
// child (which triggers React error #31).
// ===============================================================

function AnimatedCounter({ to, suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(to);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true);
        observer.disconnect();

        // Animate using requestAnimationFrame for reliability
        const startTime = performance.now();
        const duration = 1500;
        const startVal = 0;

        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(startVal + (to - startVal) * eased));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [to, started]);

  return <span ref={ref}>{displayValue}{suffix}</span>;
}

function TestimonialMarquee() {
  const items = [
    { text: "Finally understood LLM vs workflow vs agent — the roadmap video changed how I learn.", author: "Roadmap viewer" },
    { text: "Shipped my first agentic feature in 3 days after the live Claude Code session.", author: "Rahul Mehta · Swiggy" },
    { text: "Demo-first teaching — Balaji shows the agent running before explaining theory.", author: "YouTube subscriber" },
    { text: "The critic-loop resume agent demo convinced me this isn't just another AI course.", author: "Working professional" },
    { text: "Free roadmap got me started; the masterclass got me shipping in production.", author: "Fresher · Hyderabad" },
  ];

  const marqueeContent = (
    <div className="marquee__inner">
      {items.map((item, idx) => (
        <span className="marquee__item" key={idx}>
          <span className="marquee__text">“{item.text}”</span>
          <span className="marquee__author">— {item.author}</span>
          <span className="marquee__separator">◆</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee__container">
      <div className="marquee__track">
        {marqueeContent}
        {marqueeContent}
      </div>
    </div>
  );
}

// ===============================================================
// MASTERCLASS CARD — dynamic scroll-linked card with symmetrical focus animation.
// Symmetrically grows in size (peaks at 1.12x in center) and fades gracefully on scroll.
// ===============================================================

function MasterclassCard({ mc, idx, user, onBook, reserved, onManage }) {
  const cardRef = useRef(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    setIsMobileViewport(window.innerWidth <= 768);
    const handleResize = () => setIsMobileViewport(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  let scrollYProgress;
  try {
    const scrollObj = useScroll ? useScroll({
      target: cardRef,
      offset: ["start end", "end start"]
    }) : null;
    scrollYProgress = scrollObj ? scrollObj.scrollYProgress : null;
  } catch (e) {
    console.warn("Framer Motion useScroll element target not available on MasterclassCard", e);
  }

  const dummyValue = useMotionValue ? useMotionValue(0.5) : null;
  const activeProgress = scrollYProgress || dummyValue;

  // Disable scale animation on mobile for readability and battery.
  const scaleMin = isMobileViewport ? 1 : 0.94;
  const scaleMax = isMobileViewport ? 1 : 1.04;

  // Symmetrical grow-and-shrink card effect:
  // Starts at scale 0.90 entering from bottom, peaks at scale 1.12 in viewport center (very dramatic and big!), shrinks back to 0.90 exiting top.
  const cardScale = useTransform ? useTransform(activeProgress, [0, 0.5, 1], [scaleMin, scaleMax, scaleMin]) : 1;
  // Don't fade cards on mobile — it hurts readability while scrolling.
  const cardOpacity = useTransform
    ? useTransform(activeProgress, [0, 0.15, 0.85, 1], isMobileViewport ? [1, 1, 1, 1] : [0.65, 1, 1, 0.65])
    : 1;

  const mcDate = mc.dateTime ? new Date(mc.dateTime) : null;
  const isMostPopular = mc.title.toLowerCase().includes('rag') || idx === 0;
  const seatsLeft = getSeatsRemaining(mc);
  const outcome = getMcOutcome(mc);

  // Pricing / availability — keep consistent with nav + booking wizard.
  const free = isMcFree(mc);
  const hasSeatData = typeof mc.seatsBooked === 'number';
  const soldOut = hasSeatData && seatsLeft <= 0;
  const priceText = free ? 'Free' : `₹${(mc.price || 0).toLocaleString()}`;
  const ctaText = soldOut ? 'Sold out' : (free ? <>Reserve seat · <V2McPrice mc={mc} /></> : `Book my seat — ${priceText}`);
  const subcopyText = 'Meeting link emailed a few days before the masterclass +  Meeting reminders';

  return (
    <div ref={cardRef} style={{ margin: isMobileViewport ? '40px 0' : '140px 0', padding: '0', overflow: 'visible' }}>
      <RevealOnScroll>
        {motion ? (
          <motion.article 
            id={`mc-card-${mc.id}`} 
            className={`mc-card ${isMostPopular ? 'is-popular' : ''}`} 
            style={{ 
              scale: cardScale, 
              opacity: cardOpacity,
              transformOrigin: 'center center',
              border: isMostPopular ? '1px solid rgba(186,117,23,0.35)' : '1px solid var(--line)',
              boxShadow: '0 24px 60px -30px rgba(0,0,0,0.18)'
            }}
          >
            {/* Card header: title, meta, price */}
            <div className="mc-card__header">
              <div className="mc-card__meta">
                <div className="mc-card__eyebrow">
                  Live Masterclass
                </div>
                <h2 className="mc-card__title">{mc.title}</h2>
                {outcome && (
                  <div className="mc-card__outcome">
                    <span className="mc-card__outcome-label">What you&apos;ll build</span>
                    <p>{outcome}</p>
                  </div>
                )}
                <div className="mc-card__badges">
                  {mc.instructor && (
                    <span className="mc-card__badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      {mc.instructor}
                    </span>
                  )}
                  {mcDate && (
                    <span className="mc-card__badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                      {mcDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                  {mc.syllabus && (
                    <span className="mc-card__badge">
                      📚 {mc.syllabus.length} modules
                    </span>
                  )}
                </div>
              </div>
              <div className="mc-card__price-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  {isMostPopular && (
                    <span className="mc-card__popular-badge">Most popular</span>
                  )}
                  <div className="mc-card__price-label" style={{ margin: 0 }}>Registration</div>
                </div>
                <div className="mc-card__price">{priceText}</div>
              </div>
            </div>

            {/* Split-pane syllabus viewer */}
            {mc.syllabus && mc.syllabus.length > 0 && (
              <SplitPaneSyllabus syllabus={mc.syllabus} />
            )}

            {/* CTA footer */}
            <div className="mc-card__cta">
              <div className="mc-card__cta-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="mc-card__cta-label" style={{ margin: 0, padding: 0 }}>
                  {mcDate
                    ? <><strong>{mcDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> at {mcDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                    : <strong>Date TBA</strong>
                  }
                </div>
              </div>

              <div className="mc-card__cta-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {reserved ? (
                  <button
                    type="button"
                    className="form-btn"
                    onClick={() => onManage && onManage()}
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto', margin: 0, background: 'var(--c-emerald)', color: '#fff', border: 'none' }}
                  >
                    ✓ Reserved · View
                  </button>
                ) : soldOut ? (
                  <button
                    type="button"
                    className="form-btn"
                    disabled
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto', opacity: 0.55, cursor: 'not-allowed', margin: 0 }}
                  >
                    Sold out
                  </button>
                ) : (
                  <ShimmerButton
                    variant="dark"
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto' }}
                    onClick={() => onBook({ ...mc, description: mc.rawSyllabus || '' })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                        <path d="M13 5v2" />
                        <path d="M13 17v2" />
                        <path d="M13 11v2" />
                      </svg>
                      <span>{ctaText}</span>
                    </div>
                  </ShimmerButton>
                )}
                <div style={{
                  fontSize: '11px',
                  color: 'var(--fg-faint)',
                  textAlign: 'right',
                  marginTop: '4px'
                }}>
                  {reserved ? 'You\u2019re registered — meeting link will be emailed before the masterclass' : subcopyText}
                </div>
              </div>
            </div>
          </motion.article>
        ) : (
          <article id={`mc-card-${mc.id}`} className={`mc-card ${isMostPopular ? 'is-popular' : ''}`} style={isMostPopular ? { border: '1px solid rgba(186,117,23,0.35)' } : {}}>
            {/* Card header: title, meta, price */}
            <div className="mc-card__header">
              <div className="mc-card__meta">
                <div className="mc-card__eyebrow">
                  Live Masterclass
                </div>
                <h2 className="mc-card__title">{mc.title}</h2>
                {outcome && (
                  <div className="mc-card__outcome">
                    <span className="mc-card__outcome-label">What you&apos;ll build</span>
                    <p>{outcome}</p>
                  </div>
                )}
                <div className="mc-card__badges">
                  {mc.instructor && (
                    <span className="mc-card__badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      {mc.instructor}
                    </span>
                  )}
                  {mcDate && (
                    <span className="mc-card__badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                      {mcDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                  {mc.syllabus && (
                    <span className="mc-card__badge">
                      📚 {mc.syllabus.length} modules
                    </span>
                  )}
                </div>
              </div>
              <div className="mc-card__price-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  {isMostPopular && (
                    <span className="mc-card__popular-badge">Most popular</span>
                  )}
                  <div className="mc-card__price-label" style={{ margin: 0 }}>Registration</div>
                </div>
                <div className="mc-card__price">{priceText}</div>
              </div>
            </div>

            {/* Split-pane syllabus viewer */}
            {mc.syllabus && mc.syllabus.length > 0 && (
              <SplitPaneSyllabus syllabus={mc.syllabus} />
            )}

            {/* CTA footer */}
            <div className="mc-card__cta">
              <div className="mc-card__cta-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="mc-card__cta-label" style={{ margin: 0, padding: 0 }}>
                  {mcDate
                    ? <><strong>{mcDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> at {mcDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                    : <strong>Date TBA</strong>
                  }
                </div>
              </div>

              <div className="mc-card__cta-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {reserved ? (
                  <button
                    type="button"
                    className="form-btn"
                    onClick={() => onManage && onManage()}
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto', margin: 0, background: 'var(--c-emerald)', color: '#fff', border: 'none' }}
                  >
                    ✓ Reserved · View
                  </button>
                ) : soldOut ? (
                  <button
                    type="button"
                    className="form-btn"
                    disabled
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto', opacity: 0.55, cursor: 'not-allowed', margin: 0 }}
                  >
                    Sold out
                  </button>
                ) : (
                  <ShimmerButton
                    variant="dark"
                    style={{ padding: '10px 20px', borderRadius: '8px', width: 'auto' }}
                    onClick={() => onBook({ ...mc, description: mc.rawSyllabus || '' })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                        <path d="M13 5v2" />
                        <path d="M13 17v2" />
                        <path d="M13 11v2" />
                      </svg>
                      <span>{ctaText}</span>
                    </div>
                  </ShimmerButton>
                )}
                <div style={{
                  fontSize: '11px',
                  color: 'var(--fg-faint)',
                  textAlign: 'right',
                  marginTop: '4px'
                }}>
                  {reserved ? 'You\u2019re registered — meeting link will be emailed before the masterclass' : subcopyText}
                </div>
              </div>
            </div>
          </article>
        )}
      </RevealOnScroll>
    </div>
  );
}

function InstructorSocialLinks() {
  return (
    <div className="instructor__socials">
      <a
        className="instructor__social instructor__social--whatsapp"
        href={V2_BRAND.whatsappCommunity}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join WhatsApp community"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
      <a
        className="instructor__social instructor__social--linkedin"
        href={V2_BRAND.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Connect with Balaji Chippada on LinkedIn"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
        </svg>
      </a>
      <a
        className="instructor__social instructor__social--youtube"
        href={V2_BRAND.youtubeChannel}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Balaji Chippada on YouTube"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
        </svg>
      </a>
      <a
        className="instructor__social instructor__social--instagram"
        href={V2_BRAND.instagram}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Balaji Chippada on Instagram"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
        </svg>
      </a>
    </div>
  );
}

// Shared "Your instructor" section — the Courses-tab (cv3) design, reused on
// the Home and Full Roadmap pages. Reads window.COURSE_INSTRUCTOR (data.js).
// Standalone usages wrap it in `.cv3 cv3-embed` for the cv3 tokens + full-bleed.
function CoursesInstructorSection() {
  const instr = window.COURSE_INSTRUCTOR || {};
  return (
    <section className="cv3-instructor" id="cv3-instructor">
      <div className="cv3-instructor-inner">
        <div className="cv3-instructor-photo">
          <img src="uploads/balaji-chippada-portrait.webp" alt="Balaji Chippada" loading="lazy" decoding="async" />
        </div>
        <div>
          <div className="cv3-eyebrow">Your instructor</div>
          <h2 className="cv3-h2">Balaji Chippada</h2>
          {instr.roleLine && <div className="cv3-instructor-role">{instr.roleLine}</div>}
          {instr.quote && <blockquote className="cv3-instructor-quote">{instr.quote}</blockquote>}
          <p className="cv3-instructor-para">I build production-scale agentic applications and teach engineers what actually matters once systems leave the demo stage. My free <b>26-week roadmap</b> is fully open source, no paywall — the live masterclasses are where we build together on the hard phases: RAG, Claude Code, multi-agent orchestration, guardrails, and deployment.</p>
          <p className="cv3-instructor-para">Over the last three years I've personally mentored <b>5,000+</b> students and working professionals — with production experience across <b>Swisscom</b>, <b>Warner Bros. Discovery</b>, <b>T-Mobile</b>, and <b>Infosys</b>.</p>
          <div className="cv3-instructor-stats">
            {(instr.stats || []).map((s) => (
              <div key={s.label} className="cv3-instructor-stat"><div className="cv3-stat-num">{s.num}</div><div className="cv3-stat-label">{s.label}</div></div>
            ))}
          </div>
          <div className="cv3-eyebrow cv3-instructor-connect-label">Connect with me</div>
          <InstructorSocialLinks />
        </div>
      </div>
    </section>
  );
}

function InstructorBio() {
  return (
    <div id="instructor" className="cv3 cv3-embed">
      <CoursesInstructorSection />
    </div>
  );
}

function ClosingCTA({ defaultPrice = 200, user, setBookingSession, setBookingName, setBookingEmail, setBookingPhone }) {
  return (
    <section className="closing-cta">
      <RevealOnScroll>
        {/* Eyebrow label */}
        <span className="closing-cta__eyebrow">
          Next session · Sunday 31 May at 6:00 pm IST
        </span>
        
        {/* Headline */}
        <h2 className="closing-cta__headline">
          Your seat is one click away.
        </h2>
        
        {/* Price row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '20px',
          margin: '16px 0'
        }}>
          <strong style={{ color: '#BA7517' }}>₹{defaultPrice.toLocaleString()}</strong>
          <span className="closing-cta__original-price">
            ₹{Math.round(defaultPrice / 0.4).toLocaleString()}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            background: '#EAF3DE',
            color: '#3B6D11',
            padding: '2px 8px',
            borderRadius: '99px'
          }}>
            Save 60%
          </span>
        </div>
        
        {/* Primary CTA button */}
        <button
          className="hero__primary-cta"
          style={{ width: '260px', marginTop: '20px' }}
          onClick={() => {
            setBookingSession({ 
              title: "Claude Code Masterclass", 
              price: defaultPrice, 
              dateTime: "2026-05-31T18:00:00Z",
              description: "Live Masterclass with Balaji Chippada" 
            });
            setBookingName("");
            setBookingEmail(user ? user.email : "");
            setBookingPhone("");
          }}
        >
          Book my seat — ₹{defaultPrice.toLocaleString()}
        </button>
        
        {/* Micro-copy */}
        <div className="closing-cta__microcopy">
          Meeting link emailed a few days before the masterclass +  Meeting reminders
        </div>
      </RevealOnScroll>
    </section>
  );
}

// ===============================================================
// SITE FOOTER — premium animated footer matching shadcn design.
// Supports full responsive grids, light/dark themes, and active tabs.
// ===============================================================

function SiteFooter({ setActiveMainTab, setLegalPage }) {
  const footerSections = [
    {
      label: 'Product',
      links: [
        { title: 'Claude Code Masterclass', href: '/masterclasses' },
        { title: 'Live Cohorts', href: '/masterclasses' },
        { title: '2026 Roadmap', href: '/roadmap', onClickTab: 'roadmap' },
        { title: 'Full Syllabus', href: '/roadmap', onClickTab: 'roadmap' }
      ]
    },
    {
      label: 'Resources',
      links: [
        { title: 'How to Become an AI Engineer', href: '/guides/how-to-become-an-agentic-ai-engineer' },
        { title: 'Agentic AI Glossary', href: '/glossary' },
        { title: 'Roadmap Walkthrough (YouTube)', href: 'https://www.youtube.com/watch?v=Eze6D8jAMjI' },
      ]
    },
    {
      label: 'Company',
      links: [
        { title: 'About Balaji', href: '/about' },
        // Real pages, not modals: Google's OAuth branding review requires a
        // crawlable privacy-policy link on the homepage, and a `#` + modal
        // gives a reviewer (or crawler) nothing to follow.
        { title: 'Privacy Policy', href: '/privacy' },
        { title: 'Terms of Service', href: '/terms' },
        { title: 'Refund Policy', href: '#', legal: 'refund' },
        { title: 'Contact', href: '#', legal: 'contact' },
      ]
    },
    {
      label: 'Social Links',
      links: [
        { title: 'LinkedIn', href: 'https://www.linkedin.com/in/balaji-chippada-0317/', icon: 'linkedin' },
        { title: 'YouTube', href: V2_BRAND.youtubeChannel, icon: 'youtube' },
        { title: 'Instagram', href: V2_BRAND.instagram, icon: 'instagram' },
        { title: 'WhatsApp Community', href: V2_BRAND.whatsappCommunity, icon: 'whatsapp' },
      ]
    }
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer__glow-line" />
      <div className="site-footer__container">
        <div className="site-footer__main-grid">
          <RevealOnScroll className="site-footer__brand-col">
            <div className="site-footer__brand">
              <div className="site-footer__logo-wrapper">
                {/* FLA wordmark. Letterforms inherit currentColor so the mark
                    works on the footer's light and dark backgrounds; the
                    paper-plane accent keeps its brand colours. */}
                <svg className="site-footer__logo" viewBox="99 318 802 364" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FLA">
                  <path fill="currentColor" d="M115.4,681.25c-3.24,0-6.92-1.36-9.86-3.64-3.58-2.78-5.55-6.46-5.54-10.38l.14-199.83c.02-22.81,4.37-42.49,12.93-58.48,9.94-18.55,25.13-31.2,45.15-37.59,14.12-4.51,28.13-6.7,42.83-6.71l118.81-.08c2.6,0,5.08,1.09,7.01,3.06,1.94,1.99,3.02,4.61,2.96,7.17l-.43,17.59c-.38,15.75-14.96,25.16-28.84,25.17l-93.39.02c-25.17,0-39.76,7.78-44.59,23.75-2.75,9.08-4.18,18.85-4.24,29.03l-.18,28.18c3.87-1.36,8.37-2.41,13.38-2.41,0,0,104.01-.01,104.01-.01,4.53,0,9.17,4.61,9.2,9.14l.1,15.41c.05,7.75-2.82,14.94-8.08,20.24-5.08,5.12-11.95,7.94-19.36,7.95l-84.84.11c-8.01.01-14.3,6.52-14.32,14.82l-.23,87.17c-.04,16.1-13.63,29.91-29.67,30.14l-12.95.19Z"/>
                  <path fill="currentColor" d="M493.85,638.59c2.84-4.59-.47-10.52-5.86-10.52l-36.32-.03c-23.17-.01-36.14-6.41-39.64-19.57-1.97-7.42-2.9-14.18-2.9-21.28l-.09-213.03c0-5.58-5.16-9.47-9.8-9.47l-43.11.04c-4.76,0-9.09,4.48-9.08,9.38l.13,214.23c0,16.3,3.19,31.45,9.71,46.32,8.07,18.4,22.64,31.83,42.13,38.84,14.66,5.28,27.81,7.74,41.38,7.74h21.65c3.4.01,6.56-1.75,8.35-4.64l23.47-38.01Z"/>
                  <path fill="currentColor" d="M873.14,614.9l-50.59-82.61c-2.71-4.43-9.12-4.49-11.92-.12l-23.57,36.75c-1.48,2.31-1.48,5.27,0,7.58l28.89,45.2c.58.9.65,3.11.12,3.84-.54.73-2.21,1.34-3.56,1.34l-89.85-.03c-.98,0-2.66-1.17-2.91-1.92-.25-.75.12-2.1.81-3.17l64.23-100.09,28.1-43.86,28.86-44.9c2.74-4.27,1.6-9.94-2.58-12.82l-21.74-14.95-5.65-3.84c-4.36-2.97-10.32-1.76-13.18,2.67l-56.51,87.58-63.68,97.57-39.44,60.16c-3.62,5.52-6,10.32-4.05,17.44,1.38,5.03,5.09,9.91,10.91,12.42,4.36,1.88,8.73,1.98,13.74,1.98h98.88s116.52-.06,116.52-.06c7.54,0,14.28-4.82,17.56-10.14,4.14-6.72,5.07-15.08,1.13-21.68l-20.5-34.34Z"/>
                  <path fill="currentColor" d="M562.19,665.28c-6.57,10.67-13.77,16.09-26.31,15.97l-22.65-.22-17.4-.16c-1.34-.01-3.4-1.77-3.92-2.83-.62-1.26-.81-3.82.23-5.5l60.57-98.11,121.46-196.78c.23-.38.5-.74.8-1.06,5.11-5.5,10.55-9.35,17.81-11.29,12.35-2.65,25.96,1.62,32.88,12.83l27.35,44.29c1.37,2.21,1.34,5.01-.06,7.2l-24.42,38.03c-2.67,4.16-8.77,4.14-11.41-.05l-13.29-21.13c-.63-1.46-2.25-2.6-3.74-2.5s-2.3,1.57-3.24,3.07l-25.12,40.47-109.54,177.78Z"/>
                  <polygon fill="#aa241a" points="850.09 394.53 833.7 405.94 833.48 402.32 843.92 387.48 850.09 394.53"/>
                  <path fill="#f9472b" d="M831.31,381.51l45.96,31.72c2.16,1.49,5.14.27,5.64-2.3l17.01-87.84c.56-2.87-2.32-5.19-5.01-4.04l-89,38.16c-2.63,1.13-2.99,4.71-.63,6.34l26.03,17.96"/>
                  <path fill="#db3a2a" d="M888.57,332.09l-44.32,58.34-10.32,15.26c-.79,1.07-2.49.51-2.49-.83l.13-23.19,57-49.59Z"/>
                </svg>
              </div>
              <p className="site-footer__copyright">
                © {new Date().getFullYear()} Balaji Chippada. All rights reserved.
              </p>
            </div>
          </RevealOnScroll>

          <div className="site-footer__links-wrapper">
            {footerSections.map((section, idx) => (
              <RevealOnScroll key={section.label} delay={0.1 + idx * 0.1} className="site-footer__links-col">
                <div>
                  <h3 className="site-footer__col-title">{section.label}</h3>
                  <ul className="site-footer__links-list">
                    {section.links.map((link) => {
                      const iconSvg = link.icon === 'linkedin' ? (
                        <svg className="site-footer__link-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
                        </svg>
                      ) : link.icon === 'youtube' ? (
                        <svg className="site-footer__link-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                        </svg>
                      ) : link.icon === 'instagram' ? (
                        <svg className="site-footer__link-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                        </svg>
                      ) : link.icon === 'whatsapp' ? (
                        <svg className="site-footer__link-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      ) : null;

                      const handleLinkClick = (e) => {
                        if (link.isScroll) {
                          e.preventDefault();
                          const el = document.querySelector(link.href);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          }
                        } else if (link.onClickTab) {
                          e.preventDefault();
                          setActiveMainTab(link.onClickTab);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else if (link.legal && setLegalPage) {
                          e.preventDefault();
                          setLegalPage(link.legal);
                        }
                      };

                      return (
                        <li key={link.title} className="site-footer__link-item">
                          {link.href.startsWith('http') ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="site-footer__link"
                            >
                              {iconSvg}
                              <span>{link.title}</span>
                            </a>
                          ) : (
                            <a
                              href={link.href}
                              onClick={handleLinkClick}
                              className="site-footer__link"
                            >
                              {iconSvg}
                              <span>{link.title}</span>
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}

// ===============================================================
// SHIMMER BUTTON — premium CTA button with CSS shimmer sweep.
// Matches the warm beige palette (shimmer = #d4b483 / rust tones).
// ===============================================================

function ShimmerButton({ children, onClick, className, variant = 'dark' }) {
  const shouldReduce = useReducedMotion ? useReducedMotion() : false;
  const btn = (
    <button
      className={`shimmer-btn shimmer-btn--${variant} ${className || ''}`}
      onClick={onClick}
    >
      {!shouldReduce && <span className="shimmer-btn__shine" aria-hidden="true" />}
      <span className="shimmer-btn__label">{children}</span>
    </button>
  );
  if (!motion || shouldReduce) return btn;
  return (
    <motion.div style={{ display: 'inline-flex' }} whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}>
      {btn}
    </motion.div>
  );
}


// DottedSurface (Three.js particle background) removed — no longer rendered.
// Three.js CDN script also removed from index.html to drop ~120KB of dead JS.

// ===============================================================
// GOOEY TEXT — morphs between a list of phrases using gooey blur filter.
// Translated from the pristine TypeScript/Tailwind shadcn component.
// ===============================================================

function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className,
  textClassName
}) {
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);

  useEffect(() => {
    let textIndex = texts.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTime;

    // Set initial text contents immediately to eliminate the blank mount delay
    if (text1Ref.current && text2Ref.current && texts.length > 0) {
      text2Ref.current.textContent = texts[0];
      text1Ref.current.textContent = texts[texts.length - 1];
      text2Ref.current.style.filter = "";
      text2Ref.current.style.opacity = "100%";
      text1Ref.current.style.filter = "";
      text1Ref.current.style.opacity = "0%";
    }

    const setMorph = (fraction) => {
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        const fInv = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / fInv - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(fInv, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.style.filter = "";
        text1Ref.current.style.opacity = "0%";
      }
    };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTime;

      if (fraction > 1) {
        cooldown = cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    };

    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const newTime = new Date();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;

      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [texts, morphTime, cooldownTime]);

  return (
    <div className={`gooey-text-wrapper ${className || ''}`} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="gooey-text-container"
        style={{ filter: "url(#threshold)" }}
      >
        <span
          ref={text1Ref}
          className={`gooey-text-item ${textClassName || ''}`}
        />
        <span
          ref={text2Ref}
          className={`gooey-text-item ${textClassName || ''}`}
        />
      </div>
    </div>
  );
}

// ===============================================================
// ANIMATED HERO TITLE — letter-by-letter spring animation
// Splits a title into animated spans with spring physics per letter.
// Falls back to plain h1 if Framer Motion isn't loaded.
// ===============================================================

function AnimatedHeroTitle({ plain, emphasis }) {
  if (!motion) {
    return (
      <h1 className="coaching-home__title">
        {plain} <em>{emphasis}</em>
      </h1>
    );
  }

  const renderWord = (word, wordIndex, baseDelay = 0) => (
    <span key={wordIndex} style={{ display: 'inline-block', marginRight: '0.28em' }}>
      {word.split('').map((letter, li) => (
        <motion.span
          key={`${wordIndex}-${li}`}
          initial={{ y: 56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            delay: baseDelay + wordIndex * 0.07 + li * 0.022,
            type: 'spring',
            stiffness: 150,
            damping: 25,
          }}
          style={{ display: 'inline-block' }}
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );

  const plainWords = plain.split(' ');
  const gooeyPhrases = ["Agentic AI.", "LangGraph.", "LLMOps.", "Autonomous Agents.", "Claude Code.", "Production RAG."];

  return (
    <h1 className="coaching-home__title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'block' }}
      >
        {plainWords.map((w, wi) => renderWord(w, wi, 0))}
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ display: 'block', height: '1.35em', position: 'relative' }}
      >
        <GooeyText 
          texts={gooeyPhrases} 
          morphTime={0.7} 
          cooldownTime={1} 
          className="gooey-text-outer" 
        />
      </motion.span>
    </h1>
  );
}



// ===============================================================
// ===============================================================
// TESTIMONIALS — Outcomes-focused grid showing 4 strongest testimonials.
// ===============================================================

const TESTIMONIALS_DATA = [
  {
    text: "Balaji's masterclass completely changed how I approach AI systems. I went from writing scripts to shipping multi-agent pipelines in production within 6 weeks.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Rahul Mehta",
    role: "Senior Engineer · Swiggy",
  },
  {
    text: "The Claude Code module alone was worth the entire fee. I've since automated 40% of my team's code review process.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Sneha Iyer",
    role: "Engineering Lead · Razorpay",
  },
  {
    text: "I attended live and got my first agentic AI feature shipped to production 3 weeks later. The ROI was immediate and my manager noticed.",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    name: "Ananya Gupta",
    role: "Product Manager · CRED",
  },
  {
    text: "After this masterclass I landed a senior AI engineer role. The portfolio projects gave me something real and impressive to show interviewers.",
    image: "https://randomuser.me/api/portraits/women/33.jpg",
    name: "Divya Menon",
    role: "AI Engineer · Google",
  },
  {
    text: "The depth of the LLMOps and orchestration module is unmatched. We migrated our entire indexing pipeline to live multi-agent nodes.",
    image: "https://randomuser.me/api/portraits/men/45.jpg",
    name: "Kunal Sharma",
    role: "Software Engineer II · Microsoft",
  },
  {
    text: "The math and hands-on code examples for tool calling and semantic routing opened a whole new level of engineering capability for me.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Priya Patel",
    role: "Senior ML Researcher · Meta",
  },
  {
    text: "This is the gold standard for AI engineering. It cuts through the hype and focuses on production-grade systems, latency, and costs.",
    image: "https://randomuser.me/api/portraits/men/72.jpg",
    name: "Vikram Malhotra",
    role: "Engineering Manager · Stripe",
  },
  {
    text: "We built an autonomous customer operations agent in 2 weeks using the principles taught here. Customer CSAT increased by 18%.",
    image: "https://randomuser.me/api/portraits/women/54.jpg",
    name: "Aditi Rao",
    role: "Tech Lead · Coinbase",
  },
  {
    text: "High-performance agentic flows are hard. This course gave me the debugging tools, logging strategies, and evaluations I needed.",
    image: "https://randomuser.me/api/portraits/men/22.jpg",
    name: "Siddharth Nair",
    role: "Systems Engineer · Netflix",
  },
  {
    text: "The interactive sessions are worth every rupee. Learning how to build customizable GUI frames for agent pipelines was a game changer.",
    image: "https://randomuser.me/api/portraits/men/81.jpg",
    name: "Rohan Das",
    role: "Senior Frontend Architect · Uber",
  },
  {
    text: "I spent months trying to piece together tutorials online. Balaji connects everything into a single, cohesive, enterprise-ready system.",
    image: "https://randomuser.me/api/portraits/women/29.jpg",
    name: "Tanvi Joshi",
    role: "Deep Learning Engineer · Nvidia",
  },
  {
    text: "From designing custom prompt layers to mastering memory systems, the course covers everything an ambitious designer-engineer needs.",
    image: "https://randomuser.me/api/portraits/women/62.jpg",
    name: "Neha Deshmukh",
    role: "Product Designer · Adobe",
  },
  {
    text: "If you are a senior engineer wanting to stay relevant in the age of AI, this cohort is non-negotiable. Best professional training I've had.",
    image: "https://randomuser.me/api/portraits/men/19.jpg",
    name: "Abhishek Roy",
    role: "Senior Fullstack Developer · Atlassian",
  },
  {
    text: "We saved over $12,000 in monthly API tokens by implementing the dynamic router caching patterns from Phase 6.",
    image: "https://randomuser.me/api/portraits/men/51.jpg",
    name: "Manish Verma",
    role: "Solutions Architect · Amazon",
  },
  {
    text: "The testing and evaluation framework has become our team's standard template. Essential knowledge for shipping AI with confidence.",
    image: "https://randomuser.me/api/portraits/men/58.jpg",
    name: "Harish Sen",
    role: "Backend Tech Lead · Zomato",
  },
];

// ===============================================================
// 360° TESTIMONIAL ACCUMULATION & BLAST — Scroll-driven timeline.
// Highly cinematic Framer Motion sequence with trigonometric vectors.
// ===============================================================

function TestimonialCard({ item, index, total, scrollYProgress }) {
  // Trigonometric positioning and offset calculations using pure numeric pixel offsets
  const mathData = React.useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxDim = Math.max(w, h);

    let startX = 0;
    let startY = 0;
    let targetX = 0;
    let targetY = 0;
    let rotateOffset = 0;

    if (index === 0) {
      // The Lead Card starts offscreen at top-right
      startX = w * 1.0; 
      startY = -h * 1.0;
      targetX = 0;
      targetY = 0;
      rotateOffset = -5; // gentle natural center tilt
    } else {
      // Cards 2-15 compute a starting coordinate on a 360° radial circle outside the viewport boundaries
      const angle = (index / total) * Math.PI * 2;
      startX = Math.cos(angle) * maxDim * 1.25;
      startY = Math.sin(angle) * maxDim * 1.25;

      // Deterministic layout offsets to create an organic overlapping fan deck in the center
      targetX = ((index * 17) % 100) - 50; // -50px to 50px
      targetY = ((index * 31) % 80) - 40;  // -40px to 40px
      rotateOffset = ((index * 7) % 15) - 7.5; // -7.5deg to 7.5deg
    }

    const endX = startX * 2.2;
    const endY = startY * 2.2;

    return { startX, startY, targetX, targetY, endX, endY, rotateOffset };
  }, [index, total]);

  // Framer Motion transforms mapped strictly to the sequential timeline intervals
  let x, y, scale, rotate, opacity;

  // Cinematic high-speed motion blur effect on cards during the violent blast [0.75, 0.85]
  const cardFilter = useTransform(
    scrollYProgress,
    [0.00, 0.75, 0.85, 1.00],
    ["blur(0px)", "blur(0px)", "blur(12px)", "blur(12px)"]
  );

  if (index === 0) {
    // THE LEAD CARD TIMELINE:
    // - [0.00, 0.15]: Fly-in from top-right to center
    // - [0.15, 0.75]: Hold stationary in the center
    // - [0.75, 0.85]: Violent blast & spin backwards offscreen
    // - [0.85, 1.00]: Remain fully dispersed and invisible
    x = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [mathData.startX, mathData.targetX, mathData.targetX, mathData.endX, mathData.endX]
    );
    y = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [mathData.startY, mathData.targetY, mathData.targetY, mathData.endY, mathData.endY]
    );
    opacity = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [1, 1, 1, 0, 0]
    );
    rotate = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [15, mathData.rotateOffset, mathData.rotateOffset, mathData.rotateOffset - 180, mathData.rotateOffset - 180]
    );
    scale = useTransform(
      scrollYProgress,
      [0.00, 0.15, 0.75, 0.85, 1.00],
      [0.9, 1.05, 1.05, 0.5, 0.5]
    );
  } else {
    // ACCUMULATION CARDS 2-15 TIMELINE:
    // - Staggered entrance based on index between [0.10, 0.72] (further slowed down!)
    // - Hold stationary pile between [0.72, 0.75]
    // - Violent blast & high speed spin outward between [0.75, 0.85]
    // - Remain invisible [0.85, 1.00]
    const t1 = 0.10 + ((index - 1) / (total - 1)) * 0.42; // Stagger starts spread over [0.10, 0.52]
    const t2 = t1 + 0.20; // Glide in slowly over 0.20 scroll depth (all home by 0.72)

    const spinAmt = index % 2 === 0 ? 240 : -240; // High speed rotation spin amount!

    x = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.startX, mathData.startX, mathData.targetX, mathData.targetX, mathData.endX, mathData.endX]
    );
    y = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.startY, mathData.startY, mathData.targetY, mathData.targetY, mathData.endY, mathData.endY]
    );
    opacity = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [0, 0, 1, 1, 0, 0]
    );
    rotate = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [mathData.rotateOffset + 35, mathData.rotateOffset + 35, mathData.rotateOffset, mathData.rotateOffset, mathData.rotateOffset + spinAmt, mathData.rotateOffset + spinAmt]
    );
    scale = useTransform(
      scrollYProgress,
      [0.00, t1, t2, 0.75, 0.85, 1.00],
      [0.6, 0.6, 1.0, 1.0, 0.5, 0.5]
    );
  }

  return (
    <motion.div
      style={{
        x,
        y,
        scale,
        rotate,
        opacity,
        filter: cardFilter,
        willChange: "transform, opacity, filter",
        position: "absolute",
        zIndex: index + 10
      }}
      className="testimonial-blast-card"
    >
      <div className="testimonial-blast-card__header">
        <span className="testimonial-blast-card__tag">
          0{index + 1} — Outcomes
        </span>
        <span className="testimonial-blast-card__verified">
          Verified
        </span>
      </div>

      <div className="testimonial-blast-card__quote-container">
        <blockquote className="testimonial-blast-card__quote">
          “{item.text}”
        </blockquote>
      </div>

      <div className="testimonial-blast-card__footer">
        <div className="testimonial-blast-card__user">
          <img
            src={item.image}
            alt={item.name}
            className="testimonial-blast-card__avatar"
            loading="lazy"
            decoding="async"
          />
          <div className="testimonial-blast-card__meta">
            <div className="testimonial-blast-card__name">{item.name}</div>
            <div className="testimonial-blast-card__role">{item.role}</div>
          </div>
        </div>
        <div className="testimonial-blast-card__brand">
          AE // 2026
        </div>
      </div>
    </motion.div>
  );
}

function TestimonialBlast({ testimonials }) {
  const containerRef = useRef(null);

  // Hook scroll progress over the 400vh container target
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Layer 1: Background Motivational Quote Transform (pop up from the middle right as all testimonials blow up)
  const bgOpacity = useTransform(scrollYProgress, [0.75, 0.88], [0, 1]);
  const bgScale = useTransform(scrollYProgress, [0.75, 0.88], [0.4, 1]);
  const bgFilter = useTransform(scrollYProgress, [0.75, 0.88], ["blur(12px)", "blur(0px)"]);

  return (
    <div
      ref={containerRef}
      className="testimonial-blast-container"
    >
      <div className="testimonial-blast-sticky">
        
        {/* LAYER 1: Background Motivational Quote */}
        <motion.div
          style={{
            opacity: bgOpacity,
            scale: bgScale,
            filter: bgFilter,
            zIndex: 0,
            willChange: "transform, opacity, filter",
            position: "absolute"
          }}
          className="testimonial-blast__bg-quote-wrapper"
        >
          <div className="testimonial-blast__glow" />
          <span className="testimonial-blast__bg-quote-quote">“</span>
          <h2 className="testimonial-blast__bg-quote">
            The future belongs to those who build it.<br />Master Agentic AI and command the new frontier.
          </h2>
          <span className="testimonial-blast__bg-quote-quote">”</span>
        </motion.div>

        {/* LAYER 2: The 360° Testimonial Build-Up & Blast */}
        <div className="testimonial-blast-foreground">
          {testimonials.map((t, index) => (
            <TestimonialCard
              key={index}
              item={t}
              index={index}
              total={testimonials.length}
              scrollYProgress={scrollYProgress}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

function TestimonialsSection() {
  return (
    <section className="tmc-section" style={{ padding: '80px 0 0', position: 'relative' }}>
      <div className="tmc-header" style={{ padding: '0 4vw', marginBottom: '20px', textAlign: 'center' }}>
        <div className="tmc-tag">Student Testimonials</div>
        <h2 className="tmc-title">What our students say</h2>
        <p className="tmc-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
          Real engineers, real results. Scroll down to see our network of global graduates.
        </p>
      </div>

      <TestimonialBlast testimonials={TESTIMONIALS_DATA} />

      {/* Bottom Centered CTA */}
      <RevealOnScroll delay={0.2}>
        <div style={{ textAlign: 'center', marginTop: '60px', paddingBottom: '40px' }}>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            Ready to join them?
          </p>
          <button
            className="hero__primary-cta"
            onClick={() => {
              if (nextMcReserved) {
                goToAccount();
              } else if (nextMasterclass) {
                openBooking(nextMasterclass);
              } else {
                const el = document.getElementById('masterclasses');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            {nextMcReserved
              ? 'You\u2019re registered ✓ · View'
              : (nextMasterclass ? (isMcFree(nextMasterclass) ? <>Reserve seat · <V2McPrice mc={nextMasterclass} /> →</> : 'Book my seat →') : 'See upcoming classes →')}
          </button>
        </div>
      </RevealOnScroll>
    </section>
  );
}


// ===============================================================
// SPLIT-PANE SYLLABUS VIEWER COMPONENT
// Renders structured masterclass syllabus from Firestore schema
// ===============================================================

function SplitPaneSyllabus({ syllabus }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!syllabus || syllabus.length === 0) return null;
  const currentTopic = syllabus[activeIdx] || syllabus[0];

  return (
    <div className="split-pane">
      {/* Left pane: topic navigation */}
      <nav className="split-pane__left" aria-label="Syllabus topics">
        {syllabus.map((item, idx) => (
          <button
            key={item.index || idx}
            className={`split-pane__item${activeIdx === idx ? ' split-pane__item--active' : ''}`}
            onClick={() => setActiveIdx(idx)}
            aria-pressed={activeIdx === idx}
          >
            <span className="split-pane__item-index">{item.index}</span>
            <span className="split-pane__item-title">{item.topicTitle}</span>
          </button>
        ))}
      </nav>

      {/* Right pane: topic detail */}
      <div className="split-pane__right">
        <div className="split-pane__module-label">Module {activeIdx + 1} of {syllabus.length}</div>
        <h3 className="split-pane__topic-title">{currentTopic.topicTitle}</h3>
        <ul className="split-pane__subtopics">
          {(currentTopic.subTopics || []).map((sub, i) => (
            <li
              key={i}
              className="split-pane__subtopic"
              style={{ animationDelay: `${i * 0.045}s` }}
            >
              <span className="split-pane__subtopic-badge">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="split-pane__subtopic-text">{sub}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


// ===============================================================
// ADMIN — Schedule/Edit Masterclass panel (left column of the
// dashboard grid). Owns all form + zoom-link state locally so
// typing here never re-renders DashboardView (see CLAUDE.md).
// Remounted via key when the edit target changes, so field values
// are derived from props in the useState initializers.
// ===============================================================
function ScheduleMasterclassPanel({ editSessionId, editSessionIsMc, sessions, masterclasses, sessionsWithRegs, combinedClasses, onCancelEdit }) {
  // Resolve the session being edited (if any) once per mount.
  const initSession = (() => {
    if (!editSessionId) return null;
    let session = editSessionIsMc
      ? masterclasses.find(m => m.id === editSessionId)
      : sessions.find(s => s.id === editSessionId);
    // If not found in Firestore lists, check if it's the featured config masterclass
    if (!session && V2_CONFIG_MASTERCLASS && editSessionId === V2_CONFIG_MASTERCLASS.id) {
      session = {
        title: V2_CONFIG_MASTERCLASS.title,
        price: V2_CONFIG_MASTERCLASS.price,
        originalPrice: V2_CONFIG_MASTERCLASS.originalPrice,
        dateTime: V2_CONFIG_MASTERCLASS.dateTime,
        description: V2_CONFIG_MASTERCLASS.about || V2_CONFIG_MASTERCLASS.subtitle || "",
        videoUrl: V2_CONFIG_MASTERCLASS.videoUrl || "",
      };
    }
    return session || null;
  })();

  // format to datetime-local expected string 'YYYY-MM-DDTHH:MM'
  const initDateTime = (() => {
    if (!initSession || !initSession.dateTime) return "";
    try {
      const dateObj = new Date(initSession.dateTime);
      if (isNaN(dateObj.getTime())) return "";
      const tzoffset = dateObj.getTimezoneOffset() * 60000; //offset in milliseconds
      return (new Date(dateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
    } catch (e) { return ""; }
  })();

  const [title, setTitle] = useState(initSession ? (initSession.title || "") : "");
  const [description, setDescription] = useState(initSession ? (initSession.description || initSession.rawSyllabus || "") : "");
  const [price, setPrice] = useState(initSession && initSession.price !== undefined ? initSession.price : "");            // "Offering Price" — 0 = Free
  const [originalPrice, setOriginalPrice] = useState(initSession && initSession.originalPrice !== undefined ? initSession.originalPrice : "");
  const [dateTime, setDateTime] = useState(initDateTime);
  const [instructor, setInstructor] = useState((initSession && initSession.instructor) || "Balaji Chippada");
  const [videoUrl, setVideoUrl] = useState(initSession ? (initSession.videoUrl || initSession.youtubeVideoId || initSession.videoId || "") : "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Zoom-link manager (per-masterclass): input value, busy + result message keyed by sessionId.
  const [zoomInputs, setZoomInputs] = useState({});
  const [zoomBusy, setZoomBusy] = useState({});
  const [zoomMsg, setZoomMsg] = useState({});
  // Optional "edit the email before sending" editor for the zoom-link email.
  const [zoomEditOpen, setZoomEditOpen] = useState(false);
  const [zoomSubject, setZoomSubject] = useState("");
  const [zoomBody, setZoomBody] = useState("");

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!db) {
      setStatus({ type: "error", message: "Firestore database not loaded." });
      return;
    }

    // NB: a free masterclass has price 0 — don't treat 0 as "missing" (!0 === true).
    const priceEmpty = price === "" || price === null || price === undefined;
    if (!title || !description || priceEmpty || !dateTime) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error("Offering price must be a valid non-negative number.");
      }

      // "Actual Price" is optional — empty means "no anchor" (stored as 0, so
      // nothing is struck through). When set it must be a non-negative number.
      const originalPriceEmpty = originalPrice === "" || originalPrice === null || originalPrice === undefined;
      const originalPriceNum = originalPriceEmpty ? 0 : parseFloat(originalPrice);
      if (isNaN(originalPriceNum) || originalPriceNum < 0) {
        throw new Error("Actual price must be a valid non-negative number.");
      }

      // Convert date to generic ISO string format
      const formattedDate = new Date(dateTime).toISOString();

      if (editSessionId) {
        // Mode: Update Existing Session
        const targetCollection = editSessionIsMc ? "masterclasses" : "sessions";
        const updatePayload = {
          title,
          price: priceNum,
          originalPrice: originalPriceNum,
          dateTime: formattedDate,
          instructor,
          videoUrl: videoUrl.trim()
        };
        if (editSessionIsMc) {
          updatePayload.rawSyllabus = description;
        } else {
          updatePayload.description = description;
        }

        const docRef = db.collection(targetCollection).doc(editSessionId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          updatePayload.deleted = false;
          updatePayload.status = "active";
          updatePayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          if (editSessionIsMc && V2_CONFIG_MASTERCLASS) {
            updatePayload.syllabus = V2_CONFIG_MASTERCLASS.curriculum ? V2_CONFIG_MASTERCLASS.curriculum.map((c, idx) => ({
              index: `1.${idx + 1}`,
              topicTitle: c.title,
              subTopics: c.points
            })) : [];
          }
          await docRef.set(updatePayload);
        } else {
          // If it exists, make sure we mark it as active / not deleted
          updatePayload.deleted = false;
          updatePayload.status = "active";
          await docRef.update(updatePayload);
        }

        setStatus({ type: "success", message: `${editSessionIsMc ? "AI Masterclass" : "Session"} updated successfully!` });
      } else {
        // Mode: Create New Session
        await db.collection("sessions").add({
          title,
          description,
          price: priceNum,
          originalPrice: originalPriceNum,
          dateTime: formattedDate,
          instructor,
          videoUrl: videoUrl.trim(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setStatus({ type: "success", message: "New Masterclass scheduled successfully!" });

        // Reset form
        setTitle("");
        setDescription("");
        setPrice("");
        setOriginalPrice("");
        setDateTime("");
        setVideoUrl("");
      }
    } catch (err) {
      // Surface the raw error to the console so the exact Firestore/permission
      // reason is visible when debugging a failed save.
      console.error("Masterclass save failed:", err);
      setStatus({ type: "error", message: (err && err.message) || "Failed to commit session to database." });
    } finally {
      setLoading(false);
    }
  };

  const buildDefaultZoomEmail = (mcTitle, mcDateTime, zoomLink) => {
    const when = (typeof formatMcFullDateTime === 'function' && mcDateTime)
      ? formatMcFullDateTime(mcDateTime)
      : (mcDateTime ? new Date(mcDateTime).toLocaleString('en-IN') : 'TBA');
    return {
      subject: `Your Zoom link for ${mcTitle || 'the masterclass'} 🔗`,
      body: `Hi {{name}},\n\n` +
        `Here's your private Zoom joining link for ${mcTitle || 'the masterclass'}:\n\n` +
        `Class: ${mcTitle || 'Masterclass'}\n` +
        `Date & Time: ${when}\n` +
        `Zoom link: ${zoomLink || '<add the link above>'}\n\n` +
        `Save this email — we'll also send you a reminder on each of the 2 days before the session.\n\n` +
        `See you live,\nBalaji Chippada Masterclass\nteam@balajichippada.com`,
    };
  };

  const handleSendZoom = async (sessionId, registeredCount) => {
    const zoomLink = (zoomInputs[sessionId] || '').trim();
    if (!zoomLink) {
      setZoomMsg(m => ({ ...m, [sessionId]: '⚠️ Enter a Zoom link first.' }));
      return;
    }
    if (registeredCount > 0 && !window.confirm(`Email this Zoom link to ${registeredCount} registered student(s) now?`)) return;
    setZoomBusy(b => ({ ...b, [sessionId]: true }));
    setZoomMsg(m => ({ ...m, [sessionId]: '' }));
    try {
      const call = functions.httpsCallable('sendZoomLinkToRegistrants');
      // Include the edited subject/body when the editor is open and filled.
      const payload = { sessionId, zoomLink };
      if (zoomEditOpen && zoomBody.trim()) {
        payload.customSubject = zoomSubject.trim();
        payload.customBody = zoomBody;
      }
      const res = await call(payload);
      const d = (res && res.data) || {};
      setZoomMsg(m => ({
        ...m,
        [sessionId]: d.queued > 0
          ? `✓ Saved. Queued ${d.queued} email(s) — they'll send in the background over the next few minutes.`
          : (d.message || '✓ Saved.'),
      }));
    } catch (err) {
      setZoomMsg(m => ({ ...m, [sessionId]: `⚠️ ${err.message || 'Failed to send.'}` }));
    } finally {
      setZoomBusy(b => ({ ...b, [sessionId]: false }));
    }
  };

  return (
    <div className="dashboard__panel">
      <h2 className="dashboard__panel-title">
        {editSessionId ? "✎ Edit Masterclass" : "＋ Schedule New Masterclass"}
      </h2>

      <form onSubmit={handleFormSubmit}>
        <div className="form-group">
          <label className="form-label">Session Name / Title *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. LangGraph Multi-Agent RAG Bootcamp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description & Syllabus *</label>
          <textarea
            className="form-input form-textarea"
            placeholder="What will students learn in this session? Break it down..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Instructor Name</label>
          <input
            type="text"
            className="form-input"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label">Actual Price (INR)</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 999"
              min="0"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
            />
            <small style={{ color: "var(--fg-faint)", fontSize: "11px" }}>Shown struck-through on the homepage.</small>
          </div>

          <div className="form-group">
            <label className="form-label">Offering Price (INR) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 499 (or 0 for Free)"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <small style={{ color: "var(--fg-faint)", fontSize: "11px" }}>What attendees pay. 0 shows as “Free”.</small>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Date & Time *</label>
          <input
            type="datetime-local"
            className="form-input"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Promo Video (YouTube URL or ID)</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. https://www.youtube.com/watch?v=Eze6D8jAMjI"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>

        {status.message && (
          <div className={`status-box status-box--${status.type}`} style={{ marginBottom: "12px" }}>
            <span>{status.type === 'success' ? '✔' : '⚠'}</span>
            <span>{status.message}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="submit" className="form-btn" disabled={loading} style={{ flex: 1 }}>
            {loading ? "Saving…" : editSessionId ? "Save Changes" : "Publish Masterclass"}
          </button>
          {editSessionId && (
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
                padding: "12px 16px",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                color: "var(--fg-dim)",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ── Zoom Link & Reminders — scoped to the masterclass being edited ── */}
      {editSessionId && (() => {
        const regEntry = sessionsWithRegs.find(x => x.sessionId === editSessionId);
        const registered = regEntry ? regEntry.registered : 0;
        const currentZoom = (combinedClasses.find(c => c.id === editSessionId) || {}).zoomLink || (regEntry && regEntry.zoomLink) || '';
        return (
          <div style={{ marginTop: "22px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              Zoom Link &amp; Reminders
            </label>
            <p style={{ fontSize: "12px", color: "var(--fg-faint)", margin: "4px 0 10px" }}>
              Saving emails this link (with a calendar invite) to {registered} registered student(s) now, and auto-includes it for anyone who registers afterwards. Daily reminders go out automatically on the 2 days before the session.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="url"
                className="form-input"
                placeholder="https://zoom.us/j/…"
                value={zoomInputs[editSessionId] ?? currentZoom}
                onChange={e => setZoomInputs(v => ({ ...v, [editSessionId]: e.target.value }))}
                style={{ flex: 1, minWidth: "220px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
              />
              <button
                type="button"
                className="form-btn"
                disabled={zoomBusy[editSessionId]}
                onClick={() => handleSendZoom(editSessionId, registered)}
                style={{ whiteSpace: "nowrap" }}
              >
                {zoomBusy[editSessionId] ? "Sending…" : `Save & email ${registered}`}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (zoomEditOpen) { setZoomEditOpen(false); return; }
                const z = (zoomInputs[editSessionId] ?? currentZoom) || '';
                const def = buildDefaultZoomEmail(title, dateTime, z);
                setZoomSubject(def.subject);
                setZoomBody(def.body);
                setZoomEditOpen(true);
              }}
              style={{ marginTop: "10px", background: "none", border: "none", color: "var(--c-rust)", cursor: "pointer", fontSize: "12px", padding: 0 }}
            >
              {zoomEditOpen ? "↩ Use the default email" : "✎ Edit email before sending"}
            </button>

            {zoomEditOpen && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  className="form-input"
                  value={zoomSubject}
                  onChange={e => setZoomSubject(e.target.value)}
                  placeholder="Email subject"
                  style={{ fontSize: "13px" }}
                />
                <textarea
                  className="form-input form-textarea"
                  rows={12}
                  value={zoomBody}
                  onChange={e => setZoomBody(e.target.value)}
                  style={{ fontSize: "13px", lineHeight: 1.6, fontFamily: "'Inter Tight', sans-serif", minHeight: "220px" }}
                />
                <div style={{ fontSize: "11px", color: "var(--fg-faint)" }}>
                  <code>{'{{name}}'}</code> is replaced with each student&apos;s name. A calendar invite (.ics) is attached automatically.
                  <button
                    type="button"
                    onClick={() => {
                      const z = (zoomInputs[editSessionId] ?? currentZoom) || '';
                      const def = buildDefaultZoomEmail(title, dateTime, z);
                      setZoomSubject(def.subject);
                      setZoomBody(def.body);
                    }}
                    style={{ marginLeft: "8px", background: "none", border: "none", color: "var(--c-rust)", cursor: "pointer", fontSize: "11px", padding: 0 }}
                  >
                    ↺ Reset to default
                  </button>
                </div>
              </div>
            )}
            {zoomMsg[editSessionId] && (
              <div style={{
                fontSize: "12px", marginTop: "8px",
                color: zoomMsg[editSessionId].startsWith('⚠') ? "var(--c-rust)" : "var(--c-emerald)"
              }}>
                {zoomMsg[editSessionId]}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

ScheduleMasterclassPanel = React.memo(ScheduleMasterclassPanel);

// ===============================================================
// ADMIN — Marketing email broadcast modal. Owns subject/body/
// template/sending state locally so typing here never re-renders
// DashboardView. Mounted fresh each time the modal opens.
// ===============================================================
const CAMPAIGN_TEMPLATES = {
  general: {
    subject: "Exclusive Masterclass Invite: Command the AI Engineering Frontier",
    body: `Hello,\n\nI wanted to reach out and invite you to our upcoming live Masterclasses at The Agent Engineer. \n\nWhether you're just starting or looking to ship production-scale multi-agent systems, our curriculum covers the exact skills demanded by elite engineering teams today.\n\nCheck out our interactive syllabus and reserve your seat here:\nhttps://balajichippada.com/\n\nBest regards,\nBalaji Chippada\nTutor & AI Architect, The Agent Engineer`
  },
  cold_leads: {
    subject: "Unlock Your Career Transition: Special AI Coach Registration Offer",
    body: `Hello,\n\nI noticed you created an account on our AI Engineer Roadmap platform but haven't reserved your seat for an upcoming cohort yet.\n\nTo help you kickstart your journey, I'm offering an exclusive free entry / special seat reservation to our next live session. Command the tools, LangGraph orchestrations, and LLMOps that are reshaping technology.\n\nSee what's coming up and secure your access:\nhttps://balajichippada.com/\n\nTo your success,\nBalaji Chippada`
  },
  abandoned: {
    subject: "Finish Setting Up Your Seat: LangGraph & Agentic AI Masterclass",
    body: `Hi there,\n\nIt looks like you started booking a seat for our upcoming Masterclass but didn't complete the reservation. \n\nSeats in our live cohorts are strictly limited to ensure personal feedback and high-quality coaching for every student. I'd love to help you cross the finish line and master production-grade RAG and agentic tools.\n\nResume your registration and secure your seat here:\nhttps://balajichippada.com/\n\nIf you ran into any payment issues or have questions, just reply directly to this email!\n\nBest,\nBalaji Chippada`
  },
  professional: {
    subject: "Enterprise LLMOps & LangGraph: Advanced Masterclasses for Pros",
    body: `Hello,\n\nAs a working professional on our platform, you understand the speed at which AI engineering is moving. Simply prompting models is no longer enough — the industry is hiring engineers who can build robust, cost-effective, multi-agent frameworks with strict guardrails.\n\nOur upcoming sessions focus on advanced enterprise orchestration, custom Tool/MCP pipelines, and multi-agent LangGraph architectures.\n\nExplore our professional cohort curriculum:\nhttps://balajichippada.com/\n\nBest regards,\nBalaji Chippada`
  }
};

function BroadcastModal({ list, segmentName, onClose }) {
  const defaultKey = (() => {
    if (segmentName === "Cold Leads") return "cold_leads";
    if (segmentName === "Abandoned Checkouts" || segmentName === "Abandoned Checkout") return "abandoned";
    if (segmentName === "Working Professionals") return "professional";
    return "general";
  })();
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(defaultKey);
  const [broadcastSubject, setBroadcastSubject] = useState(CAMPAIGN_TEMPLATES[defaultKey].subject);
  const [broadcastBody, setBroadcastBody] = useState(CAMPAIGN_TEMPLATES[defaultKey].body);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [broadcastCampaignId, setBroadcastCampaignId] = useState("");
  const [broadcastIsMock, setBroadcastIsMock] = useState(false);

  const handleTemplateChange = (key) => {
    setSelectedTemplateKey(key);
    if (CAMPAIGN_TEMPLATES[key]) {
      setBroadcastSubject(CAMPAIGN_TEMPLATES[key].subject);
      setBroadcastBody(CAMPAIGN_TEMPLATES[key].body);
    }
  };

  const handleLaunchBroadcast = async () => {
    const emails = Array.from(new Set(
      list
        .map(u => (u.email || u.studentEmail || '').toLowerCase().trim())
        .filter(Boolean)
    ));

    if (emails.length === 0) {
      setBroadcastError("No valid recipient email addresses found.");
      return;
    }

    setIsSendingBroadcast(true);
    setBroadcastError("");
    setBroadcastSuccess("");
    setBroadcastCampaignId("");
    setBroadcastIsMock(false);

    try {
      if (!functions) {
        throw new Error("Firebase functions service is not initialized on this platform.");
      }

      const sendEmailCall = functions.httpsCallable("sendAudienceEmail");
      const response = await sendEmailCall({
        emails: emails,
        subject: broadcastSubject,
        body: broadcastBody,
        segmentName: segmentName
      });

      const result = response.data;
      if (result && result.success) {
        setBroadcastSuccess(result.message || "Audience broadcast dispatched successfully.");
        setBroadcastCampaignId(result.campaignId || "");
        setBroadcastIsMock(!!result.isMock);
      } else {
        throw new Error("An unexpected error occurred: response did not indicate success.");
      }
    } catch (err) {
      console.warn("Direct programmatic email dispatch failed, executing client-side fallback:", err);

      try {
        const currentUser = auth ? auth.currentUser : null;
        let callerName = "Admin Staff";
        if (currentUser && db) {
          try {
            const userDoc = await db.collection("users").doc(currentUser.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              callerName = userData.name || userData.email || currentUser.uid;
            } else {
              callerName = currentUser.email || currentUser.uid;
            }
          } catch (uErr) {
            console.error("Failed to load user document details:", uErr);
            callerName = currentUser.email || currentUser.uid;
          }
        }

        let campaignDocId = "";
        if (db) {
          const campaignDocRef = await db.collection("email_campaigns").add({
            segmentName: segmentName || "Custom Audience",
            subject: broadcastSubject,
            body: broadcastBody,
            recipientCount: emails.length,
            senderEmail: currentUser ? currentUser.email : "simulated-sender@theagentengineer.app",
            status: "completed_via_client",
            isMock: false,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            sentBy: callerName,
            sparkPlanFallback: true
          });
          campaignDocId = campaignDocRef.id;
        }

        // Prefill subject/body and bcc in the native client
        const subjectEsc = encodeURIComponent(broadcastSubject);
        const bodyEsc = encodeURIComponent(broadcastBody);
        const bccEsc = encodeURIComponent(emails.join(","));
        const mailtoUrl = `mailto:?bcc=${bccEsc}&subject=${subjectEsc}&body=${bodyEsc}`;
        window.open(mailtoUrl, '_blank');

        setBroadcastSuccess(
          campaignDocId
            ? `Audience campaign logged under ID ${campaignDocId}! Since this project's production backend is running on the Firebase Spark Plan, your default mail client has been opened to send the emails securely.`
            : `Audience campaign generated successfully! Your default mail client has been opened to send the emails securely.`
        );
        if (campaignDocId) {
          setBroadcastCampaignId(campaignDocId);
        }
        setBroadcastIsMock(false);
      } catch (fallbackErr) {
        console.error("Critical fallback failure:", fallbackErr);
        setBroadcastError(`Failed to send broadcast: ${err.message || err}. (Fallback error: ${fallbackErr.message || fallbackErr})`);
      }
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 300 }}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ width: "min(640px, 100%)" }}>
        <button className="modal-close" onClick={onClose} disabled={isSendingBroadcast}>×</button>
        <h2 className="modal-title">Send <em>Email Broadcast</em></h2>

        {broadcastSuccess ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px", color: "var(--c-emerald)", lineHeight: 1 }}>✓</div>
            <h3 className="modal-title" style={{ color: "var(--c-emerald)", fontSize: "20px", marginBottom: "10px" }}>Broadcast Successfully Launched!</h3>
            <p className="modal-desc" style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--fg)", marginBottom: "20px" }}>
              {broadcastSuccess}
            </p>
            {broadcastCampaignId && (
              <div style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--line-strong)",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "20px",
                fontFamily: "monospace",
                fontSize: "12px",
                textAlign: "left",
                wordBreak: "break-all"
              }}>
                <div style={{ marginBottom: "6px" }}><b style={{ color: "var(--fg-dim)" }}>Campaign ID:</b> <span style={{ color: "var(--c-rust)" }}>{broadcastCampaignId}</span></div>
                <div style={{ marginBottom: "6px" }}><b style={{ color: "var(--fg-dim)" }}>Recipient Count:</b> {list.length} leads</div>
                <div><b style={{ color: "var(--fg-dim)" }}>Mode:</b> {broadcastIsMock ? "Simulated / Mock (No SMTP Keys)" : "Real SMTP Delivery"}</div>
              </div>
            )}
            {broadcastIsMock && (
              <div style={{
                background: "rgba(235, 94, 40, 0.1)",
                border: "1px solid rgba(235, 94, 40, 0.25)",
                color: "var(--c-rust)",
                borderRadius: "8px",
                padding: "12px",
                marginTop: "16px",
                fontSize: "13px",
                lineHeight: "1.4",
                textAlign: "left"
              }}>
                <b>Note:</b> SMTP credentials are not yet configured in your Firebase functions environment. The campaign has been captured successfully in the <code>/email_campaigns</code> Firestore database, and mock logs have been printed in the server logs.
              </div>
            )}
            <div style={{ marginTop: "30px" }}>
              <button
                type="button"
                className="form-btn form-btn--accent"
                onClick={onClose}
                style={{ background: "var(--c-emerald)", margin: "0 auto", padding: "12px 40px", width: "auto" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="modal-desc" style={{ marginBottom: "20px" }}>
              Launch a direct, programmatic email broadcast to <b>{list.length} leads</b> in the <b>"{segmentName}"</b> segment. All leads are automatically BCC'd to protect student privacy.
            </p>

            {broadcastError && (
              <div style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
                color: "var(--c-rose)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "20px",
                fontSize: "13px",
                lineHeight: "1.4"
              }}>
                ❌ <b>Error:</b> {broadcastError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Select Campaign Template</label>
              <select
                className="form-select"
                value={selectedTemplateKey}
                onChange={e => handleTemplateChange(e.target.value)}
                disabled={isSendingBroadcast}
              >
                <option value="general">Masterclass Invite (General / All Leads)</option>
                <option value="cold_leads">Special Registration Offer (Cold Leads)</option>
                <option value="abandoned">Checkout Cart Abandonment (Retargeting)</option>
                <option value="professional">Enterprise LLMOps Upsell (Working Professionals)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subject Line</label>
              <input
                type="text"
                className="form-input"
                value={broadcastSubject}
                onChange={e => setBroadcastSubject(e.target.value)}
                required
                disabled={isSendingBroadcast}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Body (Plain Text)</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: "220px", fontFamily: "inherit", fontSize: "14px" }}
                value={broadcastBody}
                onChange={e => setBroadcastBody(e.target.value)}
                required
                disabled={isSendingBroadcast}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                type="button"
                className="form-btn form-btn--accent"
                onClick={handleLaunchBroadcast}
                disabled={isSendingBroadcast}
                style={{
                  background: isSendingBroadcast ? "var(--bg-faint)" : "var(--c-rust)",
                  margin: 0,
                  flex: 2,
                  cursor: isSendingBroadcast ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {isSendingBroadcast ? (
                  <>
                    <span className="ai-status__spinner"></span>
                    Sending Broadcast...
                  </>
                ) : (
                  <>Send Direct Broadcast</>
                )}
              </button>
              <button
                type="button"
                className="dashboard__logout-btn"
                onClick={onClose}
                disabled={isSendingBroadcast}
                style={{ margin: 0, flex: 1, padding: "14px", cursor: isSendingBroadcast ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
            </div>
            <div style={{ fontSize: "12px", color: "var(--fg-faint)", marginTop: "14px", textAlign: "center", lineHeight: "1.4" }}>
              <b>How it works:</b> Emails are delivered programmatically in the background directly from the admin email address (via SMTP) using a secure Firebase Cloud Function. Student privacy is fully protected since all emails are hidden via unified BCC dispatch!
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===============================================================
// ADMIN — Saved contacts table (Marketing). Owns the search box
// locally so typing in it never re-renders DashboardView; memoized
// so dashboard re-renders skip the (up to 1,000-row) table.
// ===============================================================
const SavedContactsTable = React.memo(function SavedContactsTable({ savedContacts, onRemove }) {
  const [savedSearch, setSavedSearch] = useState("");
  return (
    <React.Fragment>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", color: "var(--fg-dim)" }}><b style={{ color: "var(--c-emerald)" }}>{savedContacts.length}</b> saved contact{savedContacts.length === 1 ? "" : "s"}</span>
        <input className="form-input" style={{ maxWidth: "240px", padding: "8px 12px" }} placeholder="Search name / email…" value={savedSearch} onChange={(e) => setSavedSearch(e.target.value)} />
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Name", "Email", "Phone", "Source", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", color: "var(--fg-faint)", fontWeight: 600, position: "sticky", top: 0, background: "var(--bg-elev)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {savedContacts
                .filter((c) => { const q = savedSearch.trim().toLowerCase(); if (!q) return true; return (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q); })
                .slice(0, 1000)
                .map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--fg)" }}>{c.name || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--fg-dim)", fontFamily: "JetBrains Mono" }}>{c.email}</td>
                    <td style={{ padding: "10px 14px", color: "var(--fg-dim)", fontFamily: "JetBrains Mono" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--fg-faint)", fontSize: "12px" }}>{c.source || "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button type="button" onClick={() => onRemove(c.id)} title="Remove contact" style={{ background: "transparent", border: "none", color: "var(--fg-faint)", cursor: "pointer", fontSize: "14px" }}>✕</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </React.Fragment>
  );
});


// ===============================================================
// DASHBOARD — workspace tab rail. The dashboard used to be one
// ~5,300px scroll of stacked panels with an anchor-link nav; each
// job (classes, video content, audience, enquiries) now gets its
// own workspace and the rail doubles as a live status readout —
// every tab carries its own count, so the state of the business is
// legible without entering a single section.
// ===============================================================
const DASH_SECTIONS = [
  { id: 'overview',  label: 'Overview',      adminOnly: false },
  { id: 'classes',   label: 'Masterclasses', adminOnly: false },
  { id: 'videos',    label: 'Videos',        adminOnly: true  },
  { id: 'audience',  label: 'Audience',      adminOnly: true  },
  { id: 'enquiries', label: 'Enquiries',     adminOnly: true  },
];

// Live doc count for a collection, rendered as a mono chip in the
// tab rail. Own component so the count updating never re-renders
// DashboardView (see the re-render warning in CLAUDE.md).
function DashCount({ collection, where }) {
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!db) return;
    let q = db.collection(collection);
    if (where) q = q.where(where[0], where[1], where[2]);
    const unsub = q.onSnapshot((snap) => setCount(snap.size), () => {});
    return () => unsub();
  }, [collection]);
  if (count == null || count === 0) return null;
  return <span className="dash-tab__count">{count}</span>;
}
DashCount = React.memo(DashCount);

function DashboardTabs({ active, onChange, isAdmin, classCount, leadCount }) {
  const tabs = DASH_SECTIONS.filter((t) => isAdmin || !t.adminOnly);
  return (
    <nav className="dashboard__nav" aria-label="Dashboard sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`dash-tab${active === t.id ? ' is-active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.id === 'classes' && classCount > 0 && <span className="dash-tab__count">{classCount}</span>}
          {t.id === 'videos' && <DashCount collection="roadmapVideos" />}
          {t.id === 'audience' && leadCount > 0 && <span className="dash-tab__count">{leadCount}</span>}
          {t.id === 'enquiries' && <DashCount collection="leads" where={['source', '==', 'course_enquiry']} />}
        </button>
      ))}
    </nav>
  );
}
DashboardTabs = React.memo(DashboardTabs);

// Every business number in one readout. These used to be split
// across two panels 1,200px apart (seats/revenue inside the
// schedule grid, leads/conversion inside Marketing) — which is why
// the dashboard never answered "how are we doing?" at a glance.
function DashStat({ label, value, sub, accent }) {
  return (
    <div className="dash-stat" style={accent ? { '--stat-accent': accent } : undefined}>
      <div className="dash-stat__label">{label}</div>
      <div className="dash-stat__value">{value}</div>
      {sub && <div className="dash-stat__sub">{sub}</div>}
    </div>
  );
}


// ===============================================================
// STAFF / ADMIN DASHBOARD TAB VIEW
// ===============================================================

function DashboardView({ user, role, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  // Schedule/Edit form fields + zoom-link manager live in
  // ScheduleMasterclassPanel (local state) so typing there never
  // re-renders this whole component.
  // Which workspace is showing. The dashboard is five focused
  // screens, not one long scroll — see DashboardTabs above.
  const [dashSection, setDashSection] = useState('overview');
  const switchDashSection = React.useCallback((id) => {
    setDashSection(id);
    // JS smooth-scroll ignores the CSS reduced-motion reset, so gate it here
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, []);
  const [editSessionId, setEditSessionId] = useState("");
  const [editSessionIsMc, setEditSessionIsMc] = useState(false);
  const [selectedRosterClassId, setSelectedRosterClassId] = useState("all");

  // ── Welcome Drip Testing States ──
  const [dripTestLoading, setDripTestLoading] = useState(false);
  const [dripTestStep, setDripTestStep] = useState("");
  const [dripTestResults, setDripTestResults] = useState(null);
  const [dripTestError, setDripTestError] = useState("");
  const [expandedTestLead, setExpandedTestLead] = useState(null);

  const [status, setStatus] = useState({ type: "", message: "" });

  // ── AI Masterclass Creation State ──
  const [masterclasses, setMasterclasses] = useState([]);
  const [mcTitle, setMcTitle] = useState("");
  const [mcInstructor, setMcInstructor] = useState("Balaji Chippada");
  const [mcPrice, setMcPrice] = useState("");
  const [mcDateTime, setMcDateTime] = useState("");
  const [mcRawSyllabus, setMcRawSyllabus] = useState("");
  const [mcVideoUrl, setMcVideoUrl] = useState("");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [aiStatus, setAiStatus] = useState({ type: '', msg: '' }); // loading | success | error
  const [mcLoading, setMcLoading] = useState(false);
  const [mcPreview, setMcPreview] = useState(null); // last generated syllabus for preview

  // ── Marketing Audience States ──
  const [users, setUsers] = useState([]);
  const [selectedMcCampaignId, setSelectedMcCampaignId] = useState("");

  // ── Email Broadcast States ──
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastSegmentName, setBroadcastSegmentName] = useState("");
  const [broadcastList, setBroadcastList] = useState([]);
  // Subject/body/template/sending state lives in <BroadcastModal> (local
  // state) so typing in the modal never re-renders this whole component.

  // ── Bulk Email from Spreadsheet (Name/Email/Phone upload) ──
  // bulkRows accumulates across multiple uploaded files (deduped by email);
  // bulkFiles tracks each file added and how many recipients it contributed.
  const [bulkRows, setBulkRows] = useState([]);          // [{ name, email, phone }]
  const [bulkFiles, setBulkFiles] = useState([]);        // [{ name, added }]
  // Optional attachment sent with every email in the campaign (≤5MB, base64).
  const [bulkAttachment, setBulkAttachment] = useState(null); // { filename, contentType, dataBase64, size }
  const [bulkNote, setBulkNote] = useState("");          // feedback from the last upload
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkParseError, setBulkParseError] = useState("");
  // Subject/body/event fields live inside <EmailComposer> (local state) so
  // typing doesn't re-render this whole component — only send status is here.
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");

  // ── Saved marketing contacts (persisted from spreadsheet sends; reusable) ──
  const [savedContacts, setSavedContacts] = useState([]);   // [{ id(email), name, email, phone, source, lastEmailedAt, emailCount }]
  // Search box lives in <SavedContactsTable> (local state); composer
  // fields live in <EmailComposer> local state.
  const [savedSending, setSavedSending] = useState(false);
  const [savedError, setSavedError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState("");

  // Roadmap Video Linker + Per-video code links state lives in
  // RoadmapVideosAdminPanel / VideoCodeLinksAdminPanel — keeping form
  // state out of DashboardView so typing doesn't re-render the world.

  const openBroadcastModal = (list, segmentName) => {
    if (list.length === 0) {
      alert("This segment has no contacts to broadcast to.");
      return;
    }
    setBroadcastList(list);
    setBroadcastSegmentName(segmentName);
    setShowBroadcastModal(true);
  };

  // Parse an uploaded spreadsheet (.xlsx/.xls/.csv) into recipients. Columns are
  // matched case-insensitively by header (Name / Email / Phone). Rows without a
  // valid email — and duplicates — are dropped, with a count surfaced to the UI.
  const handleBulkFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    // Allow re-selecting the same file later (onChange won't fire otherwise).
    e.target.value = "";
    if (!file) return;

    setBulkParseError("");
    setBulkError("");
    setBulkSuccess("");
    setBulkNote("");
    setBulkParsing(true);

    try {
      const XLSX = await loadXlsxLib();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("The first sheet appears to be empty.");
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (json.length === 0) throw new Error("No data rows found in the sheet.");

      // Resolve the Name / Email / Phone columns from the header keys.
      const keys = Object.keys(json[0]);
      const findKey = (re) => keys.find((k) => re.test(String(k).toLowerCase().trim()));
      const emailKey = findKey(/e-?mail/);
      const nameKey = findKey(/name/);
      const phoneKey = findKey(/phone|mobile|contact|number/);
      if (!emailKey) {
        throw new Error('No "Email" column found. The sheet needs Name, Email, and Phone number columns.');
      }

      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      // Every row with a valid email is added to the running list — including an
      // address that's already present (two people can share one inbox, and
      // re-uploading a file should add its rows). Nothing the admin uploaded is
      // silently dropped; only empty / malformed emails are skipped.
      const existing = bulkRows;
      const added = [];
      let skipped = 0;
      json.forEach((r) => {
        const email = String(r[emailKey] == null ? "" : r[emailKey]).trim().toLowerCase();
        if (!email || !EMAIL_RE.test(email)) { skipped++; return; }
        added.push({
          name: nameKey ? String(r[nameKey] == null ? "" : r[nameKey]).trim() : "",
          email,
          phone: phoneKey ? String(r[phoneKey] == null ? "" : r[phoneKey]).trim() : "",
        });
      });

      if (added.length === 0) {
        setBulkNote(`No recipients added from “${file.name}” — ${skipped} row${skipped === 1 ? "" : "s"} had an empty or invalid email.`);
        return;
      }
      setBulkRows(existing.concat(added));
      setBulkFiles((prev) => prev.concat([{ name: file.name, added: added.length }]));
      setBulkNote(`Added ${added.length} recipient${added.length === 1 ? "" : "s"} from “${file.name}”${skipped ? ` · ${skipped} skipped (empty / invalid email)` : ""}. ${existing.length + added.length} total.`);
    } catch (err) {
      console.error("Spreadsheet parse failed:", err);
      // A bad file never wipes the recipients already gathered from earlier files.
      setBulkParseError(err.message || "Could not read this file. Use a .xlsx or .csv with Name, Email, Phone columns.");
    } finally {
      setBulkParsing(false);
    }
  };

  // Read the optional attachment as base64. 5MB cap keeps the callable payload
  // well under Firebase's 10MB limit even with a 5,000-row recipient list.
  const handleBulkAttachment = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBulkError("");
    if (file.size > 5 * 1024 * 1024) {
      setBulkError(`“${file.name}” is ${(file.size / (1024 * 1024)).toFixed(1)}MB — attachments are capped at 5MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — keep only the base64 payload.
      const dataBase64 = String(reader.result).split(",")[1] || "";
      setBulkAttachment({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64,
        size: file.size,
      });
    };
    reader.onerror = () => setBulkError(`Could not read “${file.name}”.`);
    reader.readAsDataURL(file);
  };

  const handleClearBulkList = () => {
    setBulkRows([]);
    setBulkFiles([]);
    setBulkAttachment(null);
    setBulkNote("");
    setBulkParseError("");
    setBulkError("");
    setBulkSuccess("");
  };

  // Live list of saved marketing contacts (persisted by sendBulkEmail on each send).
  useEffect(() => {
    if (!db) return;
    const unsub = db.collection('marketingContacts').onSnapshot((snap) => {
      const list = [];
      snap.forEach((d) => list.push(Object.assign({ id: d.id }, d.data())));
      setSavedContacts(list);
    }, () => setSavedContacts([]));
    return () => unsub();
  }, []);

  const handleRemoveSavedContact = React.useCallback(async (email) => {
    try { await db.collection('marketingContacts').doc(email).delete(); }
    catch (err) { setSavedError(err.message || 'Failed to remove contact.'); }
  }, []);

  // Re-email the entire saved audience — reuses the same fan-out + persistence.
  // Receives the composer's fields; returns true so the composer clears itself.
  const handleEmailSavedContacts = async ({ subject, body, event }) => {
    setSavedError(''); setSavedSuccess('');
    if (savedContacts.length === 0) { setSavedError('No saved contacts yet — send a spreadsheet campaign first.'); return false; }
    if (event && (!event.title.trim() || !event.dateTime)) { setSavedError('The calendar invite needs an event title and a date & time (or untick it).'); return false; }
    if (!functions) { setSavedError('Firebase Functions is not initialized on this platform.'); return false; }
    setSavedSending(true);
    try {
      const call = functions.httpsCallable('sendBulkEmail');
      const res = await call({
        subject,
        body,
        label: 'Saved contacts',
        recipients: savedContacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
        // datetime-local is in the admin's local timezone; send as absolute UTC.
        ...(event && {
          event: {
            title: event.title.trim(),
            dateTime: new Date(event.dateTime).toISOString(),
            duration: Number(event.duration) || 60,
            location: event.location.trim(),
          },
        }),
      });
      const result = res.data || {};
      if (result.success) {
        setSavedSuccess(`Queued ${result.queued} email${result.queued === 1 ? '' : 's'} to saved contacts. Track delivery in the Email Tasks section (job ${result.jobId}).`);
        return true;
      }
      throw new Error('The server did not confirm the send.');
    } catch (err) {
      console.error('Saved-contacts email failed:', err);
      setSavedError(err.message || 'Failed to queue the email.');
      return false;
    } finally { setSavedSending(false); }
  };

  // Hand the parsed list to the sendBulkEmail Cloud Function, which validates,
  // dedupes, writes an emailJobs progress doc, and fans the send out into
  // batched workers. Progress shows live in the Email Tasks section below.
  // Receives the composer's fields; returns true so the composer clears itself.
  const handleSendBulkEmail = async ({ subject, body, event }) => {
    setBulkError("");
    setBulkSuccess("");
    if (bulkRows.length === 0) { setBulkError("Upload a spreadsheet with recipients first."); return false; }
    if (event && (!event.title.trim() || !event.dateTime)) { setBulkError("The calendar invite needs an event title and a date & time (or untick it)."); return false; }
    if (!functions) { setBulkError("Firebase Functions is not initialized on this platform."); return false; }

    setBulkSending(true);
    try {
      const call = functions.httpsCallable("sendBulkEmail");
      const res = await call({
        subject,
        body,
        label: bulkFiles.map((f) => f.name).join(", ") || "Spreadsheet upload",
        recipients: bulkRows.map((r) => ({ name: r.name, email: r.email, phone: r.phone })),
        ...(bulkAttachment && {
          attachment: {
            filename: bulkAttachment.filename,
            contentType: bulkAttachment.contentType,
            dataBase64: bulkAttachment.dataBase64,
          },
        }),
        // datetime-local is in the admin's local timezone; send as absolute UTC.
        ...(event && {
          event: {
            title: event.title.trim(),
            dateTime: new Date(event.dateTime).toISOString(),
            duration: Number(event.duration) || 60,
            location: event.location.trim(),
          },
        }),
      });
      const result = res.data || {};
      if (result.success) {
        setBulkSuccess(`Queued ${result.queued} email${result.queued === 1 ? "" : "s"} in ${result.batches} batch${result.batches === 1 ? "" : "es"}. Track delivery in the Email Tasks section below (job ${result.jobId}).`);
        setBulkRows([]);
        setBulkFiles([]);
        setBulkAttachment(null);
        setBulkNote("");
        return true;
      }
      throw new Error("The server did not confirm the send.");
    } catch (err) {
      console.error("Bulk email send failed:", err);
      setBulkError(err.message || "Failed to queue the bulk email.");
      return false;
    } finally {
      setBulkSending(false);
    }
  };

  // These preview tables render up to 1,000 rows — memo them so unrelated
  // dashboard state changes (live snapshots, tab switches) don't re-diff them.
  const bulkPreviewTable = React.useMemo(() => (
    <div style={{ border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
      <div style={{ maxHeight: "320px", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "10px 14px", color: "var(--fg-faint)", fontWeight: 600, position: "sticky", top: 0, background: "var(--bg-elev)" }}>Name</th>
              <th style={{ padding: "10px 14px", color: "var(--fg-faint)", fontWeight: 600, position: "sticky", top: 0, background: "var(--bg-elev)" }}>Email</th>
              <th style={{ padding: "10px 14px", color: "var(--fg-faint)", fontWeight: 600, position: "sticky", top: 0, background: "var(--bg-elev)" }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {bulkRows.slice(0, 1000).map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 14px", color: "var(--fg)" }}>{r.name || "—"}</td>
                <td style={{ padding: "10px 14px", color: "var(--fg-dim)", fontFamily: "JetBrains Mono" }}>{r.email}</td>
                <td style={{ padding: "10px 14px", color: "var(--fg-dim)", fontFamily: "JetBrains Mono" }}>{r.phone || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bulkRows.length > 1000 && (
        <div style={{ padding: "8px 14px", fontSize: "12px", color: "var(--fg-faint)", borderTop: "1px solid var(--line)", background: "var(--bg-elev)" }}>
          Showing the first 1,000 — all {bulkRows.length.toLocaleString()} recipients will be emailed.
        </div>
      )}
    </div>
  ), [bulkRows]);

  const runDashboardAutomationTest = async () => {
    if (!db) {
      setDripTestError("Firestore is not initialized.");
      return;
    }

    setDripTestLoading(true);
    setDripTestError("");
    setDripTestResults(null);
    setExpandedTestLead(null);

    try {
      // Step 1: Cleaning existing test leads
      setDripTestStep("Cleaning existing test leads...");
      const testLeadIds = ["dashboard_test_fresh", "dashboard_test_oneday", "dashboard_test_fourday"];
      const batch = db.batch();
      testLeadIds.forEach(id => {
        batch.delete(db.collection('leads').doc(id));
      });
      await batch.commit();

      // Short delay to ensure deletion propagation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 2: Seeding test leads
      setDripTestStep("Seeding test leads with custom timestamps...");
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days ago

      await db.collection('leads').doc('dashboard_test_fresh').set({
        email: "fresh@test.com",
        name: "Fresh Tester",
        source: "dashboard_test",
        createdAt: firebase.firestore.Timestamp.fromDate(now),
        welcomeEmailSent: false,
        gettingStartedEmailSent: false,
        inviteEmailSent: false
      });

      await db.collection('leads').doc('dashboard_test_oneday').set({
        email: "oneday@test.com",
        name: "One Day Tester",
        source: "dashboard_test",
        createdAt: firebase.firestore.Timestamp.fromDate(oneDayAgo),
        welcomeEmailSent: false,
        gettingStartedEmailSent: false,
        inviteEmailSent: false
      });

      await db.collection('leads').doc('dashboard_test_fourday').set({
        email: "fourday@test.com",
        name: "Four Day Tester",
        source: "dashboard_test",
        createdAt: firebase.firestore.Timestamp.fromDate(fourDaysAgo),
        welcomeEmailSent: false,
        gettingStartedEmailSent: false,
        inviteEmailSent: false
      });

      // Step 3: Wait for firestore background triggers to process the creation (Email 1 sent on create)
      setDripTestStep("Waiting for background triggers (Email 1 dispatch)...");
      await new Promise(resolve => setTimeout(resolve, 3500));

      // Step 4: Run drip campaign Cloud Function (or fallback to client-side emulation)
      setDripTestStep("Triggering drip Campaign execution...");
      
      let stats = { gettingStartedSent: 0, inviteSent: 0, errors: 0 };
      let callSuccess = false;

      if (functions) {
        try {
          const processDripCall = functions.httpsCallable("processDripCampaign");
          const functionResponse = await processDripCall();
          const callData = functionResponse.data;
          if (callData && callData.success) {
            stats = callData.stats || stats;
            callSuccess = true;
          }
        } catch (fnErr) {
          console.warn("Cloud Function execution failed. Falling back to client-side sandbox emulation...", fnErr);
        }
      }

      if (!callSuccess) {
        setDripTestStep("Running client-side sandbox emulation fallback...");
        const nowMs = Date.now();
        const oneDayAgoLimit = nowMs - 24 * 60 * 60 * 1000;
        const threeDaysAgoLimit = nowMs - 3 * 24 * 60 * 60 * 1000;

        for (const docId of testLeadIds) {
          const docRef = db.collection("leads").doc(docId);
          const snap = await docRef.get();
          if (!snap.exists) continue;
          
          const lead = snap.data();
          const createdAt = lead.createdAt ? (lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt)) : null;
          if (!createdAt) continue;
          
          const createdAtMs = createdAt.getTime();
          const name = lead.name || "";
          const email = lead.email;

          // 1. Welcome Email (Email 1) - If onCreate trigger didn't run, process here
          if (lead.welcomeEmailSent !== true) {
            const subject = "Welcome to The Agent Engineer + Your 26-Week Roadmap! 🚀";
            const body = `Hi ${name || "there"},\n\n` +
              `Welcome to The Agent Engineer community! I'm thrilled to have you here.\n\n` +
              `As promised, here is the direct link to download/access the full 26-Week Agentic AI Engineer Roadmap:\n` +
              `https://github.com/ch-balaji/ai-engineer-roadmap\n\n` +
              `You can also bookmark your live interactive roadmap progress tracker on our website:\n` +
              `https://balajichippada.com/\n\n` +
              `Over the next few days, I'll send you a couple of study guides to help you set up your Python environment, configure Claude Code, and get access to the APIs we use in the cohorts.\n\n` +
              `If you have any questions or get stuck on any phase, feel free to reply directly to this email or join our WhatsApp community:\n` +
              `https://chat.whatsapp.com/ENnDGZ41lMYBHCApJIpzo6\n\n` +
              `Let's build some amazing agentic systems together!\n\n` +
              `Best,\n` +
              `Balaji Chippada\n` +
              `The Agent Engineer`;

            await docRef.update({
              welcomeEmailSent: true,
              isMock: true,
              sentEmails: firebase.firestore.FieldValue.arrayUnion({
                type: "Welcome Roadmap",
                subject: subject,
                body: body,
                sentAt: new Date().toISOString()
              })
            });
          }

          // Fetch fresh lead snapshot to pick up Welcome updates
          const freshSnap = await docRef.get();
          const freshLead = freshSnap.data();

          // 2. Getting Started (Email 2) - Created <= 24 hours ago
          if (createdAtMs <= oneDayAgoLimit && freshLead.gettingStartedEmailSent !== true) {
            const subject = "Phase 1: Getting Started with Python & LLM Mental Models";
            const body = `Hi ${name || "there"},\n\n` +
              `I hope you've had a chance to look over the 26-Week Agentic AI Engineer Roadmap!\n\n` +
              `Phase 1 is all about building a solid foundation. If you want to build autonomous systems, you must write clean, asynchronous Python first. Here is your quick checklist to get started this week:\n\n` +
              `1. Set up Python 3.10+ and virtual environments (venv/conda).\n` +
              `2. Get comfortable with basic HTTP requests (using standard libraries or requests/httpx).\n` +
              `3. Understand the basic mental model of an LLM: it is a next-token prediction engine, not a database.\n\n` +
              `To track your progress and mark modules as completed, sign in to your dashboard on our website:\n` +
              `https://balajichippada.com/\n\n` +
              `Tomorrow, we'll dive into prompt caching and tool calling patterns.\n\n` +
              `Best,\n` +
              `Balaji Chippada\n` +
              `The Agent Engineer`;

            await docRef.update({
              gettingStartedEmailSent: true,
              gettingStartedEmailSentAt: firebase.firestore.FieldValue.serverTimestamp(),
              sentEmails: firebase.firestore.FieldValue.arrayUnion({
                type: "Getting Started (Email 2)",
                subject: subject,
                body: body,
                sentAt: new Date().toISOString()
              })
            });
            stats.gettingStartedSent++;
          }

          // 3. Invite to Masterclass (Email 3) - Created <= 3 days ago
          if (createdAtMs <= threeDaysAgoLimit && freshLead.inviteEmailSent !== true) {
            const subject = "Live Cohort: Build a production-grade Claude Code agent with me!";
            const body = `Hi ${name || "there"},\n\n` +
              `By now, you should have your local development environment ready.\n\n` +
              `The best way to solidify your learning is to build in real time. I'm hosting an exclusive live masterclass where we will configure Claude Code, set up Model Context Protocol (MCP) servers, and build a self-correcting repository agent from scratch in 2 hours.\n\n` +
              `Secure your seat here:\n` +
              `https://balajichippada.com/\n\n` +
              `Looking forward to seeing you there!\n\n` +
              `Best,\n` +
              `Balaji Chippada\n` +
              `The Agent Engineer`;

            await docRef.update({
              inviteEmailSent: true,
              inviteEmailSentAt: firebase.firestore.FieldValue.serverTimestamp(),
              sentEmails: firebase.firestore.FieldValue.arrayUnion({
                type: "Invite to Masterclass (Email 3)",
                subject: subject,
                body: body,
                sentAt: new Date().toISOString()
              })
            });
            stats.inviteSent++;
          }
        }
      }

      // Step 5: Fetch updated test leads and logs
      setDripTestStep("Fetching updated test leads from Firestore...");
      
      const freshDoc = await db.collection('leads').doc('dashboard_test_fresh').get();
      const onedayDoc = await db.collection('leads').doc('dashboard_test_oneday').get();
      const fourdayDoc = await db.collection('leads').doc('dashboard_test_fourday').get();

      setDripTestResults({
        fresh: freshDoc.exists ? freshDoc.data() : null,
        oneday: onedayDoc.exists ? onedayDoc.data() : null,
        fourday: fourdayDoc.exists ? fourdayDoc.data() : null,
        stats: stats
      });
      
      setDripTestStep("completed");
    } catch (err) {
      console.error("Drip testing execution failed:", err);
      setDripTestError(err.message || "An unexpected error occurred during drip testing.");
      setDripTestStep("");
    } finally {
      setDripTestLoading(false);
    }
  };

  // Load sessions for management panel
  useEffect(() => {
    if (!db) return;
    // Fetch unordered and sort on the client — orderBy('createdAt') would drop
    // any session doc missing that field. (See sortByCreatedAtDesc note above.)
    const unsubscribe = db.collection("sessions")
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setSessions(sortByCreatedAtDesc(list));
      });
    return () => unsubscribe();
  }, []);

  // Load bookings list for reporting
  useEffect(() => {
    if (!db) return;
    const unsubscribe = db.collection("registrations")
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setRegistrations(list);
      }, err => {
        console.warn("Could not load registrations list: insufficient permission. That's expected for non-staff.");
      });
    return () => unsubscribe();
  }, [user]);

  // Load users list for marketing segmentation
  useEffect(() => {
    if (!db) return;
    const unsubscribe = db.collection("users")
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setUsers(list);
      }, err => {
        console.warn("Could not load users list: insufficient permission.");
      });
    return () => unsubscribe();
  }, [user]);

  // Load AI-structured masterclasses
  useEffect(() => {
    if (!db) return;
    const unsubscribe = db.collection('masterclasses')
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setMasterclasses(sortByCreatedAtDesc(list));
      });
    return () => unsubscribe();
  }, []);

  // Track which session is being edited; ScheduleMasterclassPanel derives
  // its own field values from props (remounted via key on target change).
  const handleSelectSessionToEdit = (id, isMcCollection = false) => {
    setEditSessionId(id);
    setEditSessionIsMc(isMcCollection);
  };

  const cancelEdit = React.useCallback(() => {
    setEditSessionId("");
    setEditSessionIsMc(false);
  }, []);

  // Count completed registrations for a session (used for cancel confirmations).
  const completedRegCount = (sessionId) =>
    (registrations || []).filter(r => r.sessionId === sessionId && r.status === 'completed').length;

  // Email all registrants that a masterclass was cancelled (also marks their
  // registrations cancelled so reminders stop). Returns the send stats.
  const notifyCancellation = async (sessionId) => {
    try {
      const call = functions.httpsCallable('sendMasterclassCancellation');
      const res = await call({ sessionId });
      return (res && res.data) || null;
    } catch (e) {
      console.warn('Cancellation email failed:', e);
      return { error: e.message || 'failed' };
    }
  };

  const cancellationResultMsg = (title, r) => {
    let msg = `"${title}" cancelled.`;
    if (r && r.error) msg += ` (Couldn't notify registrants: ${r.error})`;
    else if (r && r.skippedPast) msg += ` (Session already passed — no emails sent.)`;
    else if (r && r.queued > 0) msg += ` Notifying ${r.queued} registrant(s) in the background.`;
    else if (r && r.queued === 0) msg += ` (No registrants to notify.)`;
    return msg;
  };

  const handleDeleteSession = async (sessionId, sessionTitle, isMcCollection = false) => {
    const count = completedRegCount(sessionId);
    if (!window.confirm(`Cancel & delete "${sessionTitle}"?${count ? ` This will email ${count} registered student(s) that it's cancelled.` : ''} This cannot be undone.`)) return;
    try {
      const targetCollection = isMcCollection ? "masterclasses" : "sessions";
      await db.collection(targetCollection).doc(sessionId).set({
        deleted: true,
        status: "deleted",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // If we were editing this session, reset form
      if (editSessionId === sessionId) handleSelectSessionToEdit("", false);
      const stats = await notifyCancellation(sessionId);
      setStatus({ type: "success", message: cancellationResultMsg(sessionTitle, stats) });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to delete session." });
    }
  };

  // ── Save Gemini API key to localStorage whenever it changes ──
  const handleGeminiKeyChange = (val) => {
    setGeminiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  // ── AI Masterclass: Generate syllabus via Gemini REST API + Write to Firestore ──
  const handleMasterclassSubmit = async (e) => {
    e.preventDefault();
    if (!mcTitle || !mcPrice || !mcDateTime || !mcRawSyllabus) {
      setAiStatus({ type: 'error', msg: 'Please fill in all fields including the raw syllabus text.' });
      return;
    }
    const apiKey = geminiKey.trim();
    if (!apiKey) {
      setAiStatus({ type: 'error', msg: 'Enter your Gemini API key in the settings field above.' });
      return;
    }

    setMcLoading(true);
    setMcPreview(null);
    setAiStatus({ type: 'loading', msg: '✨ Gemini is structuring your syllabus...' });

    const GEMINI_PROMPT = `Analyze this technical masterclass syllabus text. Your job is to extract and map this text into a strict JSON layout array.

Rules:
- Identify 4 to 6 main core high-level topic titles.
- For each high-level topic, extract 4 to 6 concise, actionable sub-topic bullet strings.
- Include a chronological string index mapping (e.g., "1.1", "1.2", "2.1") for UI navigation.

Output Shape (return RAW VALID JSON ONLY — no markdown, no code fences, no explanation):
[
  {
    "index": "1.1",
    "topicTitle": "Topic Name",
    "subTopics": ["Sub-item 1", "Sub-item 2", "Sub-item 3"]
  }
]

Syllabus text to structure:
${mcRawSyllabus}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: GEMINI_PROMPT }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          })
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API error (${res.status})`);
      }

      const geminiData = await res.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      let syllabus;
      try {
        syllabus = JSON.parse(cleaned);
      } catch (_e) {
        throw new Error('Gemini returned invalid JSON. Try again or simplify your syllabus text.');
      }

      if (!Array.isArray(syllabus) || syllabus.length === 0) {
        throw new Error('Gemini returned an empty or malformed syllabus array.');
      }

      setAiStatus({ type: 'loading', msg: '💾 Saving masterclass to Firestore...' });

      const mcDoc = {
        title: mcTitle.trim(),
        instructor: mcInstructor.trim() || 'Balaji Chippada',
        price: parseFloat(mcPrice),
        dateTime: new Date(mcDateTime).toISOString(),
        rawSyllabus: mcRawSyllabus,
        syllabus,
        videoUrl: mcVideoUrl.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('masterclasses').add(mcDoc);

      setMcPreview(syllabus);
      setAiStatus({ type: 'success', msg: `✅ "${mcTitle}" published with ${syllabus.length} structured topics!` });

      // Reset form
      setMcTitle(''); setMcPrice(''); setMcDateTime(''); setMcRawSyllabus('');
      setMcInstructor('Balaji Chippada'); setMcVideoUrl('');

    } catch (err) {
      setAiStatus({ type: 'error', msg: err.message || 'Something went wrong. Check your API key and try again.' });
    } finally {
      setMcLoading(false);
    }
  };

  // Save a Zoom link for a masterclass and email it to everyone already
  // registered (via the sendZoomLinkToRegistrants Cloud Function). Future
  // registrants get it automatically in their confirmation email.
  // Default zoom-link email shown in the editor. {{name}} is substituted with
  // each student's name server-side.
  // Masterclasses that have at least one registration (covers both Firestore
  // and config-only masterclasses, since both produce registration docs).
  const sessionsWithRegs = React.useMemo(() => {
    const map = new Map();
    (registrations || []).forEach(r => {
      if (!r.sessionId) return;
      if (!map.has(r.sessionId)) {
        map.set(r.sessionId, { sessionId: r.sessionId, title: r.sessionTitle || 'Masterclass', registered: 0, zoomLink: '' });
      }
      const e = map.get(r.sessionId);
      if (r.status === 'completed') e.registered++;
      if (r.zoomLink && !e.zoomLink) e.zoomLink = r.zoomLink;
    });
    return [...map.values()];
  }, [registrations]);

  // Compute all scheduled and virtual default config masterclasses/sessions in a unified list (excluding soft deleted ones)
  const combinedClasses = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    
    // Prepend the virtual/default config masterclass if it's not already in Firestore collections,
    // AND has not been explicitly deleted/hidden by the admin!
    const featuredId = V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id;
    if (featuredId) {
      const inMasterclasses = masterclasses.some(m => m.id === featuredId);
      const inSessions = sessions.some(s => s.id === featuredId);
      if (!inMasterclasses && !inSessions) {
        const isExplicitlyDeleted = [...masterclasses, ...sessions].some(x => x.id === featuredId && (x.deleted || x.status === 'deleted'));
        if (!isExplicitlyDeleted) {
          list.push({
            id: featuredId,
            title: V2_CONFIG_MASTERCLASS.title,
            price: V2_CONFIG_MASTERCLASS.price,
            dateTime: V2_CONFIG_MASTERCLASS.dateTime,
            instructor: V2_CONFIG_MASTERCLASS.instructor?.name || "Balaji Chippada",
            description: V2_CONFIG_MASTERCLASS.subtitle || V2_CONFIG_MASTERCLASS.about,
            rawSyllabus: V2_CONFIG_MASTERCLASS.about,
            syllabus: V2_CONFIG_MASTERCLASS.curriculum ? V2_CONFIG_MASTERCLASS.curriculum.map((c, idx) => ({
              index: `1.${idx + 1}`,
              topicTitle: c.title,
              subTopics: c.points
            })) : [],
            isMc: true,
            isDefaultConfigMc: true
          });
          seen.add(featuredId);
        }
      }
    }

    masterclasses.forEach(m => {
      if (m && m.id && !seen.has(m.id) && !m.deleted && m.status !== 'deleted') {
        list.push({ ...m, isMc: true });
        seen.add(m.id);
      }
    });
    sessions.forEach(s => {
      if (s && s.id && !seen.has(s.id) && !s.deleted && s.status !== 'deleted') {
        list.push({ ...s, isMc: false });
        seen.add(s.id);
      }
    });
    return list;
  }, [masterclasses, sessions]);

  // Compute active registrations (excluding those for soft-deleted sessions/masterclasses)
  // ── Derived audience/registration data ────────────────────────────
  // All of this is memoized and index-based. It used to be recomputed
  // inline on EVERY render — including every dashboard tab switch —
  // and three of the segments were quadratic (users × registrations),
  // with activeRegistrations allocating a fresh [...masterclasses,
  // ...sessions] array per registration. On production-sized data that
  // was seconds of blocked main thread per click.

  // Ids of soft-deleted classes, from both collections. Subsumes the old
  // per-row isDeletedMc / isDeletedSession / isFeaturedDeleted checks —
  // the featured-id case was already covered by the other two.
  const deletedClassIds = React.useMemo(() => {
    const out = new Set();
    masterclasses.forEach(m => { if (m && (m.deleted || m.status === 'deleted')) out.add(m.id); });
    sessions.forEach(x => { if (x && (x.deleted || x.status === 'deleted')) out.add(x.id); });
    return out;
  }, [masterclasses, sessions]);

  const activeRegistrations = React.useMemo(
    () => registrations.filter(r => !deletedClassIds.has(r.sessionId)),
    [registrations, deletedClassIds]
  );

  const filteredRegistrations = React.useMemo(
    () => (selectedRosterClassId === "all"
      ? activeRegistrations
      : activeRegistrations.filter(r => r.sessionId === selectedRosterClassId)),
    [activeRegistrations, selectedRosterClassId]
  );

  const { totalRevenue, totalSeats } = React.useMemo(() => {
    let revenue = 0, seats = 0;
    filteredRegistrations.forEach(r => {
      if (r.status === 'completed') { revenue += (r.amount / 100); seats += 1; }
    });
    return { totalRevenue: revenue, totalSeats: seats };
  }, [filteredRegistrations]);

  const ADMIN_EMAILS = ['gowtamsbh1234@gmail.com', 'balajichippada.20@gmail.com', 'mayupatil199@gmail.com', 'bhargavsinguluri@gmail.com'];
  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase());

  // ── Marketing Segmentation & Deduplication Computations ──
  const norm = (v) => (v || '').toLowerCase().trim();

  // Emails with at least one completed booking — the lookup that turns
  // the three quadratic segment scans into linear passes.
  const paidEmails = React.useMemo(() => {
    const out = new Set();
    activeRegistrations.forEach(r => {
      if (r.status === 'completed') { const e = norm(r.studentEmail); if (e) out.add(e); }
    });
    return out;
  }, [activeRegistrations]);

  // First user per email (matches the old users.find(...) semantics)
  const userByEmail = React.useMemo(() => {
    const out = new Map();
    users.forEach(u => { const e = norm(u.email); if (e && !out.has(e)) out.set(e, u); });
    return out;
  }, [users]);

  const uniquePaidEmails = React.useMemo(() => Array.from(paidEmails), [paidEmails]);
  const totalPayingStudents = uniquePaidEmails.length;
  const totalLeads = users.length;
  const conversionRate = totalLeads > 0
    ? ((totalPayingStudents / totalLeads) * 100).toFixed(1)
    : "0.0";

  const { professionalsList, academicStudentsList } = React.useMemo(() => ({
    professionalsList: users.filter(u => u.userType === 'Working Professional'),
    academicStudentsList: users.filter(u => u.userType === 'Student'),
  }), [users]);
  const totalProfessionals = professionalsList.length;
  const totalAcademicStudents = academicStudentsList.length;

  // Cold Leads: signed up but never completed a booking
  const coldLeadsList = React.useMemo(
    () => users.filter(u => !paidEmails.has(norm(u.email))),
    [users, paidEmails]
  );

  // Paid Customers: signed-up payers first, then direct registrations
  // not already covered by a user account (order preserved).
  const paidCustomersList = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    users.forEach(u => {
      const e = norm(u.email);
      if (paidEmails.has(e)) {
        list.push({
          name: u.name || u.displayName || "Signed Up Student",
          email: u.email,
          phone: u.phone || "",
          userType: u.userType || "Not Specified"
        });
        seen.add(e);
      }
    });
    activeRegistrations.forEach(r => {
      if (r.status !== 'completed') return;
      const e = norm(r.studentEmail);
      if (e && !seen.has(e)) {
        list.push({
          name: r.studentName || "Paid Student",
          email: r.studentEmail,
          phone: r.studentPhone || "",
          userType: "Not Specified"
        });
        seen.add(e);
      }
    });
    return list;
  }, [users, activeRegistrations, paidEmails]);

  // Abandoned Checkouts: pending with no completed booking for that email
  const abandonedCheckoutsList = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    activeRegistrations.forEach(r => {
      if (r.status !== 'pending') return;
      const e = norm(r.studentEmail);
      if (!e || seen.has(e) || paidEmails.has(e)) return;
      const matchingUser = userByEmail.get(e);
      list.push({
        name: r.studentName || (matchingUser ? (matchingUser.name || matchingUser.displayName) : "Abandoned Checkout"),
        email: r.studentEmail,
        phone: r.studentPhone || (matchingUser ? matchingUser.phone : ""),
        userType: matchingUser ? (matchingUser.userType || "Not Specified") : "Not Specified"
      });
      seen.add(e);
    });
    return list;
  }, [activeRegistrations, paidEmails, userByEmail]);

  // Session Campaign Filter Roster
  const activeMcCampaignSession = React.useMemo(
    () => sessions.find(s => s.id === selectedMcCampaignId) || masterclasses.find(m => m.id === selectedMcCampaignId),
    [sessions, masterclasses, selectedMcCampaignId]
  );
  const sessionCampaignRoster = React.useMemo(
    () => registrations.filter(r => r.sessionId === selectedMcCampaignId),
    [registrations, selectedMcCampaignId]
  );

  // 3. Robust client-side HTML5 CSV downloader
  const handleExportCSV = (list, segmentName) => {
    if (list.length === 0) {
      alert("This marketing segment has no contacts to export.");
      return;
    }
    
    let csvContent = "Name,Email,Phone,User Type,Segment Tag\n";
    list.forEach(item => {
      const name = (item.name || item.studentName || "Unknown").replace(/[",]/g, "");
      const email = (item.email || item.studentEmail || "").replace(/[",]/g, "");
      const phone = (item.phone || item.studentPhone || "").replace(/[",]/g, "");
      const type = (item.userType || "Not Specified").replace(/[",]/g, "");
      csvContent += `"${name}","${email}","${phone}","${type}","${segmentName}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ai_coach_${segmentName.toLowerCase().replace(/\s+/g, '_')}_segment.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Staff <em>Control Panel</em></h1>
          <p className="hero__sub" style={{ marginTop: "8px" }}>Manage scheduled masterclasses, edit metadata, and monitor registrations.</p>
        </div>
        <div className="dashboard__userinfo">
          <span>{(user && user.email) || '—'}</span>
          <span className="dashboard__role-badge">{role}</span>
          <button className="dashboard__logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {status.message && (
        <div className={`status-box status-box--${status.type}`}>
          <span>{status.type === 'success' ? '✔' : '⚠'}</span>
          <span>{status.message}</span>
        </div>
      )}

      <DashboardTabs
        active={dashSection}
        onChange={switchDashSection}
        isAdmin={isAdmin}
        classCount={combinedClasses.length}
        leadCount={totalLeads}
      />

      <div className="dash-workspace" key={dashSection}>

      {/* ═══════════════ WORKSPACE — Overview ═══════════════ */}
      {dashSection === 'overview' && (
      <React.Fragment>
        <div className="dash-statrail">
          <DashStat
            label="Reserved seats"
            value={totalSeats}
            sub={selectedRosterClassId === 'all' ? 'Across all classes' : 'Selected class'}
            accent="var(--c-rust)"
          />
          <DashStat
            label="Gross revenue"
            value={`₹${totalRevenue.toLocaleString()}`}
            sub={selectedRosterClassId === 'all' ? 'Across all classes' : 'Selected class'}
            accent="var(--c-amber)"
          />
          {isAdmin && (
            <DashStat label="Total leads" value={totalLeads} sub="Unique email profiles" />
          )}
          {isAdmin && (
            <DashStat label="Paid customers" value={totalPayingStudents} sub="Completed bookings" accent="var(--c-emerald)" />
          )}
          {isAdmin && (
            <DashStat label="Conversion" value={`${conversionRate}%`} sub="Leads who paid" accent="var(--c-emerald)" />
          )}
          {isAdmin && (
            <DashStat
              label="Professionals"
              value={totalLeads > 0 ? `${((totalProfessionals / totalLeads) * 100).toFixed(0)}%` : '0%'}
              sub={`${totalProfessionals} pros · ${totalAcademicStudents} students`}
            />
          )}
        </div>

      <div className="dashboard__panel" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
          <h2 className="dashboard__panel-title" style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>Registrations</h2>
          <select
            value={selectedRosterClassId}
            onChange={(e) => setSelectedRosterClassId(e.target.value)}
            style={{
              background: "var(--bg-elev)",
              color: "var(--fg)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "500",
              outline: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              maxWidth: "240px",
              fontFamily: "inherit"
            }}
            className="roster-select"
          >
            <option value="all">All Scheduled Classes</option>
            {combinedClasses.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ marginTop: "12px" }}>
          <h3 className="form-label" style={{ marginBottom: "12px" }}>Roster List ({filteredRegistrations.length})</h3>
          <div style={{ overflowX: "auto", maxHeight: "340px", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "var(--fg-dim)", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--bg-elev)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "10px 14px", fontWeight: "600" }}>Student</th>
                  <th style={{ padding: "10px 14px", fontWeight: "600" }}>Class</th>
                  <th style={{ padding: "10px 14px", fontWeight: "600" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: "20px", textAlign: "center", color: "var(--fg-faint)" }}>No bookings registered yet.</td>
                  </tr>
                ) : (
                  filteredRegistrations.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <b>{r.studentName}</b>
                        <div style={{ fontSize: "11px", color: "var(--fg-faint)" }}>{r.studentEmail}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{r.sessionTitle || "Masterclass"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span className={`dashboard__role-badge`} style={{ 
                          background: r.status === 'completed' ? 'rgba(90,141,118,0.12)' : 'rgba(194,83,60,0.12)',
                          color: r.status === 'completed' ? 'var(--c-emerald)' : 'var(--c-rust)',
                          borderColor: r.status === 'completed' ? 'var(--c-emerald)' : 'var(--c-rust)',
                          padding: "2px 6px",
                          fontSize: "9px"
                        }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </React.Fragment>
      )}

      {/* ═══════════════ WORKSPACE — Videos ═══════════════ */}
      {dashSection === 'videos' && isAdmin && (
      <React.Fragment>
        <RoadmapVideosAdminPanel user={user} />
        <VideoCodeLinksAdminPanel user={user} />
      </React.Fragment>
      )}

      {/* ═══════════════ WORKSPACE — Masterclasses ═══════════════ */}
      {dashSection === 'classes' && (
      <React.Fragment>
      {isAdmin && (
        <div id="dash-classes" className="dashboard__panel">
          <h2 className="dashboard__panel-title" style={{ marginBottom: "18px" }}>Scheduled Masterclasses ({combinedClasses.length})</h2>
          {(() => {
            if (combinedClasses.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fg-faint)", border: "1px dashed var(--line)", borderRadius: "10px" }}>
                  <p style={{ margin: 0, fontSize: "14px" }}>No masterclasses yet. Use the form below to schedule your first session.</p>
                </div>
              );
            }

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {combinedClasses.map(s => {
                  const sessionDate = s.dateTime ? new Date(s.dateTime) : null;
                  const isEditing = editSessionId === s.id;
                  return (
                    <div key={s.id} style={{
                      background: isEditing ? "color-mix(in srgb, var(--c-rust) 8%, var(--bg-elev))" : "var(--bg-elev)",
                      border: `1px solid ${isEditing ? "var(--c-rust)" : "var(--line)"}`,
                      borderRadius: "12px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      transition: "border-color 0.2s"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "var(--fg)", lineHeight: 1.3, flex: 1 }}>{s.title}</h3>
                        {isEditing && (
                          <span style={{ fontSize: "10px", background: "var(--c-rust)", color: "#fff", borderRadius: "4px", padding: "2px 7px", whiteSpace: "nowrap" }}>Editing</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--fg-dim)" }}>{s.instructor || "—"}</span>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--c-amber, #f59e0b)" }}>₹{(s.price || 0).toLocaleString()}</span>
                        <span style={{ 
                          fontSize: "9px", 
                          background: s.isMc ? "color-mix(in srgb, var(--c-rust) 12%, transparent)" : "color-mix(in srgb, var(--c-amber) 12%, transparent)",
                          color: s.isMc ? "var(--c-rust)" : "var(--c-amber)", 
                          borderRadius: "4px", 
                          padding: "1px 6px",
                          fontWeight: "700",
                          textTransform: "uppercase"
                        }}>
                          {s.isMc ? "AI Masterclass" : "Session"}
                        </span>
                      </div>
                      {sessionDate && (
                        <div style={{ fontSize: "11px", color: "var(--fg-faint)" }}>
                          {sessionDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {" · "}{sessionDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--fg-dim)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {s.description || s.rawSyllabus || "No syllabus/description provided."}
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
                        <button
                          onClick={() => {
                            handleSelectSessionToEdit(isEditing ? "" : s.id, s.isMc);
                            // Scroll to the Schedule/Edit form (not the first grid on the page)
                            if (!isEditing) document.getElementById('mc-schedule-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          style={{
                            flex: 1,
                            padding: "7px 12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            border: "1px solid var(--c-rust)",
                            background: isEditing ? "var(--c-rust)" : "transparent",
                            color: isEditing ? "#fff" : "var(--c-rust)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {isEditing ? "✕ Cancel Edit" : "✎ Edit"}
                        </button>
                        <button
                          onClick={() => handleDeleteSession(s.id, s.title, s.isMc)}
                          style={{
                            padding: "7px 12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            border: "1px solid var(--c-rust, #c2533c)",
                            background: "transparent",
                            color: "var(--c-rust, #c2533c)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      <div id="mc-schedule-form">
        {/* Left Panel: Form (Only visible to Administrators) */}
        {isAdmin ? (
          <ScheduleMasterclassPanel
            key={(editSessionIsMc ? "mc:" : "s:") + (editSessionId || "new")}
            editSessionId={editSessionId}
            editSessionIsMc={editSessionIsMc}
            sessions={sessions}
            masterclasses={masterclasses}
            sessionsWithRegs={sessionsWithRegs}
            combinedClasses={combinedClasses}
            onCancelEdit={cancelEdit}
          />
        ) : (
          <div className="dashboard__panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "50px 30px" }}>
            <h2 className="dashboard__panel-title" style={{ justifyContent: "center", margin: 0, borderBottom: "none" }}>Scheduling is admin-only</h2>
            <p className="hero__sub" style={{ fontSize: "14px", marginTop: "14px", maxWidth: "34ch" }}>
              Sign in with an admin account to publish or edit masterclasses.
            </p>
          </div>
        )}

      </div>
      </React.Fragment>
      )}

      {/* ═══════════════ WORKSPACE — Audience ═══════════════ */}
      {dashSection === 'audience' && isAdmin && (
      <div id="dash-marketing" className="dashboard__panel">
        <h2 className="dashboard__panel-title" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          Marketing & Audience Management
        </h2>
        <p className="hero__sub" style={{ marginTop: "4px", fontSize: "14px", color: "var(--fg-dim)", maxWidth: "100%" }}>
          Deduplicate, filter, and organize student accounts, registrants, and failed checkouts. Export segmented contacts into HubSpot, Klaviyo, or custom audiences.
        </p>

        {/* 5 Targeted Audience Segments Grid */}
        <h3 className="form-label" style={{ marginBottom: "16px", fontSize: "11px", color: "var(--fg-faint)" }}>Standard Marketing Segments</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          
          {/* Segment 1: Paid Customers */}
          <div className="dash-seg-card" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyBetween: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard__role-badge" style={{ background: "rgba(194,83,60,0.12)", color: "var(--c-rust)", borderColor: "var(--c-rust)" }}>Warm Segment</span>
                <span style={{ fontSize: "12px", color: "var(--fg-faint)", fontFamily: "JetBrains Mono" }}>{paidCustomersList.length} Contacts</span>
              </div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "17px", fontWeight: "600" }}>Paid Customers</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-dim)", lineHeight: "1.4" }}>
                Students who have successfully booked and completed at least one paid masterclass.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button 
                onClick={() => handleExportCSV(paidCustomersList, "Paid Customers")}
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", margin: 0, flex: 1, padding: "10px" }}
              >
                CSV
              </button>
              <button 
                onClick={() => openBroadcastModal(paidCustomersList, "Paid Customers")}
                className="form-btn form-btn--accent" 
                style={{ background: "var(--c-rust)", margin: 0, flex: 1, padding: "10px" }}
              >
                Email
              </button>
            </div>
          </div>

          {/* Segment 2: Cold Leads */}
          <div className="dash-seg-card" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyBetween: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard__role-badge" style={{ background: "transparent", color: "var(--fg-dim)", borderColor: "var(--line-strong)" }}>Cold Segment</span>
                <span style={{ fontSize: "12px", color: "var(--fg-faint)", fontFamily: "JetBrains Mono" }}>{coldLeadsList.length} Contacts</span>
              </div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "17px", fontWeight: "600" }}>Cold Leads</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-dim)", lineHeight: "1.4" }}>
                Users who signed up for accounts but have never reserved any masterclass seats.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button 
                onClick={() => handleExportCSV(coldLeadsList, "Cold Leads")}
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", margin: 0, flex: 1, padding: "10px" }}
              >
                CSV
              </button>
              <button 
                onClick={() => openBroadcastModal(coldLeadsList, "Cold Leads")}
                className="form-btn form-btn--accent" 
                style={{ background: "var(--c-rust)", margin: 0, flex: 1, padding: "10px" }}
              >
                Email
              </button>
            </div>
          </div>

          {/* Segment 3: Working Professionals */}
          <div className="dash-seg-card" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyBetween: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard__role-badge" style={{ background: "rgba(209,138,42,0.12)", color: "var(--c-amber)", borderColor: "var(--c-amber)" }}>B2B Enterprise</span>
                <span style={{ fontSize: "12px", color: "var(--fg-faint)", fontFamily: "JetBrains Mono" }}>{professionalsList.length} Contacts</span>
              </div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "17px", fontWeight: "600" }}>Working Professionals</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-dim)", lineHeight: "1.4" }}>
                Signed up accounts who self-identified as active industry professionals. Ideal for advanced upsells.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button 
                onClick={() => handleExportCSV(professionalsList, "Working Professionals")}
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", margin: 0, flex: 1, padding: "10px" }}
              >
                CSV
              </button>
              <button 
                onClick={() => openBroadcastModal(professionalsList, "Working Professionals")}
                className="form-btn form-btn--accent" 
                style={{ background: "var(--c-rust)", margin: 0, flex: 1, padding: "10px" }}
              >
                Email
              </button>
            </div>
          </div>

          {/* Segment 4: Academic Students */}
          <div className="dash-seg-card" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyBetween: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard__role-badge" style={{ background: "rgba(90,141,118,0.12)", color: "var(--c-emerald)", borderColor: "var(--c-emerald)" }}>B2C Career Prep</span>
                <span style={{ fontSize: "12px", color: "var(--fg-faint)", fontFamily: "JetBrains Mono" }}>{academicStudentsList.length} Contacts</span>
              </div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "17px", fontWeight: "600" }}>Academic Students</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-dim)", lineHeight: "1.4" }}>
                Users currently studying in colleges/universities. Perfect for cohort entry offers and fundamentals.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button 
                onClick={() => handleExportCSV(academicStudentsList, "Academic Students")}
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", margin: 0, flex: 1, padding: "10px" }}
              >
                CSV
              </button>
              <button 
                onClick={() => openBroadcastModal(academicStudentsList, "Academic Students")}
                className="form-btn form-btn--accent" 
                style={{ background: "var(--c-rust)", margin: 0, flex: 1, padding: "10px" }}
              >
                Email
              </button>
            </div>
          </div>

          {/* Segment 5: Abandoned Checkouts */}
          <div className="dash-seg-card" style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", justifyBetween: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="dashboard__role-badge" style={{ background: "rgba(194,83,60,0.12)", color: "var(--c-rust)", borderColor: "var(--c-rust)" }}>Retargeting</span>
                <span style={{ fontSize: "12px", color: "var(--fg-faint)", fontFamily: "JetBrains Mono" }}>{abandonedCheckoutsList.length} Contacts</span>
              </div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "17px", fontWeight: "600" }}>Abandoned Checkout</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-dim)", lineHeight: "1.4" }}>
                Leads who initiated masterclass checkout but never successfully completed payment. High priority conversion leads.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button 
                onClick={() => handleExportCSV(abandonedCheckoutsList, "Abandoned Checkouts")}
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", margin: 0, flex: 1, padding: "10px" }}
              >
                CSV
              </button>
              <button 
                onClick={() => openBroadcastModal(abandonedCheckoutsList, "Abandoned Checkouts")}
                className="form-btn form-btn--accent" 
                style={{ background: "var(--c-rust)", margin: 0, flex: 1, padding: "10px" }}
              >
                Email
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Session Campaign Selector */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", marginTop: "12px" }}>
          <h3 className="form-label" style={{ marginBottom: "12px" }}>Targeted Session Campaign Export</h3>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
            <div style={{ flex: 1, minWidth: "240px" }}>
              <select 
                className="form-select" 
                value={selectedMcCampaignId}
                onChange={e => setSelectedMcCampaignId(e.target.value)}
              >
                <option value="">-- Choose Masterclass Session --</option>
                {(() => {
                  const combined = [];
                  const seen = new Set();
                  [...masterclasses, ...sessions].forEach(s => {
                    if (s && s.id && !seen.has(s.id)) {
                      combined.push(s);
                      seen.add(s.id);
                    }
                  });
                  return combined.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.dateTime ? new Date(s.dateTime).toLocaleDateString() : 'Date TBA'})
                    </option>
                  ));
                })()}
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                type="button"
                onClick={() => {
                  if (!selectedMcCampaignId) {
                    alert("Please choose a masterclass session first.");
                    return;
                  }
                  const cleanRoster = sessionCampaignRoster.map(r => ({
                    name: r.studentName,
                    email: r.studentEmail,
                    phone: r.studentPhone,
                    userType: "Registered Cohort Student"
                  }));
                  handleExportCSV(cleanRoster, activeMcCampaignSession ? activeMcCampaignSession.title : "Masterclass Roster");
                }}
                className="form-btn" 
                disabled={!selectedMcCampaignId}
                style={{ 
                  width: "auto", 
                  margin: 0, 
                  padding: "14px 24px", 
                  background: "transparent",
                  color: selectedMcCampaignId ? "var(--fg)" : "var(--fg-faint)",
                  borderColor: "var(--line-strong)",
                  cursor: selectedMcCampaignId ? "pointer" : "not-allowed"
                }}
              >
                Export CSV
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!selectedMcCampaignId) {
                    alert("Please choose a masterclass session first.");
                    return;
                  }
                  const cleanRoster = sessionCampaignRoster.map(r => ({
                    name: r.studentName,
                    email: r.studentEmail,
                    phone: r.studentPhone,
                    userType: "Registered Cohort Student"
                  }));
                  openBroadcastModal(cleanRoster, activeMcCampaignSession ? activeMcCampaignSession.title : "Masterclass Roster");
                }}
                className="form-btn form-btn--accent" 
                disabled={!selectedMcCampaignId}
                style={{ 
                  width: "auto", 
                  margin: 0, 
                  padding: "14px 24px", 
                  background: "var(--c-rust)",
                  cursor: selectedMcCampaignId ? "pointer" : "not-allowed"
                }}
              >
                Send Email
              </button>
            </div>
          </div>
          {selectedMcCampaignId && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--fg-dim)" }}>
              Campaign Status: <b>{sessionCampaignRoster.length} total registrations</b> recorded for <i>"{activeMcCampaignSession ? activeMcCampaignSession.title : 'Selected Masterclass'}"</i>.
            </div>
          )}
        </div>

        {/* ── Bulk Email from Spreadsheet (Name / Email / Phone upload) ── */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", marginTop: "24px" }}>
          <h3 className="form-label" style={{ marginBottom: "6px" }}>Bulk Email from Spreadsheet</h3>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--fg-dim)", lineHeight: 1.5 }}>
            Upload an Excel/CSV file with <b>Name</b>, <b>Email</b>, and <b>Phone number</b> columns, then email everyone in one click. Sends go out in batches from a secure Cloud Function — use <code style={{ fontFamily: "JetBrains Mono", fontSize: "12px", color: "var(--c-amber)" }}>{"{{name}}"}</code> in the body to personalize.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <label className="form-btn" style={{ width: "auto", margin: 0, padding: "12px 20px", background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", cursor: bulkParsing ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              {bulkRows.length > 0 ? "+ Add another file" : "Choose .xlsx / .csv"}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkFile} disabled={bulkParsing || bulkSending} style={{ display: "none" }} />
            </label>
            {bulkParsing && <span style={{ fontSize: "13px", color: "var(--fg-dim)" }}>Parsing…</span>}
            {bulkRows.length > 0 && !bulkParsing && (
              <button type="button" onClick={handleClearBulkList} disabled={bulkSending} style={{ background: "transparent", border: "none", color: "var(--fg-faint)", fontSize: "13px", cursor: bulkSending ? "not-allowed" : "pointer", textDecoration: "underline", padding: 0 }}>
                Clear list
              </button>
            )}
          </div>

          {bulkFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              {bulkFiles.map((f, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontFamily: "JetBrains Mono", color: "var(--fg-dim)", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "6px", padding: "4px 10px" }}>
                  📄 {f.name} <span style={{ color: "var(--c-emerald)" }}>+{f.added}</span>
                </span>
              ))}
            </div>
          )}

          {bulkNote && (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--fg-dim)" }}>ℹ {bulkNote}</p>
          )}

          {bulkParseError && (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--c-rust)" }}>⚠ {bulkParseError}</p>
          )}

          {bulkRows.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "13px", color: "var(--fg-dim)", marginBottom: "10px" }}>
                <b style={{ color: "var(--c-emerald)" }}>{bulkRows.length}</b> valid recipient{bulkRows.length === 1 ? "" : "s"} ready{bulkFiles.length > 1 ? ` across ${bulkFiles.length} files` : ""}
              </div>

              {bulkPreviewTable}

              {/* Optional attachment — sent with every email in this campaign. */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", margin: "16px 0 4px" }}>
                {bulkAttachment ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "JetBrains Mono", color: "var(--fg-dim)", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "6px", padding: "6px 10px" }}>
                    {bulkAttachment.filename} <span style={{ color: "var(--fg-faint)" }}>({(bulkAttachment.size / 1024).toFixed(0)}KB)</span>
                    <button type="button" onClick={() => setBulkAttachment(null)} disabled={bulkSending} title="Remove attachment" style={{ background: "transparent", border: "none", color: "var(--c-rust)", cursor: bulkSending ? "not-allowed" : "pointer", padding: 0, fontSize: "13px" }}>✕</button>
                  </span>
                ) : (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--fg-dim)", cursor: bulkSending ? "wait" : "pointer", textDecoration: "underline" }}>
                    Attach a file (optional, ≤5MB)
                    <input type="file" onChange={handleBulkAttachment} disabled={bulkSending} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              <EmailComposer
                subjectPlaceholder="e.g. A new AI Engineering cohort is opening 🚀"
                bodyPlaceholder={"Hi {{name}},\n\nWe just opened enrollment for…"}
                bodyRows={8}
                buttonLabel={`Send to ${bulkRows.length} recipient${bulkRows.length === 1 ? "" : "s"}`}
                sending={bulkSending}
                onSend={handleSendBulkEmail}
              />
            </div>
          )}

          {bulkError && (
            <p style={{ marginTop: "14px", fontSize: "13px", color: "var(--c-rust)" }}>⚠ {bulkError}</p>
          )}
          {bulkSuccess && (
            <p style={{ marginTop: "14px", fontSize: "13px", color: "var(--c-emerald)", lineHeight: 1.5 }}>✓ {bulkSuccess}</p>
          )}
        </div>

        {/* ── Saved Contacts (reusable audience built from spreadsheet sends) ── */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", marginTop: "24px" }}>
          <h3 className="form-label" style={{ marginBottom: "6px" }}>Saved Contacts</h3>
          <p style={{ fontSize: "13px", color: "var(--fg-dim)", margin: "0 0 14px" }}>
            Every recipient you email via spreadsheet upload is saved here (deduped by email). Re-email the whole list anytime — no re-upload needed.
          </p>

          {savedContacts.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--fg-faint)" }}>No saved contacts yet. Send a spreadsheet campaign above and its recipients will appear here.</p>
          ) : (
            <React.Fragment>
              <SavedContactsTable savedContacts={savedContacts} onRemove={handleRemoveSavedContact} />

              <EmailComposer
                subjectPlaceholder="Re-engage your saved audience…"
                bodyPlaceholder={"Hi {{name}},\n\nWe just opened a new cohort…"}
                bodyRows={7}
                buttonLabel={`Email all ${savedContacts.length} saved contact${savedContacts.length === 1 ? "" : "s"}`}
                sending={savedSending}
                onSend={handleEmailSavedContacts}
              />

              {savedError && (<p style={{ marginTop: "14px", fontSize: "13px", color: "var(--c-rust)" }}>⚠ {savedError}</p>)}
              {savedSuccess && (<p style={{ marginTop: "14px", fontSize: "13px", color: "var(--c-emerald)", lineHeight: 1.5 }}>✓ {savedSuccess}</p>)}
            </React.Fragment>
          )}
        </div>
      </div>
      )}

      {/* ═══════════════ WORKSPACE — Enquiries ═══════════════ */}
      {dashSection === 'enquiries' && isAdmin && <AdminEnquiriesPanel />}

      </div>{/* /.dash-workspace */}

      {/* 5. Marketing Email Broadcast Modal — admin only */}
      {isAdmin && showBroadcastModal && (
        <BroadcastModal
          list={broadcastList}
          segmentName={broadcastSegmentName}
          onClose={() => setShowBroadcastModal(false)}
        />
      )}

    </div>
  );
}


// ===============================================================
// ADMIN — Courses tab. Landing-page redesign ("Balaji Chippada —
// Course" design bundle; kept admin-gated until launch): hero with
// enquiry form, trust bar, flagship course card, highlights grid,
// master–detail curriculum, dark projects band, instructor,
// testimonials (hidden until real quotes exist in data.js), pricing
// card, FAQ, newsletter. Content comes from the window.COURSE_*
// globals in data.js; the enquiry form and newsletter both write to
// the open `leads` collection (rules require email + source only).
// ===============================================================
function CoursesSectionHead({ eyebrow, title, sub }) {
  return (
    <div className="cv3-section-head">
      <div className="cv3-eyebrow">{eyebrow}</div>
      <h2 className="cv3-h2">{title}</h2>
      {sub && <p className="cv3-section-sub">{sub}</p>}
    </div>
  );
}

function CoursesEnquiryCard({ onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  // Inline validation — errors surface as fields blur, not only on submit
  const [fieldErr, setFieldErr] = useState({});
  const closeRef = useRef(null);
  const validators = {
    name: (v) => V2_VALIDATE.nameError(v),
    email: (v) => V2_VALIDATE.emailError(v),
    phone: (v) => V2_VALIDATE.phoneError(v, true),
  };
  const blurCheck = (field, value) => {
    if (!value.trim()) return; // empty untouched fields stay quiet until submit
    setFieldErr((prev) => ({ ...prev, [field]: validators[field](value) || '' }));
  };
  const clearErr = (field) => setFieldErr((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const submit = async () => {
    const err = V2_VALIDATE.nameError(name) || V2_VALIDATE.emailError(email) || V2_VALIDATE.phoneError(phone, true);
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    try {
      const db = window.firebase.firestore();
      await db.collection('leads').add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        occupation: role,
        message: message.trim(),
        source: 'course_enquiry',
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      setSent(true);
    } catch (e) {
      console.error('[COURSE ENQUIRY] persistence failed', e);
      setError('Something went wrong — please try again or reach us on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cv3-advisor-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cv3-advisor-dialog" role="dialog" aria-modal="true" aria-labelledby="cv3-advisor-title">
        <button ref={closeRef} type="button" className="cv3-advisor-close" onClick={onClose} aria-label="Close advisor form">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <div className="cv3-enquiry-card">
          <div className="cv3-eyebrow">Course guidance</div>
          <h3 className="cv3-enquiry-title" id="cv3-advisor-title">Talk to a Course Advisor</h3>
          {sent ? (
            <div className="cv3-advisor-success">
              <span className="cv3-advisor-success-icon" aria-hidden="true">✓</span>
              <p className="cv3-enquiry-success">Thanks—your request is in. A course advisor will call you within 24 hours.</p>
              <button type="button" className="cv3-enquiry-send" onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              <p className="cv3-advisor-intro">Share your details and we’ll help you decide whether this course is the right fit.</p>
              <div className="cv3-enquiry-fields">
                <label className={`cv3-field ${fieldErr.name ? 'cv3-field--invalid' : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                  <input type="text" placeholder="Your Name" aria-label="Your name" value={name} aria-invalid={!!fieldErr.name} onChange={(e) => { setName(e.target.value); clearErr('name'); }} onBlur={(e) => blurCheck('name', e.target.value)} />
                </label>
                {fieldErr.name && <p className="cv3-field-err">{fieldErr.name}</p>}
                <label className={`cv3-field ${fieldErr.email ? 'cv3-field--invalid' : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                  <input type="email" placeholder="Email Address" aria-label="Email address" value={email} aria-invalid={!!fieldErr.email} onChange={(e) => { setEmail(e.target.value); clearErr('email'); }} onBlur={(e) => blurCheck('email', e.target.value)} />
                </label>
                {fieldErr.email && <p className="cv3-field-err">{fieldErr.email}</p>}
                <label className={`cv3-field ${fieldErr.phone ? 'cv3-field--invalid' : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5c0 9 6 15 15 15l2-3-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4z" /></svg>
                  <input type="tel" placeholder="Phone Number *" aria-label="Phone number" required value={phone} aria-invalid={!!fieldErr.phone} onChange={(e) => { setPhone(e.target.value); clearErr('phone'); }} onBlur={(e) => blurCheck('phone', e.target.value)} />
                </label>
                {fieldErr.phone && <p className="cv3-field-err">{fieldErr.phone}</p>}
                <label className="cv3-field cv3-field--select">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M9 3h6" /></svg>
                  <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Your occupation">
                    <option value="">I am a…</option>
                    <option>Working professional</option>
                    <option>Student</option>
                    <option>Homemaker</option>
                    <option>Founder / entrepreneur</option>
                    <option>Other</option>
                  </select>
                  <svg className="cv3-field-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </label>
                <label className="cv3-field cv3-field--textarea">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v11H9l-4 3v-3H4z" /></svg>
                  <textarea placeholder="Anything you’d like us to know? (optional)" aria-label="Message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
                <button type="button" className="cv3-enquiry-send" onClick={submit} disabled={loading}>
                  {loading ? 'SENDING…' : 'REQUEST A CALLBACK'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
                </button>
                {error && <p className="cv3-enquiry-error">{error}</p>}
                <div className="cv3-enquiry-note">Your information is secure with us</div>
              </div>
            </>
          )}
        </div>
        {!sent && (
          <a href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer" className="cv3-whatsapp-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.004c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.13.24-3.66-.77-3.08-1.24-5.06-4.4-5.22-4.6-.15-.2-1.25-1.66-1.25-3.17s.79-2.25 1.07-2.56c.28-.3.61-.38.82-.38.2 0 .41 0 .59.01.19.01.44-.07.69.53.24.6.83 2.06.9 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.22.57.35.07.13.07.73-.17 1.4z" /></svg>
            Talk to us on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// Small inline icons for the curriculum section (no icon dependency on this site).
const CV3_ICON = {
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  play: <path d="M5 3.5v17l14-8.5-14-8.5Z" />,
  book: <path d="M12 6.5s-2.5-2-8-1.5v13c5.5-.5 8 1.5 8 1.5s2.5-2 8-1.5v-13c-5.5-.5-8 1.5-8 1.5Zm0 0v13" />,
  search: <path d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />,
  lock: <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v11H5V11Z" />,
  eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  file: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
};

function Cv3Icon({ name, size = 16, fill }) {
  return (
    <svg className="cv3-i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {CV3_ICON[name]}
    </svg>
  );
}

function CoursesCurriculumV3() {
  const allModules = window.COURSE_CURRICULUM || [];
  const D = window.COURSE_DURATION;
  const info = window.COURSE_INFO || {};
  const [sel, setSel] = useState(0);
  const [q, setQ] = useState('');

  // Decorate once — runtime is derived, not stored.
  const modules = React.useMemo(() => allModules.map((mod, i) => ({
    ...mod,
    idx: i,
    secs: D.moduleSecs(mod),
  })), [allModules]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return modules.filter((mod) => {
      if (!needle) return true;
      const hay = `${mod.n} ${mod.title} ${mod.tagline || ''} ${(mod.submodules || []).map((s) => s.title).join(' ')}`;
      return hay.toLowerCase().includes(needle);
    });
  }, [modules, q]);

  // Keep the detail panel on a module that's still visible after filtering.
  const m = modules[sel] || modules[0] || { submodules: [] };
  const active = shown.some((x) => x.idx === sel) ? m : (shown[0] || m);
  const activeHasDuration = active.secs != null;

  // Below the master/detail breakpoint the panel is rendered inline, right under
  // the module you tapped, instead of in a second column far below the list.
  // Same single panel either way — only its parent changes.
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)');
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const detail = (
    <div className={`cv3-curriculum-detail ${stacked ? 'is-inline' : ''}`} key={active.n}>
      <div className="cv3-eyebrow">Module {active.n}</div>
      <h3 className="cv3-detail-title">{active.title}</h3>
      {active.tagline && <p className="cv3-detail-summary">{active.tagline}</p>}
      {active.project && (
        <p className="cv3-detail-project">
          <Cv3Icon name="target" size={16} />
          <span><b>You'll Build:</b> {active.project}</span>
        </p>
      )}
      <div className="cv3-detail-meta">
        {activeHasDuration && (
          <div><Cv3Icon name="play" size={16} fill /><div><b>{D.long(active.secs)}</b><span>Total Duration</span></div></div>
        )}
        <div><Cv3Icon name="book" size={16} /><div><b>{active.submodules.length}</b><span>{active.submodules.length === 1 ? 'Lesson' : 'Lessons'}</span></div></div>
      </div>
      <div className="cv3-detail-lessonhead">
        <span>Lessons in this module</span>
        {activeHasDuration && <span>Duration</span>}
      </div>
      <div className="cv3-detail-lessons">
        {(active.submodules || []).map((sm, i) => {
          const lessonDuration = D.lessonSecs(sm);
          return (
            <div key={sm.n} className="cv3-lesson">
              <span className="cv3-lesson-num">{i + 1}</span>
              <Cv3Icon name="play" size={13} fill />
              <span className="cv3-lesson-text">{sm.title}</span>
              {lessonDuration != null && <span className="cv3-lesson-dur">{D.clock(lessonDuration)}</span>}
              {sm.preview
                ? <><span className="cv3-lesson-badge">Preview</span><span className="cv3-lesson-lock"><Cv3Icon name="eye" size={15} /></span></>
                : <span className="cv3-lesson-lock"><Cv3Icon name="lock" size={15} /></span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="cv3-section" id="cv3-curriculum">
      <div className="cv3-curriculum-head">
        <div>
          <div className="cv3-eyebrow">Curriculum</div>
          <h2 className="cv3-h2">Learn step-by-step. Build real AI skills.</h2>
          <p className="cv3-section-sub">From Python fundamentals to advanced AI systems — master the concepts, tools, and projects used in the real world.</p>
        </div>
        <div className="cv3-curriculum-actions">
          {info.syllabusUrl && (
            <a className="cv3-btn cv3-btn--ghost" href={info.syllabusUrl} target="_blank" rel="noopener noreferrer">
              <Cv3Icon name="file" /> Download Syllabus
            </a>
          )}
          <a className="cv3-btn cv3-btn--accent" href="#cv3-pricing"
            onClick={(e) => { e.preventDefault(); const el = document.getElementById('cv3-pricing'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>
            Start Learning Now <Cv3Icon name="arrow" />
          </a>
        </div>
      </div>

      <div className="cv3-curriculum">
        <div className="cv3-curriculum-pane">
          <div className="cv3-curriculum-filters">
            <div className="cv3-search">
              <Cv3Icon name="search" size={15} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search modules…" aria-label="Search modules" />
            </div>
          </div>
          <div className="cv3-curriculum-list">
            {shown.map((mod) => (
              <React.Fragment key={mod.n}>
                <button type="button"
                  className={`cv3-mod ${mod.idx === active.idx ? 'is-active' : ''}`}
                  aria-expanded={stacked ? mod.idx === active.idx : undefined}
                  onClick={() => setSel(mod.idx)}>
                  <span className="cv3-mod-num">{mod.n}</span>
                  <span className="cv3-mod-title">{mod.title}</span>
                  <span className="cv3-mod-meta">
                    <span><Cv3Icon name="book" size={14} /> {mod.submodules.length} lesson{mod.submodules.length === 1 ? '' : 's'}</span>
                    {mod.secs != null && <span><Cv3Icon name="clock" size={14} /> {D.long(mod.secs)}</span>}
                  </span>
                </button>
                {stacked && mod.idx === active.idx && detail}
              </React.Fragment>
            ))}
            {!shown.length && <p className="cv3-curriculum-empty">No modules match “{q}”.</p>}
          </div>
        </div>

        {!stacked && detail}
      </div>
    </section>
  );
}

function CoursesTestimonials() {
  const items = window.COURSE_TESTIMONIALS || [];
  if (!items.length) return null;
  return (
    <section className="cv3-section">
      <CoursesSectionHead eyebrow="Testimonials" title="Engineers who stopped guessing" />
      <div className="cv3-testimonials">
        {items.map((t, i) => (
          <div key={i} className="cv3-quote-card">
            <p className="cv3-quote">&ldquo;{t.quote}&rdquo;</p>
            <div className="cv3-quote-who">
              <span className="cv3-quote-avatar">{(t.name || '?').charAt(0)}</span>
              <div>
                <div className="cv3-quote-name">{t.name}</div>
                <div className="cv3-quote-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoursesCertificateSection() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!previewOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPreviewOpen(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [previewOpen]);

  const requirements = [
    'Complete the full course',
    'Have every assignment reviewed and approved',
    'Complete all mock interviews',
  ];

  return (
    <section className="cv3-section cv3-certificate" id="cv3-certificate" aria-labelledby="cv3-certificate-title">
      <div className="cv3-certificate-layout">
        <div className="cv3-certificate-copy">
          <div className="cv3-eyebrow">Course credential</div>
          <h2 className="cv3-h2" id="cv3-certificate-title">Earn a certificate <em>that means something.</em></h2>
          <p className="cv3-certificate-intro">
            This is not a participation certificate. It is awarded only after you demonstrate that you completed the work.
          </p>
          <div className="cv3-certificate-requirements">
            {requirements.map((requirement) => (
              <div className="cv3-certificate-requirement" key={requirement}>
                <span className="cv3-certificate-check" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                </span>
                <span>{requirement}</span>
              </div>
            ))}
          </div>
          <p className="cv3-certificate-note">
            That standard protects the certificate&rsquo;s authenticity and ensures it represents demonstrated, practical skills.
          </p>
        </div>

        <button
          type="button"
          className="cv3-certificate-preview"
          aria-haspopup="dialog"
          aria-controls="cv3-certificate-preview-dialog"
          onClick={() => setPreviewOpen(true)}
        >
          <span className="cv3-certificate-sample">Sample certificate</span>
          <img
            className="cv3-certificate-image"
            src="logos/FLA Course Completion Certificate.svg"
            alt="Sample Forward Learning Academy course completion certificate"
            loading="lazy"
            decoding="async"
          />
          <span className="cv3-certificate-view">
            View full size
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
            </svg>
          </span>
        </button>
      </div>

      {previewOpen && (
        <div className="cv3-certificate-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
          <div
            className="cv3-certificate-dialog"
            id="cv3-certificate-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv3-certificate-preview-title"
          >
            <div className="cv3-certificate-dialog-head">
              <h3 id="cv3-certificate-preview-title">Sample course completion certificate</h3>
              <button ref={closeRef} type="button" className="cv3-certificate-close" onClick={() => setPreviewOpen(false)} aria-label="Close certificate preview">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <img
              className="cv3-certificate-dialog-image"
              src="logos/FLA Course Completion Certificate.svg"
              alt="Sample Forward Learning Academy course completion certificate"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function CoursesFAQ() {
  const faqs = window.COURSE_FAQ || [];
  const [open, setOpen] = useState(-1);
  if (!faqs.length) return null;
  return (
    <section className="cv3-section cv3-section--narrow" id="cv3-faq">
      <CoursesSectionHead eyebrow="Got questions?" title="Frequently Asked Questions" />
      <div className="cv3-faq-list">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`cv3-faq-item ${isOpen ? 'is-open' : ''}`}>
              <button type="button" className="cv3-faq-q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
                <span className="cv3-faq-q-text">{f.q}</span>
                <span className="cv3-faq-plus" aria-hidden="true">+</span>
              </button>
              <div className="cv3-faq-a"><p>{f.a}</p></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CoursesTabView({ setActiveMainTab, setLegalPage }) {
  const info = window.COURSE_INFO || {};
  const projects = window.COURSE_PROJECTS || [];
  const instr = window.COURSE_INSTRUCTOR || {};
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Runtime-only motion: scroll reveal + hero stat count-up. Gated on
  // navigator.webdriver so the prerender (puppeteer) never bakes hidden
  // reveal classes or mid-animation numbers into the static SEO HTML.
  // Classes are stripped after settle so hover transforms keep working.
  useEffect(() => {
    if (navigator.webdriver) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let io = null;
    if (!reduced && 'IntersectionObserver' in window) {
      const targets = document.querySelectorAll('.cv3-section, .cv3-trust-inner, .cv3-projects-inner, .cv3-instructor-inner');
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('cv3-in');
          io.unobserve(en.target);
          setTimeout(() => en.target.classList.remove('cv3-armed', 'cv3-in'), 1400);
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -40px' });
      targets.forEach((el) => {
        // never arm anything already on screen — no flash, hero untouched
        if (el.getBoundingClientRect().top > window.innerHeight) {
          el.classList.add('cv3-armed');
          io.observe(el);
        }
      });
    }

    // Count-up on the hero stats ("35K+" → 0→35 keeping the K+ suffix)
    const raf = [];
    if (!reduced) {
      document.querySelectorAll('.cv3-stat-num').forEach((el) => {
        const m = (el.textContent || '').match(/^([^0-9]*)([0-9]+)(.*)$/);
        if (!m) return;
        const target = parseInt(m[2], 10);
        const t0 = performance.now();
        const dur = 900;
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = m[1] + Math.round(target * eased) + m[3];
          if (p < 1) raf.push(requestAnimationFrame(tick));
        };
        raf.push(requestAnimationFrame(tick));
      });
    }

    return () => {
      if (io) io.disconnect();
      raf.forEach((id) => cancelAnimationFrame(id));
      document.querySelectorAll('.cv3-armed').forEach((el) => el.classList.remove('cv3-armed', 'cv3-in'));
    };
  }, []);
  const priceFmt = (n) => (typeof n === 'number' ? '₹' + n.toLocaleString('en-IN') : n);
  const scrollToId = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const highlights = [
    ['Full course access', '2 years of access to all modules and updates.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0z" /><path d="M22 6c-3-1.5-6-1.5-9 0v13c3-1.5 6-1.5 9 0z" /></svg>],
    ['Live & office hours', 'Regular live sessions to clear doubts.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>],
    ['Code & projects', 'Hands-on projects with production-ready code.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></svg>],
    ['Assignments', 'Practical assignments to reinforce learning.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" /><path d="m9 14 2 2 4-4" /></svg>],
    ['Certificate', 'Shareable certificate upon course completion.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" /></svg>],
    ['2 years of access', 'Learn at your own pace, no rush.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 8c-2.5 0-4 2-4 4s1.5 4 4 4c3 0 5-8 10-8 2.5 0 4 2 4 4s-1.5 4-4 4c-5 0-7-8-10-8z" /></svg>],
    ['Community & network', 'Connect with learners and AI builders.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>],
    ['More & freebies', 'Templates, cheat sheets and exclusive resources.', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M20 12v9H4v-9" /><path d="M12 8C12 5 10 3 8 3a2.5 2.5 0 0 0 0 5zM12 8c0-3 2-5 4-5a2.5 2.5 0 0 1 0 5z" /></svg>],
  ];

  const heroStats = [
    [V2_SOCIAL.youtubeSubs, 'YouTube learners', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>],
    ['9 yrs', 'Production experience', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>],
    ['100%', 'Hands-on projects', <svg key="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m12 2 2.9 6.3 6.9.9-5 4.8 1.3 6.9-6.1-3.4-6.1 3.4 1.3-6.9-5-4.8 6.9-.9z" /></svg>],
  ];

  return (
    <div className="cv3">
      {/* HERO — creator-led pitch + course outcomes orbit */}
      <header className="cv3-hero">
        <div className="cv3-hero-left">
          <h1 className="cv3-hero-title">Build production-grade <em>Agentic AI</em> with someone who ships it.</h1>
          <p className="cv3-hero-sub">
            Learn directly from Balaji Chippada to architect, evaluate, and deploy reliable AI agents — from first principles to production monitoring.
          </p>
          <div className="cv3-hero-ctas">
            <a href="#cv3-pricing" className="cv3-btn cv3-btn--accent" onClick={scrollToId('cv3-pricing')}>
              Enroll Now
              <svg className="cv3-hero-cta-chevrons" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 5 7 7-7 7" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <button type="button" className="cv3-btn cv3-btn--advisor" onClick={() => setAdvisorOpen(true)}>
              <svg className="cv3-advisor-cta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5c0 9 6 15 15 15l2-3-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4z" />
              </svg>
              Talk to an Advisor
            </button>
          </div>
        </div>
        <div className="cv3-creator-visual">
          <img
            className="cv3-creator-art cv3-creator-art--light"
            src="uploads/Hero_section_light.png"
            alt="Balaji Chippada surrounded by the Agentic AI skills taught in the course"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
          <img
            className="cv3-creator-art cv3-creator-art--dark"
            src="uploads/Hero_Section_Dark_mODE.png"
            alt="Balaji Chippada surrounded by the Agentic AI skills taught in the course"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
        </div>
        <div className="cv3-hero-proof">
          <div className="cv3-hero-stats">
            {heroStats.map(([num, label, icon]) => (
              <div key={label} className="cv3-hero-stat">
                <span className="cv3-hero-stat-icon" aria-hidden="true">{icon}</span>
                <div><div className="cv3-stat-num">{num}</div><div className="cv3-stat-label">{label}</div></div>
              </div>
            ))}
          </div>
        </div>
      </header>
      {advisorOpen && <CoursesEnquiryCard onClose={() => setAdvisorOpen(false)} />}

      {/* TRUST BAR */}
      <section className="cv3-trust">
        <div className="cv3-trust-inner">
          <span className="cv3-trust-label">Built from experience at</span>
          <div className="cv3-trust-logos">
            <img className="cv3-logo-crest" src="/logos/iitg.svg" alt="IIT Guwahati" />
            <img className="cv3-logo-crest" src="/logos/iima.svg" alt="IIM Ahmedabad" />
            <img className="cv3-logo-crest" src="/logos/nitc.svg" alt="NIT Calicut" />
            <img src="/logos/amazon.svg" alt="Amazon" />
            <img src="/logos/wbd.svg" alt="Warner Bros. Discovery" />
            <img src="/logos/tmobile.svg" alt="T-Mobile" />
            <img src="/logos/infosys.svg" alt="Infosys" />
            <img src="/logos/swisscom.svg" alt="Swisscom" />
            <img src="/logos/appliedai.png" alt="Applied AI Course" />
          </div>
        </div>
      </section>

      {/* FLAGSHIP COURSE CARD */}
      <section className="cv3-section" id="cv3-course">
        <CoursesSectionHead eyebrow="The course" title="One deep, opinionated program on shipping agents" />
        <div className="cv3-flagship">
          <div className="cv3-flagship-main">
            <div className="cv3-flagship-badge">FLAGSHIP</div>
            <h3 className="cv3-flagship-title">{info.flagshipName}</h3>
            <p className="cv3-flagship-desc">A production-first engineering course. Design agent architectures, wire up tools and memory, orchestrate multiple agents, and stand up evals, guardrails, and monitoring you can trust in front of real users.</p>
            <div className="cv3-flagship-facts">
              {(info.facts || []).map((f) => (
                <div key={f.k} className="cv3-fact">
                  <span className="cv3-fact-dot" aria-hidden="true" />
                  <div><div className="cv3-fact-k">{f.k}</div><div className="cv3-fact-v">{f.v}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="cv3-flagship-side">
            <div>
              <div className="cv3-price-label">One-time payment</div>
              <div className="cv3-price">{priceFmt(info.price)}</div>
              <div className="cv3-price-note">Inclusive of GST · No subscription</div>
            </div>
            <a href="#cv3-pricing" className="cv3-btn cv3-btn--accent" onClick={scrollToId('cv3-pricing')}>Enroll now</a>
            <div className="cv3-flagship-includes">
              {(info.includes || []).map((inc) => (
                <div key={inc} className="cv3-check-row"><span className="cv3-check" aria-hidden="true">✓</span>{inc}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CURRICULUM — master/detail */}
      <CoursesCurriculumV3 />

      {/* PROJECTS — dark band */}
      <section className="cv3-projects" id="cv3-projects">
        <div className="cv3-projects-inner">
          <div className="cv3-section-head">
            <div className="cv3-eyebrow cv3-eyebrow--on-dark">Hands-on</div>
            <h2 className="cv3-h2 cv3-h2--on-dark">Projects <em>you will build.</em></h2>
            <p className="cv3-section-sub cv3-section-sub--on-dark">Every module ends with something running. You leave with a portfolio of production-grade agents.</p>
          </div>
          <div className="cv3-projects-grid" id="cv3-projects-grid">
            {projects.slice(0, showAllProjects ? projects.length : 6).map((p) => (
              <div key={p.num} className="cv3-project">
                <div className={`cv3-project-visual ${p.lightImage && p.darkImage ? 'cv3-project-visual--art' : ''}`} aria-hidden="true">
                  {p.lightImage && p.darkImage ? (
                    <>
                      <img className="cv3-project-art cv3-project-art--light" src={p.lightImage} alt="" loading="lazy" decoding="async" />
                      <img className="cv3-project-art cv3-project-art--dark" src={p.darkImage} alt="" loading="lazy" decoding="async" />
                    </>
                  ) : (
                    <>
                      <div className="cv3-project-dots"><span /><span /><span /></div>
                      <div className="cv3-project-lines"><i /><i /><i /></div>
                    </>
                  )}
                </div>
                <div className="cv3-project-num">{p.num}</div>
                <div className="cv3-project-title">{p.title}</div>
                <div className="cv3-project-desc">{p.desc}</div>
                <div className="cv3-project-tags">
                  {(p.tags || []).map((tag) => <span key={tag} className="cv3-project-tag">{tag}</span>)}
                </div>
              </div>
            ))}
          </div>
          {projects.length > 6 && (
            <button
              type="button"
              className="cv3-btn cv3-btn--advisor cv3-projects-more"
              aria-expanded={showAllProjects}
              aria-controls="cv3-projects-grid"
              onClick={() => setShowAllProjects((visible) => !visible)}
            >
              {showAllProjects ? 'Show fewer projects' : `View all ${projects.length} projects`}
            </button>
          )}
        </div>
      </section>

      {/* CERTIFICATE — earned after approved assignments + mock interviews */}
      <CoursesCertificateSection />

      {/* HIGHLIGHTS */}
      <section className="cv3-section" id="cv3-highlights">
        <CoursesSectionHead eyebrow="What you'll get" title="Course highlights" sub="Everything you need to build, ship and scale production-grade AI agents" />
        <div className="cv3-highlights">
          {highlights.map(([label, desc, icon]) => (
            <div key={label} className="cv3-highlight">
              <span className="cv3-highlight-icon">{icon}</span>
              <div className="cv3-highlight-body">
                <div className="cv3-highlight-label">{label}</div>
                <div className="cv3-highlight-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INSTRUCTOR — shared section (also used on Home + Full Roadmap) */}
      <CoursesInstructorSection />

      {/* TESTIMONIALS — hidden until real quotes exist in data.js */}
      <CoursesTestimonials />

      {/* PRICING */}
      <section className="cv3-section" id="cv3-pricing">
        <CoursesSectionHead eyebrow="Pricing" title="One price. Everything included." />
        <div className="cv3-pricing-card">
          <span className="cv3-pricing-pill">Full access for 2 years</span>
          <div className="cv3-pricing-name">{info.flagshipName}</div>
          <div className="cv3-pricing-price">{priceFmt(info.price)}</div>
          <div className="cv3-price-note">One-time payment · Inclusive of GST · No subscription</div>
          <button type="button" className="cv3-btn cv3-btn--accent cv3-pricing-cta" disabled style={{ cursor: "default", opacity: 0.7 }}>Enrollment opening soon</button>
          <div className="cv3-pricing-features">
            {(info.pricingIncludes || []).map((feat) => (
              <div key={feat} className="cv3-check-row"><span className="cv3-check" aria-hidden="true">✓</span>{feat}</div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <CoursesFAQ />

    </div>
  );
}

// ===============================================================
// ADMIN — Course enquiries panel. Live list of `leads` docs with
// source == 'course_enquiry' (written by the Courses tab enquiry
// form), message text shown in full. Owns its own state — don't
// fold this into DashboardView (see CLAUDE.md re-render warning).
// ===============================================================
// ===============================================================
// ADMIN — Roadmap Video Linker. Own component (not DashboardView
// state) so typing in these fields only re-renders this panel —
// see the DashboardView re-render warning in CLAUDE.md.
// ===============================================================
function RoadmapVideosAdminPanel({ user }) {
  const [roadmapVideoDocs, setRoadmapVideoDocs] = useState([]);
  const [rvPhaseId, setRvPhaseId] = useState(1);
  const [rvModules, setRvModules] = useState([]);
  const [rvUrl, setRvUrl] = useState("");
  const [rvTitle, setRvTitle] = useState("");
  const [rvStartTs, setRvStartTs] = useState("");
  const [rvKind, setRvKind] = useState("deep-dive");
  const [rvCodeUrl, setRvCodeUrl] = useState("");
  const [rvSaving, setRvSaving] = useState(false);
  const [rvFilter, setRvFilter] = useState("");
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!db) return;
    const unsub = db.collection('roadmapVideos').onSnapshot((snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setRoadmapVideoDocs(list);
    }, () => setRoadmapVideoDocs([]));
    return () => unsub();
  }, []);

  const rvPhaseSections = (window.ROADMAP || []).find((p) => p.id === rvPhaseId)?.sections || [];

  const handleRvPhaseChange = (pid) => {
    setRvPhaseId(Number(pid));
    setRvModules([]);
  };

  const toggleRvModule = (modN) => {
    setRvModules((prev) => (
      prev.includes(modN) ? prev.filter((m) => m !== modN) : [...prev, modN]
    ));
  };

  const fetchYouTubeTitle = async (urlOrId, isPlaylist) => {
    try {
      const url = isPlaylist
        ? (urlOrId.includes('list=') ? urlOrId : `https://www.youtube.com/playlist?list=${urlOrId}`)
        : (urlOrId.includes('youtube') ? urlOrId : `https://www.youtube.com/watch?v=${urlOrId}`);
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        return data.title || '';
      }
    } catch (_) {}
    return '';
  };

  const handleLinkRoadmapVideo = async (e) => {
    e.preventDefault();
    const H = window.ROADMAP_VIDEO_HELPERS || {};
    const playlistId = H.parseYouTubePlaylistId ? H.parseYouTubePlaylistId(rvUrl) : null;
    const youtubeId = playlistId ? null : (H.parseYouTubeId ? H.parseYouTubeId(rvUrl) : null);
    if (!youtubeId && !playlistId) {
      setStatus({ type: 'error', message: 'Paste a valid YouTube video or playlist URL.' });
      return;
    }
    if (!rvModules.length) {
      setStatus({ type: 'error', message: 'Select at least one module.' });
      return;
    }
    setRvSaving(true);
    try {
      let title = rvTitle.trim();
      const kind = rvKind === 'playlist' || playlistId ? 'playlist' : rvKind;
      if (!title) title = await fetchYouTubeTitle(rvUrl, Boolean(playlistId));
      if (!title) title = playlistId ? `YouTube playlist ${playlistId}` : `YouTube video ${youtubeId}`;
      const startSec = H.parseTimestamp ? H.parseTimestamp(rvStartTs) : 0;
      await db.collection('roadmapVideos').add({
        youtubeId: youtubeId || null,
        playlistId: playlistId || null,
        title,
        kind,
        phaseId: rvPhaseId,
        capstoneId: null,
        modules: rvModules.slice().sort(),
        startSec,
        endSec: null,
        codeUrl: rvCodeUrl.trim() || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user?.uid || '',
      });
      setRvUrl('');
      setRvTitle('');
      setRvStartTs('');
      setRvCodeUrl('');
      setRvModules([]);
      setStatus({ type: 'success', message: 'Video linked to roadmap modules.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to save video link.' });
    } finally {
      setRvSaving(false);
    }
  };

  const handleDeleteRoadmapVideo = async (docId, title) => {
    if (!window.confirm(`Remove video link "${title}"?`)) return;
    try {
      await db.collection('roadmapVideos').doc(docId).delete();
      setStatus({ type: 'success', message: 'Video link removed.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to delete.' });
    }
  };

  return (
    <div id="dash-videos" className="dashboard__panel roadmap-admin-panel">
      <h2 className="dashboard__panel-title">Roadmap Videos</h2>
      <p className="hero__sub" style={{ marginTop: '4px', fontSize: '14px', color: 'var(--fg-dim)' }}>
        Link YouTube videos to phases and modules. Changes appear on the Full Roadmap tab immediately.
      </p>
      {status.message && (
        <div className={`status-box status-box--${status.type}`}>
          <span>{status.type === 'success' ? '✔' : '⚠'}</span>
          <span>{status.message}</span>
        </div>
      )}
      <form className="roadmap-admin-form" onSubmit={handleLinkRoadmapVideo}>
        <div className="form-group">
          <label className="form-label">Phase</label>
          <select className="form-select" value={rvPhaseId} onChange={(e) => handleRvPhaseChange(e.target.value)}>
            {(window.ROADMAP || []).map((p) => (
              <option key={p.id} value={p.id}>Phase {String(p.id).padStart(2, '0')} · {p.title}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Modules (select all covered in this video)</label>
          <div className="roadmap-admin-modules">
            {rvPhaseSections.map((s) => (
              <label key={s.n} className="roadmap-admin-module-check">
                <input
                  type="checkbox"
                  checked={rvModules.includes(s.n)}
                  onChange={() => toggleRvModule(s.n)}
                />
                <span>{s.n} · {s.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="dashboard__grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">YouTube URL</label>
            <input className="form-input" value={rvUrl} onChange={(e) => setRvUrl(e.target.value)} placeholder="Video or playlist URL" required />
          </div>
          <div className="form-group">
            <label className="form-label">Title (optional — auto-fetched)</label>
            <input className="form-input" value={rvTitle} onChange={(e) => setRvTitle(e.target.value)} placeholder="Video title" />
          </div>
          <div className="form-group">
            <label className="form-label">Start timestamp (MM:SS)</label>
            <input className="form-input" value={rvStartTs} onChange={(e) => setRvStartTs(e.target.value)} placeholder="14:38" />
          </div>
          <div className="form-group">
            <label className="form-label">Kind</label>
            <select className="form-select" value={rvKind} onChange={(e) => setRvKind(e.target.value)}>
              <option value="deep-dive">Deep dive</option>
              <option value="playlist">Playlist</option>
              <option value="overview">Overview</option>
              <option value="capstone">Capstone</option>
              <option value="supplement">Supplement</option>
            </select>
          </div>
          {rvKind !== 'playlist' && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Link to code (optional — this single video's GitHub / repo URL)</label>
              <input className="form-input" value={rvCodeUrl} onChange={(e) => setRvCodeUrl(e.target.value)} placeholder="https://github.com/…" />
              <p className="form-hint" style={{ fontSize: '12px', color: 'var(--fg-faint)', margin: '6px 0 0' }}>For playlists, add a code link per video in the “Per-video code links” section below.</p>
            </div>
          )}
        </div>
        <button type="submit" className="form-btn" disabled={rvSaving}>{rvSaving ? 'Linking…' : 'Link video'}</button>
      </form>

      <div className="roadmap-admin-list" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Linked videos ({roadmapVideoDocs.length})</h3>
          <input className="form-input" style={{ maxWidth: '220px' }} placeholder="Filter…" value={rvFilter} onChange={(e) => setRvFilter(e.target.value)} />
        </div>
        {roadmapVideoDocs.filter((d) => {
          if (!rvFilter.trim()) return true;
          const q = rvFilter.toLowerCase();
          return (d.title || '').toLowerCase().includes(q) || (d.modules || []).join(' ').includes(q);
        }).map((doc) => (
          <div key={doc.id} className="roadmap-admin-list-item">
            <div>
              <strong>{doc.title}</strong>
              <div style={{ fontSize: '12px', color: 'var(--fg-dim)', marginTop: '4px' }}>
                Phase {doc.phaseId} · {(doc.modules || []).join(', ')} · {doc.kind}
                {doc.playlistId ? ` · playlist ${doc.playlistId}` : ''}
                {doc.startSec ? ` · @ ${(window.ROADMAP_VIDEO_HELPERS || {}).formatTimestamp?.(doc.startSec) || doc.startSec}` : ''}
                {doc.codeUrl ? <> · <a href={doc.codeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-rust)' }}>code ↗</a></> : ''}
              </div>
            </div>
            <button type="button" className="dashboard__logout-btn" onClick={() => handleDeleteRoadmapVideo(doc.id, doc.title)}>Remove</button>
          </div>
        ))}
        {roadmapVideoDocs.length === 0 && (
          <p style={{ color: 'var(--fg-faint)', fontSize: '13px' }}>No admin-linked videos yet. Seed data from videos.js still shows on the roadmap.</p>
        )}
      </div>
    </div>
  );
}

// ===============================================================
// ADMIN — Per-video "Link to code" manager. Same extraction
// rationale as RoadmapVideosAdminPanel.
// ===============================================================
function VideoCodeLinksAdminPanel({ user }) {
  const [vcUrl, setVcUrl] = useState("");
  const [vcCodeUrl, setVcCodeUrl] = useState("");
  const [vcSaving, setVcSaving] = useState(false);
  const [videoCodeDocs, setVideoCodeDocs] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!db) return;
    const unsub = db.collection('videoCodeLinks').onSnapshot((snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setVideoCodeDocs(list);
    }, () => setVideoCodeDocs([]));
    return () => unsub();
  }, []);

  const handleSaveVideoCodeLink = async (e) => {
    e.preventDefault();
    const H = window.ROADMAP_VIDEO_HELPERS || {};
    const videoId = H.parseYouTubeId ? H.parseYouTubeId(vcUrl.trim()) : null;
    const code = vcCodeUrl.trim();
    if (!videoId) { setStatus({ type: 'error', message: 'Paste a valid YouTube VIDEO URL (a single video, not a playlist).' }); return; }
    if (!code) { setStatus({ type: 'error', message: 'Enter the code (repo) URL.' }); return; }
    setVcSaving(true);
    try {
      await db.collection('videoCodeLinks').doc(videoId).set({
        videoId,
        codeUrl: code,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user?.uid || '',
      }, { merge: true });
      setVcUrl('');
      setVcCodeUrl('');
      setStatus({ type: 'success', message: `Code link saved for video ${videoId}.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to save code link.' });
    } finally {
      setVcSaving(false);
    }
  };

  const handleDeleteVideoCodeLink = async (videoId) => {
    try { await db.collection('videoCodeLinks').doc(videoId).delete(); }
    catch (err) { setStatus({ type: 'error', message: err.message || 'Failed to remove code link.' }); }
  };

  return (
    <div id="dash-code-links" className="dashboard__panel roadmap-admin-panel">
      <h2 className="dashboard__panel-title" style={{ marginBottom: '6px' }}>Per-video code links</h2>
      <p style={{ fontSize: '13px', color: 'var(--fg-dim)', margin: '0 0 16px' }}>
        Add a “Link to code” button to any individual video by its URL — including each video inside a playlist. Paste the single video’s YouTube link (not the playlist link).
      </p>
      {status.message && (
        <div className={`status-box status-box--${status.type}`}>
          <span>{status.type === 'success' ? '✔' : '⚠'}</span>
          <span>{status.message}</span>
        </div>
      )}
      <form className="roadmap-admin-form" onSubmit={handleSaveVideoCodeLink}>
        <div className="dashboard__grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">YouTube video URL</label>
            <input className="form-input" value={vcUrl} onChange={(e) => setVcUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required />
          </div>
          <div className="form-group">
            <label className="form-label">Code (repo) URL</label>
            <input className="form-input" value={vcCodeUrl} onChange={(e) => setVcCodeUrl(e.target.value)} placeholder="https://github.com/…" required />
          </div>
        </div>
        <button type="submit" className="form-btn" disabled={vcSaving}>{vcSaving ? 'Saving…' : 'Save code link'}</button>
      </form>

      <div className="roadmap-admin-list" style={{ marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Saved code links ({videoCodeDocs.length})</h3>
        {videoCodeDocs.map((doc) => (
          <div key={doc.id} className="roadmap-admin-list-item">
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{doc.id}</strong>
              <div style={{ fontSize: '12px', color: 'var(--fg-dim)', marginTop: '4px', wordBreak: 'break-all' }}>
                <a href={doc.codeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-rust)' }}>{doc.codeUrl}</a>
              </div>
            </div>
            <button type="button" className="dashboard__logout-btn" onClick={() => handleDeleteVideoCodeLink(doc.id)}>Remove</button>
          </div>
        ))}
        {videoCodeDocs.length === 0 && (
          <p style={{ color: 'var(--fg-faint)', fontSize: '13px' }}>No per-video code links yet.</p>
        )}
      </div>
    </div>
  );
}

RoadmapVideosAdminPanel = React.memo(RoadmapVideosAdminPanel);
VideoCodeLinksAdminPanel = React.memo(VideoCodeLinksAdminPanel);

// Per-enquiry reply composer. Reuses the sendBulkEmail callable with a
// single recipient — same Resend pipeline, admin-gated server-side, and
// the send shows up in Email Tasks like any other job. Owns its own
// state so typing never re-renders the enquiries list.
function EnquiryReplyBox({ enquiry }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('Re: Your course enquiry');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }
  const [drafting, setDrafting] = useState(false);

  // AI draft — the generateEnquiryReply callable applies the student-mentor-reply
  // skill and returns { subject, body }. It only fills the composer; the admin
  // still reads it and presses Send.
  const generate = async () => {
    setDrafting(true);
    setStatus(null);
    try {
      // gpt-5 reasoning takes ~40s on a full enquiry; the callable's 70s
      // client default is too tight, so raise it well clear of the server's 300s.
      const res = await functions.httpsCallable('generateEnquiryReply', { timeout: 240000 })({ enquiryId: enquiry.id });
      setSubject(res.data.subject || subject);
      setBody(res.data.body || '');
      setOpen(true);
    } catch (e) {
      console.error('[ENQUIRY REPLY] draft failed:', e);
      setStatus({ ok: false, msg: e.message || 'Could not generate a draft.' });
    }
    setDrafting(false);
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      setStatus({ ok: false, msg: 'Subject and message are both required.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await functions.httpsCallable('sendBulkEmail')({
        subject: subject.trim(),
        body,
        label: `Enquiry reply — ${enquiry.email}`,
        recipients: [{ name: enquiry.name || '', email: enquiry.email }],
      });
      // Log the reply on the lead doc so the conversation thread survives.
      // arrayUnion can't hold serverTimestamp, so sentAt is client epoch ms.
      try {
        await db.collection('leads').doc(enquiry.id).update({
          replies: firebase.firestore.FieldValue.arrayUnion({
            direction: 'out',
            subject: subject.trim(),
            body,
            sentAt: Date.now(),
            by: (auth && auth.currentUser && auth.currentUser.email) || 'admin',
          }),
        });
      } catch (logErr) {
        console.error('[ENQUIRY REPLY] sent but could not log to thread:', logErr);
      }
      setStatus({ ok: true, msg: `Reply sent to ${enquiry.email}.` });
      setBody('');
      setOpen(false);
    } catch (e) {
      console.error('[ENQUIRY REPLY] send failed:', e);
      setStatus({ ok: false, msg: e.message || 'Could not send the reply.' });
    }
    setSending(false);
  };

  return (
    <div style={{ marginTop: '12px' }}>
      {!open && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="form-btn"
            onClick={() => { setOpen(true); setStatus(null); }}
            style={{ background: 'transparent', border: '1px solid var(--line-strong)', color: 'var(--fg)', margin: 0, padding: '7px 14px', fontSize: '13px', width: 'auto' }}
          >
            Reply
          </button>
          <button
            className="form-btn"
            onClick={generate}
            disabled={drafting}
            style={{ background: 'transparent', border: '1px solid var(--c-rust)', color: 'var(--c-rust)', margin: 0, padding: '7px 14px', fontSize: '13px', width: 'auto' }}
            title="Draft a reply with AI — you review and send it yourself"
          >
            {drafting ? 'Generating…' : '✦ Generate'}
          </button>
        </div>
      )}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <input
            className="form-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            style={{ fontSize: '13px' }}
          />
          <textarea
            className="form-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Hi ${enquiry.name || 'there'},\n\nThanks for reaching out…`}
            rows={5}
            style={{ fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="form-btn"
              onClick={send}
              disabled={sending}
              style={{ margin: 0, padding: '8px 18px', fontSize: '13px', width: 'auto' }}
            >
              {sending ? 'Sending…' : `Send to ${enquiry.email}`}
            </button>
            <button
              className="form-btn"
              onClick={generate}
              disabled={sending || drafting}
              style={{ background: 'transparent', border: '1px solid var(--c-rust)', color: 'var(--c-rust)', margin: 0, padding: '8px 14px', fontSize: '13px', width: 'auto' }}
              title="Replace the draft with a freshly generated one"
            >
              {drafting ? 'Generating…' : '✦ Generate'}
            </button>
            <button
              className="form-btn"
              onClick={() => setOpen(false)}
              disabled={sending}
              style={{ background: 'transparent', border: '1px solid var(--line-strong)', color: 'var(--fg-dim)', margin: 0, padding: '8px 14px', fontSize: '13px', width: 'auto' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {status && (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: status.ok ? 'var(--c-green, #3a9d5d)' : 'var(--c-rust)' }}>
          {status.ok ? '✔' : '⚠'} {status.msg}
        </p>
      )}
    </div>
  );
}

// One-click blast to every enquiry that arrived with an empty message — there's
// nothing to tailor a reply to, so they all get the same course-details email.
// Owns its own subject/body state so typing never re-renders the enquiry list.
function EnquiryBulkEmailBox({ enquiries }) {
  const [subject, setSubject] = useState('Course details — Agentic AI at Production Level');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }

  // Same address twice = one email, but the reply is logged on every matching doc
  // so none of them stay stuck in "Yet to be replied".
  const unique = [];
  const seen = new Set();
  for (const q of enquiries) {
    const email = (q.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    unique.push({ name: q.name || '', email });
  }

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      setStatus({ ok: false, msg: 'Subject and message are both required.' });
      return;
    }
    if (unique.length === 0) {
      setStatus({ ok: false, msg: 'None of these enquiries has an email address.' });
      return;
    }
    if (!window.confirm(`Send this email to ${unique.length} ${unique.length === 1 ? 'person' : 'people'}? This cannot be undone.`)) return;
    setSending(true);
    setStatus(null);
    try {
      await functions.httpsCallable('sendBulkEmail')({
        subject: subject.trim(),
        body,
        label: `Empty-message enquiries — ${unique.length} recipients`,
        recipients: unique,
      });
      // Log on every lead doc so the thread survives and the tab counts update.
      // Firestore caps a batch at 500 writes; chunk well under it.
      const entry = {
        direction: 'out',
        subject: subject.trim(),
        body,
        sentAt: Date.now(),
        by: (auth && auth.currentUser && auth.currentUser.email) || 'admin',
      };
      const withEmail = enquiries.filter((q) => (q.email || '').trim());
      try {
        for (let i = 0; i < withEmail.length; i += 400) {
          const batch = db.batch();
          for (const q of withEmail.slice(i, i + 400)) {
            batch.update(db.collection('leads').doc(q.id), {
              replies: firebase.firestore.FieldValue.arrayUnion(entry),
            });
          }
          await batch.commit();
        }
      } catch (logErr) {
        console.error('[BULK ENQUIRY] sent but could not log to threads:', logErr);
      }
      setStatus({ ok: true, msg: `Sent to ${unique.length} ${unique.length === 1 ? 'recipient' : 'recipients'}. Track delivery in Email Tasks.` });
      setBody('');
    } catch (e) {
      console.error('[BULK ENQUIRY] send failed:', e);
      setStatus({ ok: false, msg: e.message || 'Could not send the bulk email.' });
    }
    setSending(false);
  };

  return (
    <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '12px', padding: '18px 20px', marginTop: '18px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600 }}>Email all {unique.length} of them at once</div>
      <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--fg-dim)', lineHeight: 1.6 }}>
        These enquiries left no message, so there's nothing to tailor. Write one email and it goes to every unique
        address below in a single send.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          className="form-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          style={{ fontSize: '13px' }}
        />
        <textarea
          className="form-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Hi there,\n\nThanks for your interest in the course…"}
          rows={8}
          style={{ fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div>
          <button
            className="form-btn"
            onClick={send}
            disabled={sending || unique.length === 0}
            style={{ margin: 0, padding: '8px 18px', fontSize: '13px', width: 'auto' }}
          >
            {sending ? 'Sending…' : `Send to all ${unique.length}`}
          </button>
        </div>
      </div>
      {status && (
        <p style={{ margin: '10px 0 0', fontSize: '13px', color: status.ok ? 'var(--c-green, #3a9d5d)' : 'var(--c-rust)' }}>
          {status.ok ? '✔' : '⚠'} {status.msg}
        </p>
      )}
    </div>
  );
}

function AdminEnquiriesPanel() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | replied | pending

  useEffect(() => {
    if (!db) return;
    const unsub = db.collection('leads')
      .where('source', '==', 'course_enquiry')
      .onSnapshot(
        (snap) => {
          setEnquiries(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
          setLoading(false);
        },
        (err) => {
          console.error('[ENQUIRIES] snapshot failed:', err);
          setError('Could not load enquiries.');
          setLoading(false);
        }
      );
    return () => unsub();
  }, []);

  const fmtDate = (ts) => {
    const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
    return d ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  };

  // Replied = at least one outbound reply logged on the lead doc.
  const isReplied = (q) => Array.isArray(q.replies) && q.replies.some((r) => r.direction !== 'in');
  const repliedCount = enquiries.filter(isReplied).length;
  const pendingCount = enquiries.length - repliedCount;
  // Empty-message enquiries can't be answered individually — they get their own
  // tab and a single bulk send instead. It's a queue, not a content filter: once
  // one is replied to it leaves this tab for "Replied", so the count is the
  // outstanding work and a bulk send never re-hits someone already handled.
  const hasNoMessage = (q) => !String(q.message || '').trim();
  const noMessage = enquiries.filter((q) => hasNoMessage(q) && !isReplied(q));
  const shown = filter === 'all'
    ? enquiries
    : filter === 'nomessage'
      ? noMessage
      : enquiries.filter((q) => isReplied(q) === (filter === 'replied'));

  const exportCsv = () => {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = enquiries.map((q) =>
      [q.name, q.email, q.phone, q.occupation, q.message, fmtDate(q.createdAt)].map(esc).join(',')
    );
    const blob = new Blob(['Name,Email,Phone,Occupation,Message,Date\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'course_enquiries.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="dash-enquiries" className="dashboard__panel">
      <h2 className="dashboard__panel-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        Course Enquiries
        <span style={{ fontSize: '13px', color: 'var(--fg-faint)', fontFamily: 'JetBrains Mono', fontWeight: 400 }}>
          {loading ? '…' : `${enquiries.length} total`}
        </span>
        {enquiries.length > 0 && (
          <button
            onClick={exportCsv}
            className="form-btn"
            style={{ background: 'transparent', border: '1px solid var(--line-strong)', color: 'var(--fg)', margin: '0 0 0 auto', padding: '8px 14px', fontSize: '13px', width: 'auto' }}
          >
            Export CSV
          </button>
        )}
      </h2>
      <p className="hero__sub" style={{ marginTop: '4px', fontSize: '14px', color: 'var(--fg-dim)', maxWidth: '100%' }}>
        Messages from the &ldquo;Enquire About This Course&rdquo; form on the Courses page. Live — new enquiries appear as they arrive.
      </p>
      {error && <p style={{ fontSize: '14px', color: 'var(--c-rust)', marginTop: '16px' }}>⚠ {error}</p>}
      {!loading && !error && enquiries.length === 0 && (
        <p style={{ fontSize: '14px', color: 'var(--fg-faint)', marginTop: '16px' }}>No enquiries yet.</p>
      )}
      {enquiries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}>
          {[
            { id: 'all', label: 'All', count: enquiries.length },
            { id: 'replied', label: 'Replied', count: repliedCount },
            { id: 'pending', label: 'Yet to be replied', count: pendingCount },
            { id: 'nomessage', label: 'No message', count: noMessage.length },
          ].map((f) => (
            <button
              key={f.id}
              className={`dash-tab${filter === f.id ? ' is-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="dash-tab__count">{f.count}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && enquiries.length > 0 && shown.length === 0 && (
        <p style={{ fontSize: '14px', color: 'var(--fg-faint)', marginTop: '16px' }}>
          {filter === 'replied'
            ? 'No replied enquiries yet.'
            : filter === 'nomessage'
              ? 'Nothing waiting — every empty-message enquiry has been replied to.'
              : 'All enquiries have been replied to.'}
        </p>
      )}
      {filter === 'nomessage' && noMessage.length > 0 && <EnquiryBulkEmailBox enquiries={noMessage} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '18px', maxHeight: '560px', overflowY: 'auto', paddingRight: '6px' }}>
        {shown.map((q) => {
          const expanded = expandedId === q.id;
          const replies = Array.isArray(q.replies) ? q.replies : [];
          return (
          <div key={q.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '12px', padding: '18px 20px' }}>
            <div
              onClick={() => setExpandedId(expanded ? null : q.id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', cursor: 'pointer' }}
              title={expanded ? 'Collapse conversation' : 'View conversation'}
            >
              <div style={{ fontSize: '15px', fontWeight: 600 }}>
                <span style={{ fontSize: '11px', color: 'var(--fg-faint)', marginRight: '8px' }}>{expanded ? '▾' : '▸'}</span>
                {q.name || '(no name)'}
                {q.occupation && (
                  <span className="dashboard__role-badge" style={{ marginLeft: '10px', fontSize: '11px' }}>{q.occupation}</span>
                )}
                {replies.length > 0 && (
                  <span style={{ marginLeft: '10px', fontSize: '11px', color: 'var(--fg-faint)', fontFamily: 'JetBrains Mono', fontWeight: 400 }}>
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--fg-faint)', fontFamily: 'JetBrains Mono' }}>{fmtDate(q.createdAt)}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--fg-dim)', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>
              <a href={`mailto:${q.email}`} style={{ color: 'inherit' }}>{q.email}</a>
              {q.phone ? ` · ${q.phone}` : ''}
            </div>
            {q.message ? (
              <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{q.message}</p>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--fg-faint)', fontStyle: 'italic' }}>No message left.</p>
            )}
            {expanded && replies.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {replies.slice().sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0)).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      borderLeft: `3px solid ${r.direction === 'in' ? 'var(--line-strong)' : 'var(--c-rust)'}`,
                      background: 'var(--bg)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '12px', fontFamily: 'JetBrains Mono', color: 'var(--fg-faint)' }}>
                      <span>{r.direction === 'in' ? (q.name || q.email) : `You (${r.by || 'admin'})`}</span>
                      <span>{r.sentAt ? new Date(r.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                    </div>
                    {r.subject && <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '6px' }}>{r.subject}</div>}
                    <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.6, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{r.body}</p>
                  </div>
                ))}
              </div>
            )}
            {expanded && replies.length === 0 && (
              <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--fg-faint)', fontStyle: 'italic' }}>No replies sent yet.</p>
            )}
            {expanded && q.email && <EnquiryReplyBox enquiry={q} />}
          </div>
          );
        })}
      </div>
    </div>
  );
}

AdminEnquiriesPanel = React.memo(AdminEnquiriesPanel);

// ===============================================================
// ADMIN — Email send-task viewer. Lists every bulk-email job
// (emailJobs collection, written by Cloud Functions) with live
// progress; click one to see counts and who it went to.
// ===============================================================
function AdminEmailTasks() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState('');
  const [showUndeliveredOnly, setShowUndeliveredOnly] = useState(false);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsub = db.collection('emailJobs').orderBy('createdAt', 'desc').limit(200)
      .onSnapshot(
        (snap) => {
          const list = [];
          snap.forEach((d) => list.push(Object.assign({ id: d.id }, d.data())));
          setJobs(list);
          setLoading(false);
        },
        (err) => { console.error('[email-tasks] fetch failed:', err); setLoading(false); }
      );
    return () => unsub();
  }, []);

  const processedOf = (j) => (j.sent || 0) + (j.errors || 0) + (j.skipped || 0);
  const statusOf = (j) => {
    const total = j.total || 0;
    const done = processedOf(j);
    if (total > 0 && done >= total) return 'done';
    if (done > 0) return 'sending';
    return 'queued';
  };
  const statusLabel = { done: 'Completed', sending: 'Sending…', queued: 'Queued' };
  const fmtDate = (ts) => {
    try {
      const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    } catch (e) { return '—'; }
  };

  const selected = jobs.find((j) => j.id === selectedId) || null;

  if (selected) {
    const status = statusOf(selected);
    const total = selected.total || 0;
    const processed = processedOf(selected);
    const pct = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    const recipients = Array.isArray(selected.recipients) ? selected.recipients : [];
    // Jobs sent after per-recipient delivery tracking was added carry
    // deliveredIdx (indices into recipients). Older jobs show no statuses.
    const tracked = Array.isArray(selected.deliveredIdx);
    const deliveredSet = new Set(tracked ? selected.deliveredIdx : []);
    const undeliveredCount = tracked ? recipients.reduce((n, _, i) => n + (deliveredSet.has(i) ? 0 : 1), 0) : 0;
    const canRetry = tracked && selected.type === 'bulk' && selected.bodyTpl && status === 'done' && undeliveredCount > 0;
    const handleRetry = async () => {
      if (!functions) { setRetryMsg('⚠ Firebase Functions is not initialized on this platform.'); return; }
      setRetrying(true); setRetryMsg('');
      try {
        const res = await functions.httpsCallable('retryEmailJob')({ jobId: selected.id });
        const d = res.data || {};
        setRetryMsg(d.retried > 0
          ? `✓ Retrying ${d.retried} undelivered recipient${d.retried === 1 ? '' : 's'} — progress updates live below.`
          : '✓ Everyone already received this email — nothing to retry.');
      } catch (err) {
        setRetryMsg('⚠ ' + (err.message || 'Retry failed.'));
      } finally { setRetrying(false); }
    };
    return (
      <section className="email-tasks">
        <button type="button" className="email-tasks__back" onClick={() => { setSelectedId(null); setRetryMsg(''); setShowUndeliveredOnly(false); }}>← All tasks</button>
        <div className="email-tasks__detail-head">
          <span className={`email-tasks__badge email-tasks__badge--${status}`}>{statusLabel[status]}</span>
          <h2 className="email-tasks__title">{(selected.label || selected.type || 'Email')} — {selected.title || selected.sessionId || 'Masterclass'}</h2>
          <p className="email-tasks__meta">Started {fmtDate(selected.createdAt)} · {total} recipient{total === 1 ? '' : 's'}</p>
        </div>

        {status === 'done' ? (
          <div className="email-tasks__counts email-tasks__counts--big">
            <span><strong>{selected.sent || 0}</strong> emails sent</span>
            {(selected.skipped || 0) > 0 && <span>{selected.skipped} skipped</span>}
            {(selected.errors || 0) > 0 && <span className="is-err">{selected.errors} failed</span>}
          </div>
        ) : (
          <div className="email-tasks__progress">
            <div className="email-tasks__bar"><div className="email-tasks__bar-fill" style={{ width: pct + '%' }} /></div>
            <div className="email-tasks__progress-label">{processed} / {total} processed · {pct}%</div>
            <div className="email-tasks__counts">
              <span>✅ {selected.sent || 0} sent</span>
              <span>⏭ {selected.skipped || 0} skipped</span>
              <span>⚠ {selected.errors || 0} errors</span>
            </div>
          </div>
        )}

        {tracked && (
          <div className="email-tasks__counts" style={{ marginTop: '12px', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <span>📬 <strong>{deliveredSet.size}</strong> delivered</span>
            <span className={undeliveredCount > 0 ? 'is-err' : ''}>{undeliveredCount} not delivered</span>
            {canRetry && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="form-btn form-btn--accent"
                style={{ width: 'auto', margin: 0, padding: '8px 18px', fontSize: '13px', background: retrying ? 'var(--bg-faint)' : 'var(--c-pink)', cursor: retrying ? 'not-allowed' : 'pointer' }}
              >
                {retrying ? 'Queuing retry…' : `↻ Retry ${undeliveredCount} undelivered`}
              </button>
            )}
          </div>
        )}
        {retryMsg && <p style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.5, color: retryMsg.startsWith('⚠') ? 'var(--c-rust)' : 'var(--c-emerald)' }}>{retryMsg}</p>}

        {Array.isArray(selected.failures) && selected.failures.length > 0 && (
          <div className="email-tasks__failures">
            <div className="email-tasks__recips-head email-tasks__recips-head--err">
              Failed {(selected.errors || 0) > selected.failures.length ? `(showing ${selected.failures.length} of ${selected.errors})` : `(${selected.failures.length})`}
            </div>
            <ul className="email-tasks__fail-list">
              {selected.failures.map((f, i) => (
                <li key={i}>
                  <div className="email-tasks__fail-who">
                    <span className="email-tasks__recip-name">{f.name || '—'}</span>
                    <span className="email-tasks__recip-email">{f.email}</span>
                  </div>
                  <span className="email-tasks__fail-reason">{f.error || 'Unknown error'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="email-tasks__recips">
          <div className="email-tasks__recips-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span>Recipients {selected.recipientsTruncated ? `(first ${recipients.length} of ${total})` : `(${recipients.length})`}</span>
            {tracked && recipients.length > 0 && (
              <label style={{ fontWeight: 400, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={showUndeliveredOnly} onChange={(e) => setShowUndeliveredOnly(e.target.checked)} />
                undelivered only
              </label>
            )}
          </div>
          {recipients.length === 0 ? (
            <p className="email-tasks__empty">No recipient list stored for this task.</p>
          ) : (
            <ul className="email-tasks__recip-list">
              {recipients.map((r, i) => {
                const delivered = deliveredSet.has(i);
                if (tracked && showUndeliveredOnly && delivered) return null;
                return (
                  <li key={i}>
                    <span className="email-tasks__recip-name">{r.name || '—'}</span>
                    <span className="email-tasks__recip-email">{r.email}</span>
                    {tracked && (
                      <span style={{ marginLeft: 'auto', fontSize: '12px', whiteSpace: 'nowrap', color: delivered ? 'var(--c-emerald)' : 'var(--c-rust)' }}>
                        {delivered ? '✓ delivered' : '✗ not delivered'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="email-tasks">
      <div className="email-tasks__head">
        <h2 className="email-tasks__title">Email send tasks</h2>
        <p className="email-tasks__sub">Live progress of every bulk email — zoom links, reminders, and cancellations.</p>
      </div>
      {loading ? (
        <p className="email-tasks__empty">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="email-tasks__empty">No email tasks yet. They appear here when you send zoom links, reminders, or cancellations.</p>
      ) : (
        <ul className="email-tasks__list">
          {jobs.map((j) => {
            const status = statusOf(j);
            return (
              <li key={j.id}>
                <button type="button" className="email-tasks__row" onClick={() => setSelectedId(j.id)}>
                  <span className={`email-tasks__badge email-tasks__badge--${status}`}>{status === 'done' ? 'Done' : statusLabel[status]}</span>
                  <span className="email-tasks__row-main">
                    <span className="email-tasks__row-title">{(j.label || j.type || 'Email')} — {j.title || j.sessionId || 'Masterclass'}</span>
                    <span className="email-tasks__row-sub">{fmtDate(j.createdAt)}</span>
                  </span>
                  <span className="email-tasks__row-count">{j.sent || 0}/{j.total || 0}</span>
                  <span className="email-tasks__row-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ===============================================================
// MAIN APPLICATION ROOT COMPONENT
// ===============================================================

function SiteContactBar() {
  return (
    <div className="site-contact-bar" role="region" aria-label="Contact information">
      <div className="site-contact-bar__inner">
        <span className="site-contact-bar__prompt">Have a question?</span>
        <span className="site-contact-bar__item" aria-label="Temporary contact number +91 XXXXXXXXXX">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
          </svg>
          <span>+91 XXXXXXXXXX</span>
        </span>
        <a className="site-contact-bar__item" href="mailto:team@balajichippada.com">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <span>team@balajichippada.com</span>
        </a>
      </div>
    </div>
  );
}

function App() {
  const [dockVisible, setDockVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false); // for nav blur
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  // The popup callback remains stable, but the old enrollment banner has been
  // replaced by the permanent contact strip above navigation.
  const handleWelcomeResolved = React.useCallback(() => {}, []);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('roadmap-theme');
    if (stored) return stored;
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });
  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // ── Scroll detection for nav blur ──────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Main navigation tabs routing state: 'home' | 'roadmap' | 'dashboard'
  const [activeMainTab, setActiveMainTab] = useState(() => {
    try {
      const acct = accountTabForPath(window.location.pathname);
      if (acct) return acct;
      const meta = window.SEO_CONFIG && window.SEO_CONFIG.getRouteMeta
        ? window.SEO_CONFIG.getRouteMeta(window.location.pathname)
        : null;
      const tab = (meta && meta.tab) || 'home';
      // The masterclass tab has no nav entry when the flag is off — don't let a
      // stale link land on a tab the user can't navigate back to.
      if (tab === 'masterclass' && !V2_CONFIG.showMasterclassTab) return 'home';
      return tab;
    } catch (e) { return 'home'; }
  });

  // ── Scroll-driven Hero animations ──
  let scrollY;
  try {
    const scrollObj = useScroll ? useScroll() : null;
    scrollY = scrollObj ? scrollObj.scrollY : null;
  } catch (e) {
    console.warn("Framer Motion useScroll not available", e);
  }

  const dummyMotionValue = useMotionValue ? useMotionValue(0) : null;
  const activeScrollY = scrollY || dummyMotionValue;

  const heroTitleScale = useTransform ? useTransform(activeScrollY, [0, 300], [1, 2.2]) : 1;
  const heroTitleOpacity = useTransform ? useTransform(activeScrollY, [0, 150, 300], [1, 0.8, 0]) : 1;
  const heroOthersOpacity = useTransform ? useTransform(activeScrollY, [0, 80], [1, 0]) : 1;
  const heroOthersY = useTransform ? useTransform(activeScrollY, [0, 80], [0, 40]) : 0;

  // Firebase Auth and RBAC Roles state
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' | 'teacher' | 'support' | 'client'

  // Roadmap videos + progress
  const [firestoreVideoDocs, setFirestoreVideoDocs] = useState([]);
  const [roadmapProgress, setRoadmapProgress] = useState(null);

  const videoLinks = React.useMemo(() => {
    const H = window.ROADMAP_VIDEO_HELPERS || {};
    const seed = H.flattenSeedVideos ? H.flattenSeedVideos(window.ROADMAP_VIDEOS || []) : [];
    const docs = (firestoreVideoDocs || []).map((d) => ({ ...d, id: d.id }));
    return H.mergeVideoLinks ? H.mergeVideoLinks(seed, docs) : seed;
  }, [firestoreVideoDocs]);

  // Masterclass sessions grid state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // AI-structured masterclasses state (from /masterclasses collection)
  const [masterclasses, setMasterclasses] = useState([]);
  const [loadingMasterclasses, setLoadingMasterclasses] = useState(true);

  // Booking seat flow state
  const [bookingSession, setBookingSession] = useState(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [userProfilePhone, setUserProfilePhone] = useState(""); // saved phone from the account, used to prefill booking
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const [legalPage, setLegalPage] = useState(null);

  // Track which masterclass OCCURRENCES this visitor has reserved, so we stop
  // prompting them (sticky bar, banner, CTAs) and show a "registered" state.
  // Stored as occurrence keys (mcOccKeys) — title+date, not title alone — so a
  // recurring series doesn't mark a future date "reserved" for someone who only
  // booked a past one. localStorage gives instant paint; Firestore (below) is
  // the authority and merges in on load.
  const [reservedOccs, setReservedOccs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('reserved_mc_occ') || '[]'); }
    catch (e) { return []; }
  });
  const markReserved = React.useCallback((session) => {
    if (!session) return;
    const keys = mcOccKeys(session.title, mcDateMs(session.dateTime), session.id);
    if (!keys.length) return;
    setReservedOccs((prev) => {
      const set = new Set(prev);
      let changed = false;
      keys.forEach((k) => { if (!set.has(k)) { set.add(k); changed = true; } });
      if (!changed) return prev;
      const next = Array.from(set);
      try { localStorage.setItem('reserved_mc_occ', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, []);
  
  // Checkout mock sandbox screen state
  const [mockCheckoutData, setMockCheckoutData] = useState(null);

  // Staff Login modal state
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);

  // Video paywall gate (in v2.jsx) dispatches this when a signed-out visitor
  // clicks "Sign in to watch" — open the login/register modal in response.
  useEffect(() => {
    const open = () => { setLoginError(""); setStaffLoginOpen(true); };
    window.addEventListener('v2:open-signin', open);
    return () => window.removeEventListener('v2:open-signin', open);
  }, []);

  // Lead Capture Modal states
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadModalSource, setLeadModalSource] = useState('roadmap_pdf');
  const [leadModalDownloadUrl, setLeadModalDownloadUrl] = useState('');

  const handleOpenLeadModal = (downloadUrl, source) => {
    setLeadModalDownloadUrl(downloadUrl || '');
    setLeadModalSource(source || 'roadmap_pdf');
    setLeadModalOpen(true);
  };
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  // Sign-up email verification (OTP): once a code is sent, show the code-entry step.
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtp, setSignupOtp] = useState("");
  // Forgot-password (OTP) flow: null → closed, 'email' → enter email, 'otp' → enter code + new password.
  const [forgotStep, setForgotStep] = useState(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotNewPw2, setForgotNewPw2] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotForce, setForgotForce] = useState(false); // Google user chose to set a password anyway

  // New student registration fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regUserType, setRegUserType] = useState(""); // 'Student' | 'Working Professional'

  // Forced profile completion overlay state
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);


  // Interactive Roadmap element refs (Only updated / observed during 'roadmap' tab active)
  const phaseRefs = useRef([]);
  const capstoneRefs = useRef([]);
  const agendaRef = useRef(null);
  const dockNodeRefs = useRef([]);
  const progressFillRef = useRef(null);
  const progressDotRef = useRef(null);
  const scrollFrame = useRef(null);
  const lastActiveIdx = useRef(-1);
  const lastDockVisible = useRef(false);
  const phaseMetrics = useRef([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('roadmap-theme', theme);
  }, [theme]);

  // Finish Google sign-in after full-page redirect (reliable with 2FA; popups often hang)
  useEffect(() => {
    if (!auth) return;
    let mounted = true;
    auth.getRedirectResult()
      .then((result) => {
        if (!mounted) return;
        const intent = consumeGoogleAuthIntent();
        if (!intent) return;

        const signedIn = !!(result && result.user) || !!auth.currentUser;
        if (!signedIn) return;

        if (intent.type === 'staff') {
          setStaffLoginOpen(false);
        } else if (intent.type === 'booking') {
          try {
            const pendingSession = sessionStorage.getItem(PENDING_BOOKING_KEY);
            if (pendingSession) {
              setBookingSession(JSON.parse(pendingSession));
              sessionStorage.removeItem(PENDING_BOOKING_KEY);
            }
            const pendingTier = sessionStorage.getItem(PENDING_BOOKING_TIER_KEY);
            if (pendingTier) {
              setSelectedTier(JSON.parse(pendingTier));
              sessionStorage.removeItem(PENDING_BOOKING_TIER_KEY);
            }
          } catch (err) {
            console.warn('Could not restore booking state after Google sign-in:', err);
          }
          setBookingStep(1);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        const intent = consumeGoogleAuthIntent();
        if (!intent) return;
        const msg = err.message || 'Google sign-in failed.';
        if (intent.type === 'booking') setBookingError(msg);
        else setLoginError(msg);
      })
      .finally(() => {
        if (mounted) {
          setLoginLoading(false);
          setBookingLoading(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  // Auth observer
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await db.collection('users').doc(u.uid).get();
          const emailLower = (u.email || '').toLowerCase();
          const isBootstrapAdmin = emailLower === 'gowtamsbh1234@gmail.com' || emailLower === 'balajichippada.20@gmail.com' || emailLower === 'mayupatil199@gmail.com' || emailLower === 'bhargavsinguluri@gmail.com';
          
          let role = 'client';
          let hasProfile = false;
          let nameVal = '';
          let phoneVal = '';
          let userTypeVal = '';

          if (userDoc.exists) {
            const userData = userDoc.data();
            role = userData.role || 'client';
            nameVal = userData.name || '';
            phoneVal = userData.phone || '';
            userTypeVal = userData.userType || '';
            hasProfile = !!(phoneVal && userTypeVal);
            setUserProfilePhone(phoneVal); // for auto-filling the masterclass booking form

            if (isBootstrapAdmin && role !== 'admin') {
              await db.collection('users').doc(u.uid).update({ role: 'admin' });
              role = 'admin';
            }

            if (isBootstrapAdmin) {
              setUserRole('admin');
            } else {
              setUserRole(role);
            }
          } else {
            // Check if bootstrap admin email
            if (isBootstrapAdmin) {
              await db.collection('users').doc(u.uid).set({
                email: u.email,
                role: 'admin',
                name: u.displayName || (emailLower === 'balajichippada.20@gmail.com' || emailLower === 'mayupatil199@gmail.com' ? 'Balaji Chippada' : emailLower === 'bhargavsinguluri@gmail.com' ? 'Bhargav Singuluri' : 'Gowtam Singulur')
              });
              setUserRole('admin');
              role = 'admin';
            } else {
              // Standard client profile - create baseline document first
              await db.collection('users').doc(u.uid).set({
                email: u.email,
                role: 'client'
              });
              setUserRole('client');
              role = 'client';
            }
          }

          // If not staff, check profile completeness
          const isStaff = isBootstrapAdmin || role === 'admin' || role === 'teacher' || role === 'support';
          if (!isStaff && !hasProfile) {
            setRegName(nameVal || u.displayName || "");
            setRegPhone(phoneVal || "");
            setRegUserType(userTypeVal || "");
            setShowCompleteProfile(true);
          } else {
            setShowCompleteProfile(false);
          }
        } catch (err) {
          console.error("Error reading role document:", err);
          const emailLower = (u.email || '').toLowerCase();
          if (emailLower === 'gowtamsbh1234@gmail.com' || emailLower === 'balajichippada.20@gmail.com' || emailLower === 'mayupatil199@gmail.com' || emailLower === 'bhargavsinguluri@gmail.com') {
            setUserRole('admin');
          } else {
            setUserRole('client');
          }
        }
      } else {
        setUserRole(null);
        setShowCompleteProfile(false);
        setUserProfilePhone(""); // signed out → don't leak the phone into a guest booking
      }
    });
    return () => unsubscribe();
  }, []);

  // Roadmap video links from Firestore (merged with seed in videoLinks)
  useEffect(() => {
    if (!db) return;
    const unsub = db.collection('roadmapVideos').onSnapshot((snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setFirestoreVideoDocs(list);
    }, () => setFirestoreVideoDocs([]));
    return () => unsub();
  }, []);

  // Per-video "Link to code" map (videoId → codeUrl). Published on window so the
  // video players (v2.jsx) can resolve the right code link for whichever video
  // is showing — including each individual video inside a playlist. The version
  // bump forces a re-render so the buttons appear once the map loads.
  const [codeLinkVersion, setCodeLinkVersion] = useState(0);
  useEffect(() => {
    if (!db) { return; }
    const unsub = db.collection('videoCodeLinks').onSnapshot((snap) => {
      const map = {};
      snap.forEach((doc) => { const v = doc.data(); if (v && v.codeUrl) map[doc.id] = v.codeUrl; });
      window.VIDEO_CODE_LINKS = map;
      setCodeLinkVersion((n) => n + 1);
    }, () => {});
    return () => unsub();
  }, []);

  // User roadmap progress
  useEffect(() => {
    if (!db || !user || user.isAnonymous) {
      setRoadmapProgress(null);
      return;
    }
    const unsub = db.collection('users').doc(user.uid).collection('roadmapProgress').doc('default')
      .onSnapshot((doc) => {
        setRoadmapProgress(doc.exists ? { id: doc.id, ...doc.data() } : null);
      }, () => setRoadmapProgress(null));
    return () => unsub();
  }, [user]);

  // Mirror the account-synced video watch state to a window global so the
  // roadmap video components (v2.jsx) render the SAME ✓ "Watched" markers in
  // every tab and on every device for a signed-in account — not just whatever
  // this browser's localStorage happens to hold. Firing an event lets any
  // already-mounted playlist refresh its badges the moment Firestore syncs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__VIDEO_PROGRESS = (roadmapProgress && roadmapProgress.videoProgress) || {};
    window.dispatchEvent(new Event('roadmap-progress-sync'));
  }, [roadmapProgress]);

  const handleStartTracking = async () => {
    if (!db || !user || user.isAnonymous) return;
    const ref = db.collection('users').doc(user.uid).collection('roadmapProgress').doc('default');
    const existing = await ref.get();
    if (existing.exists && existing.data().startedAt) return;
    await ref.set({
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedModules: [],
      videoProgress: {},
    }, { merge: true });
  };

  const handleVideoProgress = async ({ videoId, modules, watchedRatio }) => {
    if (!db || !user || user.isAnonymous || !modules?.length) return;
    const ref = db.collection('users').doc(user.uid).collection('roadmapProgress').doc('default');
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : { completedModules: [], videoProgress: {} };
    const completed = new Set(data.completedModules || []);
    modules.forEach((m) => completed.add(m));
    const videoProgress = { ...(data.videoProgress || {}), [videoId]: { watchedRatio, completed: watchedRatio >= 0.8, updatedAt: Date.now() } };
    await ref.set({
      startedAt: data.startedAt || firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedModules: Array.from(completed),
      videoProgress,
    }, { merge: true });
  };

  const handleGoToRoadmap = (nextModule) => {
    setActiveMainTab('roadmap');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nextModule && nextModule.phaseId) {
      setTimeout(() => scrollToPhase(nextModule.phaseId - 1), 400);
    }
  };

  // Fetch live masterclasses from Firestore
  useEffect(() => {
    if (!db) {
      setLoadingSessions(false);
      return;
    }
    const unsubscribe = db.collection('sessions')
      .onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setSessions(sortByCreatedAtDesc(list));
        setLoadingSessions(false);
      }, (err) => {
        console.error('Could not fetch sessions from firestore:', err);
        // When Firestore is unavailable, show no legacy sessions — site.config.js
        // already provides the featured masterclass via nextMasterclass merging.
        // (Mock prices ₹1999/₹2499 used to leak through here — removed.)
        setSessions([]);
        setLoadingSessions(false);
      });
    return () => unsubscribe();
  }, []);

  // Fetch AI-structured masterclasses from /masterclasses collection
  // NOTE: To run a FREE masterclass, set `price: 0` on the document in Firestore.
  // The whole UI (hero, banner, card, booking wizard, closing CTA, mobile sticky)
  // automatically adapts to free copy + skips Razorpay.
  useEffect(() => {
    if (!db) { setLoadingMasterclasses(false); return; }
    const unsub = db.collection('masterclasses')
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setMasterclasses(sortByCreatedAtDesc(list));
        setLoadingMasterclasses(false);
      }, (err) => {
        console.error('Could not fetch masterclasses from firestore:', err);
        setLoadingMasterclasses(false);
      });
    return () => unsub();
  }, []);

  // Reflect the user's ACTUAL reservations (Firestore) in the reserve/booked
  // CTA state — not just the localStorage cache that markReserved() writes.
  // Without this, a student who registered on another device, cleared storage,
  // or whose booking was created server-side still saw "Reserve" on the nav/
  // hero even though My Account listed the session. Source + cancel filter
  // mirror V2StudentDashboard's bookings loader.
  useEffect(() => {
    // Signed out: drop Firestore-derived reservations, keep this device's own
    // localStorage cache (its own bookings) so we don't leak another user's state.
    if (!db || !user) {
      try { setReservedOccs(JSON.parse(localStorage.getItem('reserved_mc_occ') || '[]')); }
      catch (e) { setReservedOccs([]); }
      return;
    }
    const unsub = db.collection('users').doc(user.uid).collection('bookings')
      .onSnapshot((snap) => {
        const keys = [];
        snap.forEach((doc) => {
          const b = doc.data() || {};
          if (b.status === 'cancelled' || b.deleted === true) return;
          const title = b.masterclassTitle || b.sessionTitle || '';
          const dateMs = mcDateMs(b.sessionDate || b.sessionDateTime);
          const id = b.masterclassId || b.sessionId || '';
          mcOccKeys(title, dateMs, id).forEach((k) => keys.push(k));
        });
        setReservedOccs((prev) => {
          const set = new Set(prev);
          let changed = false;
          keys.forEach((k) => { if (!set.has(k)) { set.add(k); changed = true; } });
          return changed ? Array.from(set) : prev;
        });
      }, (err) => {
        // Clients can't read the staff-only registrations collection, so the
        // bookings subcollection above is the source of truth; ignore denials.
        console.debug('reserved-seat sync skipped:', err?.code || err);
      });
    return () => unsub();
  }, [user]);


  useEffect(() => {
    const onKey = (e) => {
      // Don't hijack the shortcut while another dialog owns the screen.
      const otherModalOpen = modalOpenRef.current && !searchOpen;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (otherModalOpen) return;
        e.preventDefault();
        setSearchOpen(o => !o);
      } else if (e.key === '/' && !searchOpen) {
        if (otherModalOpen) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  useEffect(() => {
    if (user && bookingSession && bookingStep === 1) {
      // Always prefill from the account.
      setBookingName(user.displayName || bookingName);
      setBookingEmail(user.email || bookingEmail);
      if (userProfilePhone) setBookingPhone(userProfilePhone);
      // Only skip to the payment step for PAID sessions. Free sessions have no
      // step 2 — keep them on step 1 (which holds the form + "Confirm free seat"),
      // otherwise logged-in users get an empty modal.
      if (!isMcFree(bookingSession)) setBookingStep(2);
    }
  }, [user, bookingSession, bookingStep, userProfilePhone]);

  // Scroll driven dock observer (Runs only if Roadmap view is active)
  useEffect(() => {
    if (activeMainTab !== 'roadmap') return;

    const recomputeMetrics = () => {
      phaseMetrics.current = phaseRefs.current.filter(Boolean).map(el => {
        const pt = parseFloat(window.getComputedStyle(el).paddingTop) || 0;
        return { el, paddingTop: pt };
      });
    };

    const update = () => {
      scrollFrame.current = null;
      const scrollTop = window.scrollY;
      const winH = window.innerHeight;
      const metrics = phaseMetrics.current;
      if (!metrics.length) return;

      const firstPhaseTop = metrics[0].el.getBoundingClientRect().top + scrollTop;
      const visible = scrollTop > firstPhaseTop - winH * 0.15;
      if (visible !== lastDockVisible.current) {
        lastDockVisible.current = visible;
        setDockVisible(visible);
      }

      const navOffset = window.innerWidth <= 700 ? 24 : 56;
      const firstTop = metrics[0].el.getBoundingClientRect().top + scrollTop + metrics[0].paddingTop - navOffset;
      const lastM = metrics[metrics.length - 1];
      const lastTop = lastM.el.getBoundingClientRect().top + scrollTop + lastM.paddingTop - navOffset;
      const phaseRange = lastTop - firstTop;
      const phaseProgress = phaseRange <= 0 ? 0 : (scrollTop - firstTop) / phaseRange;
      const pct = Math.min(1, Math.max(0, phaseProgress)) * 100;
      if (progressFillRef.current) progressFillRef.current.style.width = pct + '%';
      if (progressDotRef.current) progressDotRef.current.style.left = pct + '%';

      const probeLine = window.innerWidth <= 700 ? 96 : 160;
      let active = 0;
      for (let i = 0; i < metrics.length; i++) {
        const rect = metrics[i].el.getBoundingClientRect();
        if (rect.top + metrics[i].paddingTop <= probeLine) active = i;
      }
      if (active !== lastActiveIdx.current) {
        lastActiveIdx.current = active;
        dockNodeRefs.current.forEach((node, i) => {
          if (!node) return;
          const isActive = i === active;
          node.classList.toggle('active', isActive);
          node.classList.toggle('passed', i < active);
          if (isActive) node.setAttribute('aria-current', 'true');
          else node.removeAttribute('aria-current');
        });
      }
    };

    const onScroll = () => {
      if (scrollFrame.current != null) return;
      scrollFrame.current = window.requestAnimationFrame(update);
    };

    const onResize = () => {
      recomputeMetrics();
      onScroll();
    };

    recomputeMetrics();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (scrollFrame.current != null) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, [activeMainTab]);

  // Reveal elements viewport observer
  useEffect(() => {
    if (activeMainTab !== 'roadmap') return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [activeMainTab]);

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', navMenuOpen);
    return () => document.body.classList.remove('nav-menu-open');
  }, [navMenuOpen]);

  // Hide floating CTAs + lock background scroll while any dialog is open.
  const anyModalOpen = !!(
    bookingSession || bookingSuccess || staffLoginOpen || mockCheckoutData ||
    showCompleteProfile || leadModalOpen || legalPage || searchOpen
  );
  // Kept current so keyboard handlers registered earlier can read live state.
  const modalOpenRef = useRef(false);
  modalOpenRef.current = anyModalOpen;
  useEffect(() => {
    document.body.classList.toggle('modal-open', anyModalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [anyModalOpen]);

  // Minimal focus trap: keep Tab focus inside the top-most open dialog and move
  // focus into it on open. Covers all overlays (.modal-overlay, .cmdk, welcome).
  useEffect(() => {
    if (!anyModalOpen) return undefined;
    const SEL = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getContainer = () => {
      const overlays = document.querySelectorAll('.modal-overlay, .cmdk, .v2-welcome-overlay');
      return overlays.length ? overlays[overlays.length - 1] : null;
    };
    const container = getContainer();
    if (container) {
      const first = container.querySelector(SEL);
      if (first && !container.contains(document.activeElement)) {
        try { first.focus({ preventScroll: true }); } catch (e) {}
      }
    }
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const c = getContainer();
      if (!c) return;
      const items = Array.from(c.querySelectorAll(SEL)).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus();
      } else if (!c.contains(document.activeElement)) {
        e.preventDefault(); firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [anyModalOpen]);

  // Escape closes dismissible dialogs (profile completion is intentionally forced)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (bookingSession || bookingSuccess) { closeBooking(); return; }
      if (mockCheckoutData) { setMockCheckoutData(null); return; }
      if (staffLoginOpen) { setStaffLoginOpen(false); return; }
      if (leadModalOpen) { setLeadModalOpen(false); return; }
      if (legalPage) { setLegalPage(null); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookingSession, bookingSuccess, mockCheckoutData, staffLoginOpen, leadModalOpen, legalPage]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setNavMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setNavMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Scroll action helpers for Roadmap
  const scrollToElement = (el, mobileOffset = 72, desktopOffset = 72, includePadding = false) => {
    if (!el) return;
    const navOffset = window.innerWidth <= 768 ? mobileOffset : desktopOffset;
    const pt = includePadding
      ? parseFloat(window.getComputedStyle(el).paddingTop) || 0
      : 0;
    const top = el.getBoundingClientRect().top + window.scrollY + pt - navOffset;
    const prefersReduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 700;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReduced || isMobile ? 'auto' : 'smooth'
    });
  };

  const scrollToPhase = (i) => {
    const el = phaseRefs.current[i];
    if (!el) return;
    scrollToElement(el, 24, 56, true);
  };
  const scrollToCapstone = (i) => scrollToElement(capstoneRefs.current[i], 24, 72, false);
  const scrollToAgenda = () => scrollToElement(agendaRef.current, 24, 72, false);

  const totalSections = window.ROADMAP.reduce((a, p) => a + p.sections.length, 0);

  const capstoneTiles = window.CAPSTONES.map((c, i) => ({
    n: c.n,
    title: c.title.split(/[—:]|on /)[0].trim(),
    domain: c.domain,
    color: ['pink', 'mustard', 'teal-deep'][i]
  }));

  // ── Forgot-password (6-digit OTP) flow ──
  const closeForgot = () => {
    setForgotStep(null); setForgotEmail(""); setForgotOtp(""); setForgotForce(false);
    setForgotNewPw(""); setForgotNewPw2(""); setForgotError(""); setForgotMsg(""); setForgotLoading(false);
  };
  // Ask the backend to email a code. `force` skips the "you signed up with Google"
  // hint and sends a code anyway (so a Google user can set a password if they want).
  const requestCode = async (force) => {
    setForgotLoading(true); setForgotError("");
    try {
      const res = await functions.httpsCallable("requestPasswordReset")({ email: forgotEmail.trim().toLowerCase(), force: !!force });
      if (!force && res && res.data && res.data.provider === "google") {
        setForgotStep("google"); // show the Google-sign-in prompt instead of a code
      } else {
        if (force) setForgotForce(true); // remember it for resends
        setForgotMsg("If an account exists for that email, a 6-digit code is on its way. It expires in 10 minutes.");
        setForgotStep("otp");
      }
    } catch (err) {
      setForgotError((err && err.message) || "Could not send the code. Please try again.");
    } finally { setForgotLoading(false); }
  };
  const handleRequestReset = (e) => {
    if (e) e.preventDefault();
    const VV = window.V2_VALIDATE;
    const emailErr = VV ? VV.emailError(forgotEmail) : (!forgotEmail ? "Please enter your email." : "");
    if (emailErr) { setForgotError(emailErr); return; }
    requestCode(false);
  };
  const handleResetAnyway = () => requestCode(true);
  const handleConfirmReset = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{6}$/.test(forgotOtp.trim())) { setForgotError("Enter the 6-digit code from your email."); return; }
    if (forgotNewPw.length < 6) { setForgotError("Password must be at least 6 characters."); return; }
    if (forgotNewPw !== forgotNewPw2) { setForgotError("Passwords do not match."); return; }
    setForgotLoading(true); setForgotError("");
    try {
      await functions.httpsCallable("confirmPasswordReset")({
        email: forgotEmail.trim().toLowerCase(), otp: forgotOtp.trim(), newPassword: forgotNewPw,
      });
      // Password changed → sign them straight in with the new password.
      const em = forgotEmail.trim().toLowerCase(), pw = forgotNewPw;
      closeForgot();
      try { await auth.signInWithEmailAndPassword(em, pw); }
      catch (_) { setStaffLoginOpen(true); } // fall back to the login screen
    } catch (err) {
      setForgotError((err && err.message) || "Could not reset your password. Please try again.");
    } finally { setForgotLoading(false); }
  };

  // Handle staff login submit
  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (!auth) {
      setLoginError("Firebase Auth SDK was not initialized.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);

    try {
      if (isRegistering) {
        // Validate name / email / phone with the shared rules (defined in v2.jsx).
        const VV = window.V2_VALIDATE;
        const nameErr = VV ? VV.nameError(regName) : (!regName ? 'Please enter your name.' : '');
        if (nameErr) throw new Error(nameErr);
        const emailErr = VV ? VV.emailError(loginEmail) : (!loginEmail ? 'Please enter your email.' : '');
        if (emailErr) throw new Error(emailErr);
        const phoneErr = VV ? VV.phoneError(regPhone, true) : (!regPhone ? 'Please enter your phone number.' : '');
        if (phoneErr) throw new Error(phoneErr);
        if (!regUserType) throw new Error('Please select what describes you best.');
        if ((loginPassword || '').length < 6) throw new Error('Password must be at least 6 characters.');
        if (VV && VV.emailDeliverableError) {
          const deliverErr = await VV.emailDeliverableError(loginEmail);
          if (deliverErr) throw new Error(deliverErr);
        }

        // Verify-first: email a 6-digit code; the account is created server-side
        // only after the code is confirmed (handleVerifySignup).
        const res = await functions.httpsCallable('requestSignupOtp')({ email: loginEmail.trim().toLowerCase() });
        if (res && res.data && res.data.exists) {
          setIsRegistering(false);
          throw new Error('An account already exists for this email. Please sign in.');
        }
        setSignupOtp("");
        setSignupOtpSent(true);
      } else {
        // Standard login
        await auth.signInWithEmailAndPassword(loginEmail, loginPassword);
        setLoginEmail("");
        setLoginPassword("");
        setStaffLoginOpen(false);
      }
    } catch (err) {
      setLoginError(err.message || "Failed to complete authentication.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Verify the sign-up code → server creates the account → sign in.
  const handleVerifySignup = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{6}$/.test(signupOtp.trim())) { setLoginError("Enter the 6-digit code from your email."); return; }
    const VV = window.V2_VALIDATE;
    setLoginError(""); setLoginLoading(true);
    try {
      await functions.httpsCallable('verifySignupOtpAndCreate')({
        email: loginEmail.trim().toLowerCase(),
        otp: signupOtp.trim(),
        password: loginPassword,
        name: regName.trim(),
        phone: VV ? VV.toE164(regPhone) : regPhone,
        userType: regUserType,
      });
      // Account created (email verified) → sign in with the chosen password.
      await auth.signInWithEmailAndPassword(loginEmail.trim().toLowerCase(), loginPassword);
      setLoginEmail(""); setLoginPassword(""); setRegName(""); setRegPhone(""); setRegUserType("");
      setSignupOtp(""); setSignupOtpSent(false); setIsRegistering(false); setStaffLoginOpen(false);
    } catch (err) {
      if (err && /already exists/i.test(err.message || "")) {
        setSignupOtpSent(false); setIsRegistering(false);
      }
      setLoginError((err && err.message) || "Could not verify the code. Please try again.");
    } finally { setLoginLoading(false); }
  };
  const handleResendSignupOtp = async () => {
    setLoginError(""); setLoginLoading(true);
    try {
      await functions.httpsCallable('requestSignupOtp')({ email: loginEmail.trim().toLowerCase() });
      setLoginError("");
    } catch (err) {
      setLoginError((err && err.message) || "Could not resend the code.");
    } finally { setLoginLoading(false); }
  };

  // Submit profile completion details for users (such as Google Sign-in users)
  const handleCompleteProfileSubmit = async (e) => {
    e.preventDefault();
    if (!auth || !user) {
      setLoginError("No authenticated user session found.");
      return;
    }
    const VV = window.V2_VALIDATE;
    const nameErr = VV ? VV.nameError(regName) : (!regName ? 'Please enter your name.' : '');
    if (nameErr) { setLoginError(nameErr); return; }
    const phoneErr = VV ? VV.phoneError(regPhone, true) : (!regPhone ? 'Please enter your phone number.' : '');
    if (phoneErr) { setLoginError(phoneErr); return; }
    if (!regUserType) { setLoginError('Please select what describes you best.'); return; }
    setLoginError("");
    setLoginLoading(true);

    try {
      // Update Firestore user document with missing profile fields
      const completedPhone = VV ? VV.toE164(regPhone) : regPhone;
      await db.collection('users').doc(user.uid).set({
        name: regName.trim(),
        email: user.email,
        phone: completedPhone,
        userType: regUserType,
        role: 'client'
      }, { merge: true });
      setUserProfilePhone(completedPhone); // so the booking form auto-fills this session

      // Update Auth Display Name
      try {
        await user.updateProfile({ displayName: regName });
      } catch (err) {
        console.warn("Could not set firebase Auth displayName:", err);
      }

      setRegName("");
      setRegPhone("");
      setRegUserType("");
      setShowCompleteProfile(false);
    } catch (err) {
      setLoginError(err.message || "Failed to complete account profile.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Google Sign-in via redirect (popup breaks when Google 2FA runs)
  const handleGoogleLogin = async () => {
    if (!auth) {
      setLoginError("Firebase Auth SDK was not initialized.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      saveGoogleAuthIntent({ type: 'staff' });
      await auth.signInWithRedirect(provider);
    } catch (err) {
      setLoginError(err.message || "Failed to start Google authentication.");
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      setActiveMainTab('home');
      // Reserved-seat state is a per-visitor cache; clear it on sign-out so a
      // signed-out visitor no longer sees "Seat booked ✓" / upcoming-session UI.
      setReservedOccs([]);
      try { localStorage.removeItem('reserved_mc_occ'); } catch (e) {}
    }
  };

  // Student booking transaction submission
  const completeBookingSuccess = async (paymentData) => {
    const session = bookingSession;
    const tier = selectedTier || getMcTiers(session)[0];
    setBookingSuccess({
      paymentId: paymentData.paymentId,
      orderId: paymentData.orderId,
      session,
      tier,
      alreadyRegistered: !!paymentData.alreadyRegistered,
    });
    setMockCheckoutData(null);
    setBookingStep('success');
    if (session && session.id) markReserved(session);
    if (user && !user.isAnonymous && db && session) {
      try {
        // Use the class id as the booking doc id so re-booking the same class
        // overwrites the single doc instead of piling up duplicates (.add()
        // created a new doc every time, which showed the class twice in
        // My Account). Fall back to .add() if the id isn't a valid doc id.
        const bookingPayload = {
          masterclassId: session.id,
          masterclassTitle: session.title,
          tier: tier.name,
          amount: tier.price,
          status: 'confirmed',
          razorpayPaymentId: paymentData.paymentId || '',
          razorpayOrderId: paymentData.orderId || '',
          sessionDate: session.dateTime ? new Date(session.dateTime) : null,
          bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
          zoomLink: session.zoomLink || '',
          prepPdfUrl: session.prepPdfUrl || '',
          recordingUrl: session.recordingUrl || '',
          slidesUrl: session.slidesUrl || '',
        };
        const bookingsCol = db.collection('users').doc(user.uid).collection('bookings');
        const safeId = typeof session.id === 'string' && session.id && !session.id.includes('/');
        if (safeId) {
          await bookingsCol.doc(session.id).set(bookingPayload, { merge: true });
        } else {
          await bookingsCol.add(bookingPayload);
        }
        await db.collection('users').doc(user.uid).set({
          name: bookingName,
          phone: window.V2_VALIDATE ? window.V2_VALIDATE.toE164(bookingPhone) : bookingPhone,
          email: user.email,
        }, { merge: true });
      } catch (err) {
        console.warn('Client-side booking write failed (webhook may have handled it):', err);
      }
    }
  };

  const handleBookingSubmit = async () => {
    const VV = window.V2_VALIDATE;
    const nameErr = VV ? VV.nameError(bookingName) : (!bookingName ? 'Please enter your name.' : '');
    if (nameErr) { setBookingError(nameErr); return; }
    const emailErr = VV ? VV.emailError(bookingEmail) : (!bookingEmail ? 'Please enter your email.' : '');
    if (emailErr) { setBookingError(emailErr); return; }
    const phoneErr = VV ? VV.phoneError(bookingPhone, true) : (!bookingPhone ? 'Please enter your phone number.' : '');
    if (phoneErr) { setBookingError(phoneErr); return; }
    if (!bookingSession) return;

    // Confirm the email domain can actually receive mail (fail-open on errors).
    if (VV && VV.emailDeliverableError) {
      setBookingLoading(true);
      const deliverErr = await VV.emailDeliverableError(bookingEmail);
      setBookingLoading(false);
      if (deliverErr) { setBookingError(deliverErr); return; }
    }

    // Normalize to E.164 so international numbers keep their country code on save.
    const phoneE164 = VV ? VV.toE164(bookingPhone) : bookingPhone;

    setBookingError('');
    setBookingLoading(true);

    // Guest checkout: sign in anonymously so the existing cloud function/Firestore writes still work.
    // If anonymous auth is disabled in Firebase, we fall back to a client-generated guest id.
    let effectiveUser = user;
    if (!effectiveUser && auth) {
      try {
        const result = await auth.signInAnonymously();
        effectiveUser = result.user;
      } catch (anonErr) {
        console.warn('Anonymous auth unavailable, continuing as pure guest:', anonErr?.code || anonErr);
        effectiveUser = {
          uid: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          email: bookingEmail,
          isAnonymous: true,
        };
      }
    } else if (!effectiveUser) {
      effectiveUser = {
        uid: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email: bookingEmail,
        isAnonymous: true,
      };
    }

    const tier = selectedTier || getMcTiers(bookingSession)[0];
    const payPrice = typeof tier.price === 'number' ? tier.price : getMcPrice(bookingSession);
    const sessionId = bookingSession.id;

    // ── FREE flow: skip Razorpay entirely. Write straight to registrations + (if signed in) user.bookings.
    if (payPrice === 0) {
      try {
        if (db) {
          const regPayload = {
            sessionId,
            sessionTitle: bookingSession.title,
            studentName: bookingName.trim(),
            studentEmail: bookingEmail.trim().toLowerCase(),
            studentPhone: bookingPhone || '',
            amount: 0,
            tier: tier.name || 'Free',
            collection: masterclasses.some((m) => m.id === sessionId) ? 'masterclasses' : 'sessions',
            status: 'completed',
            userId: effectiveUser.uid,
            isFree: true,
            // Snapshot the session details so confirmation + reminder emails work
            // even when the masterclass lives only in site.config (no Firestore doc).
            price: 0,
            sessionDateTime: bookingSession.dateTime || null,
            sessionDuration: bookingSession.duration || null,
            instructor: typeof bookingSession.instructor === 'object'
              ? (bookingSession.instructor.name || 'Balaji Chippada')
              : (bookingSession.instructor || 'Balaji Chippada'),
            zoomLink: bookingSession.zoomLink || '',
            orderId: 'free_' + Date.now(),
            bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
          // Idempotent doc id (session + email) so re-registering for the same
          // class overwrites one doc instead of creating duplicate roster rows.
          // merge:true preserves the email-sent flags set later by the reminder
          // pipeline. Falls back to an auto id if we somehow have no email.
          const emailKey = (bookingEmail || '').trim().toLowerCase();
          const regRef = emailKey
            ? db.collection('registrations').doc((sessionId + '__' + emailKey).replace(/[^A-Za-z0-9._@+-]/g, '_').slice(0, 400))
            : db.collection('registrations').doc();
          await regRef.set(regPayload, { merge: true });
          setBookingLoading(false);
          await completeBookingSuccess({
            paymentId: `free_${regRef.id}`,
            orderId: regPayload.orderId,
          });
        } else {
          // No Firestore — still let the user proceed (dev/preview).
          setBookingLoading(false);
          await completeBookingSuccess({
            paymentId: `free_local_${Math.random().toString(36).slice(2, 10)}`,
            orderId: `free_local_${Date.now()}`,
          });
        }
      } catch (err) {
        console.error('Free booking error:', err);
        setBookingLoading(false);
        // The registration doc id is deterministic (session__email) and only staff
        // can UPDATE registrations. So a permission-denied here means the doc already
        // exists → this email is already registered. Show that instead of an error.
        if (err && (err.code === 'permission-denied' || /permission|insufficient/i.test(err.message || ''))) {
          setBookingError('');
          await completeBookingSuccess({ paymentId: 'free_existing', orderId: 'free_existing', alreadyRegistered: true });
          return;
        }
        setBookingError('Could not save your registration. Please try again.');
      }
      return;
    }

    try {
      let orderData;

      if (!functions) {
        orderData = {
          success: true,
          orderId: `order_mock_${Math.random().toString(36).substring(2, 10)}`,
          amount: payPrice * 100,
          keyId: 'rzp_test_mockKeyId12345',
          isMock: true,
        };
      } else {
        const createOrderCall = functions.httpsCallable('createRazorpayOrder');
        const response = await createOrderCall({
          sessionId,
          name: bookingName,
          email: bookingEmail,
          phone: phoneE164 || '',
          userId: effectiveUser.uid,
          tier: tier.name,
          tierPrice: payPrice,
          collection: masterclasses.some((m) => m.id === sessionId) ? 'masterclasses' : 'sessions',
        });
        orderData = response.data;
      }

      setBookingLoading(false);

      if (orderData && orderData.success) {
        if (orderData.isMock) {
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocal) {
            setMockCheckoutData({
              orderId: orderData.orderId,
              amount: orderData.amount,
              session: bookingSession,
              name: bookingName,
              email: bookingEmail,
              phone: phoneE164 || '',
              tier: tier.name,
              userId: effectiveUser.uid,
            });
          } else {
            await completeBookingSuccess({
              paymentId: `pay_demo_${Math.random().toString(36).substring(2, 10)}`,
              orderId: orderData.orderId,
            });
          }
        } else {
          await loadRazorpaySdk();
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: 'INR',
            name: 'The Agent Engineer',
            description: `${bookingSession.title} · ${tier.name}`,
            order_id: orderData.orderId,
            prefill: { name: bookingName, email: bookingEmail, contact: phoneE164 },
            theme: { color: '#e0664c' },
            handler: function (response) {
              completeBookingSuccess({
                paymentId: response.razorpay_payment_id,
                orderId: orderData.orderId,
              });
            },
          };
          new window.Razorpay(options).open();
        }
      } else {
        throw new Error('Razorpay order creation response failed.');
      }
    } catch (err) {
      console.error('Booking error:', err);
      setBookingError(err.message || 'Could not complete order initialization.');
      setBookingLoading(false);
    }
  };

  const handleGoogleLoginForBooking = async () => {
    setBookingError('');
    setLoginLoading(true);
    setBookingLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      if (bookingSession) {
        sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(bookingSession));
      }
      if (selectedTier) {
        sessionStorage.setItem(PENDING_BOOKING_TIER_KEY, JSON.stringify(selectedTier));
      }
      saveGoogleAuthIntent({ type: 'booking' });

      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await auth.currentUser.linkWithRedirect(provider);
      } else {
        await auth.signInWithRedirect(provider);
      }
    } catch (err) {
      setBookingError(err.message || 'Google sign-in failed.');
      setLoginLoading(false);
      setBookingLoading(false);
    }
  };

  const closeBooking = () => {
    setBookingSession(null);
    setBookingStep(1);
    setBookingSuccess(null);
    setBookingError('');
    setSelectedTier(null);
    setMockCheckoutData(null);
  };

  const handleEmailLeadCapture = async (email) => {
    if (!db) return;
    try {
      await db.collection('leads').add({
        email,
        source: 'roadmap_pdf',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn('Lead capture failed:', err);
    }
  };

  // Complete simulated payment by calling functions webhook directly!
  const handleSimulatePayment = async () => {
    if (!mockCheckoutData) return;
    setBookingLoading(true);

    try {
      // Direct integration test: Trigger the local or live razorpayWebhook function to verify signature and complete booking!
      const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const webhookUrl = isLocalHost
        ? `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/us-central1/razorpayWebhook`
        : `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/razorpayWebhook`;

      const paymentId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;

      console.log(`[SIMULATOR] Triggering server-side Webhook verification at: ${webhookUrl}`);

      // Call webhook with identical payload structure sent by Razorpay
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": "simulated_signature_verification_bypass"
        },
        body: JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: paymentId,
                entity: "payment",
                amount: mockCheckoutData.amount,
                currency: "INR",
                status: "captured",
                order_id: mockCheckoutData.orderId,
                email: mockCheckoutData.email,
                contact: mockCheckoutData.phone,
                notes: {
                  sessionId: mockCheckoutData.session.id,
                  sessionTitle: mockCheckoutData.session.title,
                  studentName: mockCheckoutData.name
                }
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned webhook failure: ${response.status}`);
      }

      setBookingLoading(false);
      await completeBookingSuccess({ paymentId, orderId: mockCheckoutData.orderId });

    } catch (err) {
      console.error("Webhook simulator error:", err);
      try {
        if (db && mockCheckoutData) {
          const regSnap = await db.collection("registrations")
            .where("orderId", "==", mockCheckoutData.orderId)
            .limit(1)
            .get();

          if (!regSnap.empty) {
            await regSnap.docs[0].ref.update({
              status: "completed",
              paymentId: `pay_fallback_${Math.random().toString(36).substring(2, 10)}`
            });
          }
          await completeBookingSuccess({
            paymentId: `pay_fallback_${Math.random().toString(36).substring(2, 10)}`,
            orderId: mockCheckoutData.orderId,
          });
        }
      } catch (dbErr) {
        setBookingError('Payment simulation failed. Please try again.');
      }
      setBookingLoading(false);
    }
  };

  // Helper check for staff role authorization
  const isUserStaff = userRole === 'admin' || userRole === 'teacher' || userRole === 'support';

  const canSeeStaffTabs = isUserStaff;
  const canSeeAdminTabs = userRole === 'admin';

  // Expose whether the signed-in user may add/edit per-video "Code" links inline
  // in the roadmap. Mirrors the videoCodeLinks Firestore rule (admins / bootstrap
  // emails). Set during render so the video players (v2.jsx) read it immediately.
  const CODE_ADMIN_EMAILS = ['gowtamsbh1234@gmail.com', 'balajichippada.20@gmail.com', 'mayupatil199@gmail.com', 'bhargavsinguluri@gmail.com'];
  if (typeof window !== 'undefined') {
    window.__CODE_ADMIN = !!(user && !user.isAnonymous &&
      (userRole === 'admin' || CODE_ADMIN_EMAILS.includes((user.email || '').toLowerCase())));
  }

  // ── Single source of truth for the live masterclass ──
  // Compute once at the top of render so every downstream surface (hero, banner,
  // popup, curriculum, booking, sticky bar, closing CTA) sees the SAME object.
  // mergeMcWithConfig makes site.config.js win for content; Firestore only
  // contributes runtime state (seatsBooked, zoomLink, etc).
  // A class is "reserved" if any of its occurrence keys (title+date, or exact id)
  // matches one the visitor has booked. Occurrence-scoped so a recurring series
  // doesn't show "registered" for a future date the visitor never booked.
  const isMcReserved = (mc) => {
    if (!mc) return false;
    const keys = mcOccKeys(mc.title, mcDateMs(mc.dateTime), mc.id);
    return keys.some((k) => reservedOccs.includes(k));
  };
  const nextMasterclass = mergeMcWithConfig(getNextUpcomingMasterclass(masterclasses, sessions), masterclasses, sessions);
  const nextMcReserved = isMcReserved(nextMasterclass);
  // IDs of masterclasses/sessions an admin has deleted — used to hide them from
  // students who had already reserved (their booking snapshot is otherwise stale).
  const deletedSessionIds = React.useMemo(() => new Set(
    [...(masterclasses || []), ...(sessions || [])]
      .filter((s) => s && (s.deleted || s.status === 'deleted'))
      .map((s) => s.id)
  ), [masterclasses, sessions]);
  const goToAccount = () => { if (isUserStaff) switchMainTab('dashboard'); else switchMainTab('mybookings'); };
  const bookingCtx = {
    setBookingSession, setBookingStep, setBookingSuccess, setSelectedTier,
    setBookingName, setBookingEmail, setBookingPhone, setBookingError, user,
  };
  const openBooking = (mc) => openBookingForSession(mc || nextMasterclass, bookingCtx);

  const switchMainTab = (tab) => {
    setActiveMainTab(tab);
    setNavMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Path-based routing (crawlable URLs for /roadmap, /masterclasses, /about) ──
  const tabToPath = (tab) => {
    if (tab === 'roadmap') return '/roadmap';
    if (tab === 'masterclass') return '/masterclasses';
    if (ACCOUNT_TAB_PATHS[tab]) return ACCOUNT_TAB_PATHS[tab];
    return '/';
  };

  // Keep the URL + document title in sync whenever the active tab changes
  // (covers every setActiveMainTab call site, not just switchMainTab).
  useEffect(() => {
    const sectionRoutes = ['/about'];
    const current = window.location.pathname.replace(/\/+$/, '') || '/';
    const target = tabToPath(activeMainTab);
    // Don't clobber a section landing route while still on the masterclass tab.
    const onSectionLanding = activeMainTab === 'masterclass' && sectionRoutes.includes(current);
    if (!onSectionLanding && current !== target) {
      try { window.history.pushState({ tab: activeMainTab }, '', target); } catch (e) {}
    }
    try {
      const meta = window.SEO_CONFIG && window.SEO_CONFIG.getRouteMeta
        ? window.SEO_CONFIG.getRouteMeta(window.location.pathname) : null;
      if (meta && meta.title) document.title = meta.title;
    } catch (e) {}
  }, [activeMainTab]);

  // Back/forward button → re-sync the tab from the URL.
  useEffect(() => {
    const onPop = () => {
      try {
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const acct = accountTabForPath(path);
        if (acct) { setActiveMainTab(acct); return; }
        const meta = window.SEO_CONFIG.getRouteMeta(path);
        setActiveMainTab(meta.tab || 'home');
        if (meta.title) document.title = meta.title;
      } catch (e) {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // On first load of a section landing route, scroll to the relevant section.
  useEffect(() => {
    try {
      const meta = window.SEO_CONFIG && window.SEO_CONFIG.getRouteMeta
        ? window.SEO_CONFIG.getRouteMeta(window.location.pathname) : null;
      if (meta && meta.scrollTo) {
        setTimeout(() => {
          const el = document.getElementById(meta.scrollTo);
          if (el) el.scrollIntoView({ block: 'start' });
        }, 350);
      }
    } catch (e) {}
  }, []);

  const mainNavTabs = (
    <React.Fragment>
      <button
        role="tab"
        aria-selected={activeMainTab === 'home'}
        className={`nav__tab-btn ${activeMainTab === 'home' ? 'active' : ''}`}
        onClick={() => switchMainTab('home')}
      >
        Course
      </button>
      {V2_CONFIG.showMasterclassTab && (
        <button
          role="tab"
          aria-selected={activeMainTab === 'masterclass'}
          className={`nav__tab-btn ${activeMainTab === 'masterclass' ? 'active' : ''}`}
          onClick={() => switchMainTab('masterclass')}
        >
          Masterclass
        </button>
      )}
      <button
        role="tab"
        aria-selected={activeMainTab === 'roadmap'}
        className={`nav__tab-btn ${activeMainTab === 'roadmap' ? 'active' : ''}`}
        onClick={() => switchMainTab('roadmap')}
      >
        Full Roadmap
      </button>
      {user && !user.isAnonymous && (
        <button
          role="tab"
          aria-selected={activeMainTab === 'mybookings'}
          className={`nav__tab-btn ${activeMainTab === 'mybookings' ? 'active' : ''}`}
          onClick={() => switchMainTab('mybookings')}
        >
          My Account
        </button>
      )}
      {canSeeStaffTabs && (
        <button
          role="tab"
          aria-selected={activeMainTab === 'dashboard'}
          className={`nav__tab-btn ${activeMainTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => switchMainTab('dashboard')}
        >
          Dashboard
        </button>
      )}
      {canSeeAdminTabs && (
        <button
          role="tab"
          aria-selected={activeMainTab === 'emailtasks'}
          className={`nav__tab-btn ${activeMainTab === 'emailtasks' ? 'active' : ''}`}
          onClick={() => switchMainTab('emailtasks')}
        >
          Email Tasks
        </button>
      )}
    </React.Fragment>
  );

  const navDrawerActions = (
    <React.Fragment>
      <button
        type="button"
        className="nav__drawer-cta"
        onClick={() => {
          setNavMenuOpen(false);
          if (nextMcReserved) {
            goToAccount();
          } else if (nextMasterclass) {
            openBooking(nextMasterclass);
          } else {
            const el = document.getElementById('masterclasses');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        {nextMcReserved ? 'Seat booked ✓ · View' : (nextMasterclass ? (isMcFree(nextMasterclass) ? <>Reserve · <V2McPrice mc={nextMasterclass} /></> : 'Book a seat') : 'See classes')}
      </button>
      {user && !user.isAnonymous ? (
        <React.Fragment>
          <button
            type="button"
            className="nav__drawer-auth"
            onClick={() => { setNavMenuOpen(false); goToAccount(); }}
          >
            {isUserStaff ? 'Dashboard' : 'My Account'}
          </button>
          {isUserStaff && (
            <button
              type="button"
              className="nav__drawer-auth"
              onClick={() => { setNavMenuOpen(false); switchMainTab('mybookings'); }}
            >
              My Account
            </button>
          )}
          <button
            type="button"
            className="nav__drawer-auth nav__drawer-logout"
            onClick={() => { setNavMenuOpen(false); handleLogout(); }}
          >
            Log out
          </button>
        </React.Fragment>
      ) : (
        <button
          type="button"
          className="nav__drawer-auth"
          onClick={() => {
            setLoginError("");
            setStaffLoginOpen(true);
            setNavMenuOpen(false);
          }}
        >
          Sign In / Register
        </button>
      )}
    </React.Fragment>
  );

  // Signed-in identity chip: Google avatar (or generic icon) + first name,
  // with a hover/focus dropdown for Profile and Logout.
  const navUserMenu = user && !user.isAnonymous ? (
    <div className="nav__user">
      <button
        type="button"
        className="nav__user-btn"
        aria-haspopup="menu"
        onClick={goToAccount}
      >
        {user.photoURL ? (
          <img
            className="nav__user-avatar"
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="nav__user-avatar nav__user-avatar--icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
        )}
        <span className="nav__user-name">
          {user.displayName ? user.displayName.split(' ')[0] : 'My account'}
        </span>
        <span className="nav__user-caret" aria-hidden="true">▾</span>
      </button>
      <div className="nav__user-menu" role="menu">
        <button type="button" role="menuitem" className="nav__user-menu-item" onClick={goToAccount}>
          Profile
        </button>
        <button type="button" role="menuitem" className="nav__user-menu-item nav__user-menu-item--logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  ) : null;

  // FLA wordmark in the nav's left slot — clicking it returns to the home tab.
  // Letterforms use currentColor so the mark follows the theme.
  const navBrand = (
    <button
      type="button"
      className="nav__brand"
      aria-label="FLA — go to home"
      onClick={() => switchMainTab('home')}
    >
      <svg className="nav__brand-logo" viewBox="99 318 802 364" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="currentColor" d="M115.4,681.25c-3.24,0-6.92-1.36-9.86-3.64-3.58-2.78-5.55-6.46-5.54-10.38l.14-199.83c.02-22.81,4.37-42.49,12.93-58.48,9.94-18.55,25.13-31.2,45.15-37.59,14.12-4.51,28.13-6.7,42.83-6.71l118.81-.08c2.6,0,5.08,1.09,7.01,3.06,1.94,1.99,3.02,4.61,2.96,7.17l-.43,17.59c-.38,15.75-14.96,25.16-28.84,25.17l-93.39.02c-25.17,0-39.76,7.78-44.59,23.75-2.75,9.08-4.18,18.85-4.24,29.03l-.18,28.18c3.87-1.36,8.37-2.41,13.38-2.41,0,0,104.01-.01,104.01-.01,4.53,0,9.17,4.61,9.2,9.14l.1,15.41c.05,7.75-2.82,14.94-8.08,20.24-5.08,5.12-11.95,7.94-19.36,7.95l-84.84.11c-8.01.01-14.3,6.52-14.32,14.82l-.23,87.17c-.04,16.1-13.63,29.91-29.67,30.14l-12.95.19Z"/>
        <path fill="currentColor" d="M493.85,638.59c2.84-4.59-.47-10.52-5.86-10.52l-36.32-.03c-23.17-.01-36.14-6.41-39.64-19.57-1.97-7.42-2.9-14.18-2.9-21.28l-.09-213.03c0-5.58-5.16-9.47-9.8-9.47l-43.11.04c-4.76,0-9.09,4.48-9.08,9.38l.13,214.23c0,16.3,3.19,31.45,9.71,46.32,8.07,18.4,22.64,31.83,42.13,38.84,14.66,5.28,27.81,7.74,41.38,7.74h21.65c3.4.01,6.56-1.75,8.35-4.64l23.47-38.01Z"/>
        <path fill="currentColor" d="M873.14,614.9l-50.59-82.61c-2.71-4.43-9.12-4.49-11.92-.12l-23.57,36.75c-1.48,2.31-1.48,5.27,0,7.58l28.89,45.2c.58.9.65,3.11.12,3.84-.54.73-2.21,1.34-3.56,1.34l-89.85-.03c-.98,0-2.66-1.17-2.91-1.92-.25-.75.12-2.1.81-3.17l64.23-100.09,28.1-43.86,28.86-44.9c2.74-4.27,1.6-9.94-2.58-12.82l-21.74-14.95-5.65-3.84c-4.36-2.97-10.32-1.76-13.18,2.67l-56.51,87.58-63.68,97.57-39.44,60.16c-3.62,5.52-6,10.32-4.05,17.44,1.38,5.03,5.09,9.91,10.91,12.42,4.36,1.88,8.73,1.98,13.74,1.98h98.88s116.52-.06,116.52-.06c7.54,0,14.28-4.82,17.56-10.14,4.14-6.72,5.07-15.08,1.13-21.68l-20.5-34.34Z"/>
        <path fill="currentColor" d="M562.19,665.28c-6.57,10.67-13.77,16.09-26.31,15.97l-22.65-.22-17.4-.16c-1.34-.01-3.4-1.77-3.92-2.83-.62-1.26-.81-3.82.23-5.5l60.57-98.11,121.46-196.78c.23-.38.5-.74.8-1.06,5.11-5.5,10.55-9.35,17.81-11.29,12.35-2.65,25.96,1.62,32.88,12.83l27.35,44.29c1.37,2.21,1.34,5.01-.06,7.2l-24.42,38.03c-2.67,4.16-8.77,4.14-11.41-.05l-13.29-21.13c-.63-1.46-2.25-2.6-3.74-2.5s-2.3,1.57-3.24,3.07l-25.12,40.47-109.54,177.78Z"/>
        <polygon fill="#aa241a" points="850.09 394.53 833.7 405.94 833.48 402.32 843.92 387.48 850.09 394.53"/>
        <path fill="#f9472b" d="M831.31,381.51l45.96,31.72c2.16,1.49,5.14.27,5.64-2.3l17.01-87.84c.56-2.87-2.32-5.19-5.01-4.04l-89,38.16c-2.63,1.13-2.99,4.71-.63,6.34l26.03,17.96"/>
        <path fill="#db3a2a" d="M888.57,332.09l-44.32,58.34-10.32,15.26c-.79,1.07-2.49.51-2.49-.83l.13-23.19,57-49.59Z"/>
      </svg>
    </button>
  );

  // Signed-out CTA — sits on the right, next to the theme toggle (mirrors where
  // the signed-in user chip appears).
  const navSignInButton = (!user || user.isAnonymous) ? (
    <button
      className="nav__auth-btn"
      onClick={() => {
        setLoginError("");
        setStaffLoginOpen(true);
      }}
    >
      Sign In / Register
    </button>
  ) : null;

  const navMenuButton = (
    <button
      type="button"
      className={`nav__menu-btn ${navMenuOpen ? 'is-open' : ''}`}
      aria-label={navMenuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={navMenuOpen}
      aria-controls="mobile-nav-drawer"
      onClick={() => setNavMenuOpen((open) => !open)}
    >
      <span className="nav__menu-icon" aria-hidden="true" />
    </button>
  );

  return (
    <React.Fragment>
      <SiteContactBar />

      {/* Skip the sales popup entirely once the seat is reserved. */}
      {!nextMcReserved && (
        <V2WelcomePopup nextMc={nextMasterclass} onReserve={openBooking} onResolve={handleWelcomeResolved} />
      )}

      {motion ? (
        <motion.nav
          className="nav"
          aria-label="Primary"
          animate={{
            boxShadow: scrolled
              ? (theme === 'dark' ? '0 14px 44px rgba(0,0,0,0.5)' : '0 14px 44px rgba(28,24,20,0.16)')
              : (theme === 'dark' ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(28,24,20,0.08)'),
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
        <div className="nav__start">
          {navMenuButton}
          {navBrand}
        </div>

        <div className="nav__tabs" role="tablist">
          {mainNavTabs}
        </div>

        <div className="nav__right">
          {navUserMenu}
          {navSignInButton}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            aria-pressed={theme === 'dark'}>
            <span className="theme-toggle__track">
              <span className="theme-toggle__thumb" aria-hidden="true">
                {theme === 'light' ? '☀' : '☾'}
              </span>
            </span>
          </button>
        </div>
        </motion.nav>
      ) : (
        <nav className="nav" aria-label="Primary">
          <div className="nav__start">
            {navMenuButton}
            {navBrand}
          </div>
          <div className="nav__tabs" role="tablist">
            {mainNavTabs}
          </div>
          <div className="nav__right">
            {navUserMenu}
            {navSignInButton}
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-pressed={theme === 'dark'}
            >
              <span className="theme-toggle__track">
                <span className="theme-toggle__thumb" aria-hidden="true">
                  {theme === 'light' ? '☀' : '☾'}
                </span>
              </span>
            </button>
          </div>
        </nav>
      )}

      <div
        className={`nav__drawer-overlay${navMenuOpen ? ' is-open' : ''}`}
        onClick={() => setNavMenuOpen(false)}
        aria-hidden={!navMenuOpen}
      />
      <aside
        id="mobile-nav-drawer"
        className={`nav__drawer${navMenuOpen ? ' is-open' : ''}`}
        aria-hidden={!navMenuOpen}
        role="dialog"
        aria-modal={navMenuOpen ? 'true' : undefined}
        aria-label="Site menu"
      >
        <div className="nav__drawer-head">
          {user && !user.isAnonymous ? (
            <button
              type="button"
              className="nav__drawer-user"
              onClick={() => { setNavMenuOpen(false); goToAccount(); }}
              aria-label="Open my account"
            >
              <span className="nav__drawer-user-avatar" aria-hidden="true">
                {(user.displayName || user.email || '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className="nav__drawer-user-text">
                <span className="nav__drawer-user-name">{user.displayName || 'Your account'}</span>
                <span className="nav__drawer-user-email">{user.email}</span>
              </span>
              <span className="nav__drawer-user-chevron" aria-hidden="true">›</span>
            </button>
          ) : (
            // Signed-out: no brand/name in the drawer header — just a spacer so
            // the close button stays right-aligned.
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            className="nav__drawer-close"
            onClick={() => setNavMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <p className="nav__drawer-label">Navigate</p>
        <div className="nav__drawer-tabs" role="tablist">
          {mainNavTabs}
        </div>
        <div className="nav__drawer-divider" aria-hidden="true" />
        <div className="nav__drawer-actions">
          {navDrawerActions}
        </div>
      </aside>

      {/* Render Main Views based on active tab state */}
      {activeMainTab === 'masterclass' && (
        <main id="main" className="coaching-home">
          {/* ── V2 Hero (2-column: copy + CTA left, video right) ── */}
          <V2HeroSection
            nextMc={nextMasterclass}
            onReserve={openBooking}
            reserved={nextMcReserved}
            onManage={goToAccount}
            onRoadmap={() => { setActiveMainTab('roadmap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onExploreCurriculum={() => {
              const el = document.getElementById('v2-curriculum');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          {/* ── How it works: 3-step register explainer (Krish Naik style) ── */}
          {V2_CONFIG.showHowItWorks && <V2HowItWorks nextMc={nextMasterclass} />}

          {/* ── On-page curriculum — what "Explore the curriculum" scrolls to ── */}
          {V2_CONFIG.showCurriculumSection && (
            <V2Curriculum nextMc={nextMasterclass} onReserve={openBooking} reserved={nextMcReserved} onManage={goToAccount} />
          )}

          {/* ── Not sure where to start? → Roadmap ── */}
          {V2_CONFIG.showWhereToStart && (
            <V2WhereToStart onRoadmap={() => { setActiveMainTab('roadmap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          )}

          {/* ── Thin testimonial band — disabled until we have real YouTube reviews ── */}
          {V2_CONFIG.showQuoteBand && <V2QuoteBand />}

          {/* ── Follow cards: YouTube · LinkedIn · GitHub · Instagram ── */}
          <V2FollowGrid />

          {(() => {
            const activeMasterclasses = masterclasses.filter(m => !m.deleted && m.status !== 'deleted');
            const activeSessions = sessions.filter(s => !s.deleted && s.status !== 'deleted');

            return (
              <>
                {/* ── AI-Structured Masterclasses (Split-Pane UI) ── */}
                {activeMasterclasses.length > 0 && (
                  <div id="masterclasses" style={{ marginBottom: activeSessions.length > 0 ? "56px" : "0" }}>
                    {activeMasterclasses.map((mc, idx) => (
                      <MasterclassCard 
                        key={mc.id}
                        mc={mc}
                        idx={idx}
                        user={user}
                        onBook={openBooking}
                        reserved={isMcReserved(mc)}
                        onManage={goToAccount}
                      />
                    ))}
                  </div>
                )}

                {/* ── Legacy Session Cards (shown when no masterclasses yet, or as secondary) ── */}
                {(loadingSessions || loadingMasterclasses) && activeMasterclasses.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px", color: "var(--fg-faint)" }}>
                    <div style={{ fontSize: "14px", fontFamily: "JetBrains Mono" }}>Loading classes…</div>
                  </div>
                ) : activeMasterclasses.length === 0 && activeSessions.length === 0 && !nextMasterclass ? (
                  <div className="coaching-empty">
                    <div className="coaching-empty__icon">📅</div>
                    <h2 className="coaching-empty__title">Classes schedule pending</h2>
                    <p className="coaching-empty__desc">Our staff is currently preparing the next set of live workshops. Check back shortly!</p>
                  </div>
                ) : activeSessions.length > 0 && (
                  <>
                    {activeMasterclasses.length > 0 && (
                      <div style={{ marginBottom: "24px" }}>
                        <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", marginBottom: "20px" }}>
                          More upcoming sessions
                        </div>
                      </div>
                    )}
                    <RevealOnScroll>
                      <div className="session-grid">
                      {activeSessions.map(s => (
                        <article key={s.id} className="session-card">
                          <h2 className="session-card__title">{s.title}</h2>
                          <p className="session-card__desc">{s.description}</p>
                          
                          <div className="session-card__meta">
                            <div className="session-card__badge">
                              <svg className="session-card__badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                              </svg>
                              <span>{(() => { const d = s.dateTime ? new Date(s.dateTime) : null; return d && !isNaN(d) ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date TBA'; })()}</span>
                            </div>
                            <div className="session-card__badge">
                              <svg className="session-card__badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                              </svg>
                              <span>Instructor: {s.instructor || "Balaji Chippada"}</span>
                            </div>
                          </div>

                          <div className="session-card__price-row">
                            <span className="session-card__price-label">Registration Ticket</span>
                            <span className="session-card__price">{isMcFree(s) ? 'Free' : `₹${(s.price || 0).toLocaleString()}`}</span>
                          </div>

                          <ShimmerButton
                            variant="dark"
                            onClick={() => isMcReserved(s) ? goToAccount() : openBooking(s)}
                          >
                            {isMcReserved(s) ? 'You’re registered ✓' : (isMcFree(s) ? <>Reserve · <V2McPrice mc={s} /></> : 'Book Seat')}
                          </ShimmerButton>
                        </article>
                      ))}
                      </div>
                    </RevealOnScroll>
                  </>
                )}
              </>
            );
          })()}

          {/* ── Instructor Bio Strip ── */}
          <InstructorBio />

          {/* ── Success Stories — disabled until we curate real YouTube reviews ── */}
          {V2_CONFIG.showSuccessStories && <V2SuccessStories />}

          {window.V2RoadmapTeaser && (
            <window.V2RoadmapTeaser 
              onRoadmap={() => { setActiveMainTab('roadmap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onLeadCapture={() => {}}
            />
          )}

          <V2FAQSection onLegal={setLegalPage} />

          {/* ── Closing CTA Section ── */}
          <V2ClosingCTA nextMc={nextMasterclass} onReserve={openBooking} reserved={nextMcReserved} onManage={goToAccount} />

        </main>
      )}

      {activeMainTab === 'roadmap' && (
        <RoadmapView
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          scrollToPhase={scrollToPhase}
          scrollToCapstone={scrollToCapstone}
          scrollToAgenda={scrollToAgenda}
          agendaRef={agendaRef}
          totalSections={totalSections}
          capstoneTiles={capstoneTiles}
          phaseRefs={phaseRefs}
          capstoneRefs={capstoneRefs}
          videoLinks={videoLinks}
          user={user}
          roadmapProgress={roadmapProgress}
          onStartTracking={handleStartTracking}
          onVideoProgress={handleVideoProgress}
          onOpenLogin={() => { setLoginError(''); setStaffLoginOpen(true); }}
          onDownloadRoadmap={() => handleOpenLeadModal('/roadmap', 'roadmap_hero_cta')}
          onGatedDownloadClick={(url, src) => handleOpenLeadModal(url, src)}
        />
      )}

      {activeMainTab === 'mybookings' && user && !user.isAnonymous && (
        <V2StudentDashboard
          user={user}
          db={db}
          roadmapProgress={roadmapProgress}
          deletedSessionIds={deletedSessionIds}
          onGoToRoadmap={handleGoToRoadmap}
          onReserve={() => { setActiveMainTab('masterclass'); openBooking(nextMasterclass); }}
        />
      )}

      {activeMainTab === 'dashboard' && canSeeStaffTabs && (
        <DashboardView
          user={user}
          role={userRole}
          onLogout={handleLogout}
        />
      )}

      {activeMainTab === 'emailtasks' && canSeeAdminTabs && (
        <div className="email-tasks-page">
          <AdminEmailTasks />
        </div>
      )}

      {activeMainTab === 'home' && (
        <CoursesTabView setActiveMainTab={setActiveMainTab} setLegalPage={setLegalPage} />
      )}

      {/* ── Site footer — shown on every tab ── */}
      <SiteFooter setActiveMainTab={setActiveMainTab} setLegalPage={setLegalPage} />


      {/* ===============================================================
          MODALS & OVERLAYS
      =============================================================== */}

      {/* 1. V2 Booking Wizard */}
      {(bookingSession || bookingSuccess) && (
        <V2BookingWizard
          session={bookingSession}
          step={bookingStep}
          setStep={setBookingStep}
          user={user}
          selectedTier={selectedTier}
          setSelectedTier={setSelectedTier}
          bookingName={bookingName}
          setBookingName={setBookingName}
          bookingEmail={bookingEmail}
          setBookingEmail={setBookingEmail}
          bookingPhone={bookingPhone}
          setBookingPhone={setBookingPhone}
          bookingLoading={bookingLoading}
          bookingError={bookingError}
          onClose={closeBooking}
          onGoogleLogin={handleGoogleLoginForBooking}
          onSubmitPayment={handleBookingSubmit}
          successData={bookingSuccess}
          setActiveMainTab={setActiveMainTab}
        />
      )}

      {/* 2. Simulated Razorpay Checkout Gateway Sandbox (dev only) */}
      {mockCheckoutData && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ border: "1px solid var(--c-amber)" }} role="dialog" aria-modal="true" aria-label="Simulated payment gateway">
            <button className="modal-close" onClick={() => setMockCheckoutData(null)} aria-label="Close">×</button>
            <div className="coaching-home__eyebrow" style={{ color: "var(--c-amber)", border: "1px solid var(--c-amber)" }}>
              Simulated Razorpay Gateway
            </div>
            <h2 className="modal-title">Razorpay <em>Sandbox</em></h2>
            <p className="modal-desc" style={{ marginBottom: "20px" }}>
              Secure sandbox simulation. Exercises the server Cloud Functions webhook integration directly from browser.
            </p>

            <div className="phase__weeks-block" style={{ marginTop: 0, padding: "16px 20px", marginBottom: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--fg-dim)", marginBottom: "6px" }}>
                <span>Order ID:</span>
                <span className="mono" style={{ fontSize: "12px" }}>{mockCheckoutData.orderId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--fg-dim)", marginBottom: "6px" }}>
                <span>Masterclass:</span>
                <b>{mockCheckoutData.session.title}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--fg-dim)" }}>
                <span>Charge Amount:</span>
                <b style={{ color: "var(--c-amber)" }}>₹{(mockCheckoutData.amount / 100).toFixed(2)}</b>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button 
                type="button" 
                className="form-btn" 
                style={{ background: "var(--c-rust)", color: "#fff" }}
                disabled={bookingLoading}
                onClick={handleSimulatePayment}
              >
                {bookingLoading ? "Calling Webhook..." : "Authorize Mock Capture Signature"}
              </button>
              <button 
                type="button" 
                className="dashboard__logout-btn" 
                onClick={() => setMockCheckoutData(null)}
              >
                Cancel / Decline Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Staff/Client Registration & Login Modal */}
      {staffLoginOpen && (
        <div className="modal-overlay" onClick={() => { setStaffLoginOpen(false); setSignupOtpSent(false); setSignupOtp(""); }}>
          <div className="modal-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isRegistering ? 'Create an account' : 'Sign in'}>
            <button className="modal-close" onClick={() => { setStaffLoginOpen(false); setSignupOtpSent(false); setSignupOtp(""); }} aria-label="Close">×</button>
            <h2 className="modal-title">
              {isRegistering ? "Create an account" : <>Sign in to <em>Account</em></>}
            </h2>
            <p className="modal-desc" style={{ marginBottom: "24px" }}>
              {isRegistering 
                ? "Sign up to get access to upcoming cohorts and start learning for free" 
                : "Log in to access your learning dashboard, sessions, and custom tools."}
            </p>

            {loginError && (
              <div className="status-box status-box--error" style={{ padding: "12px 16px", marginBottom: "20px" }}>
                <span>⚠</span>
                <span>{loginError}</span>
              </div>
            )}

            {isRegistering && signupOtpSent ? (
              <form onSubmit={handleVerifySignup}>
                <p className="modal-desc" style={{ marginTop: "-8px", marginBottom: "20px" }}>
                  We sent a 6-digit code to <strong>{loginEmail}</strong>. Enter it to verify your email and finish creating your account.
                </p>
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-otp">6-digit code</label>
                  <input
                    type="text" id="signup-otp" name="otp" className="form-input" placeholder="••••••"
                    value={signupOtp}
                    onChange={e => setSignupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" maxLength={6} autoComplete="one-time-code" required autoFocus
                    style={{ letterSpacing: "0.3em", fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <button type="submit" className="form-btn form-btn--accent" disabled={loginLoading} style={{ background: "var(--c-pink)", color: "#fff" }}>
                  {loginLoading ? "Verifying…" : "Verify & create account"}
                </button>
                <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--fg-dim)" }}>
                  <button type="button" onClick={handleResendSignupOtp} disabled={loginLoading}
                    style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
                    Resend code
                  </button>
                  {" · "}
                  <button type="button" onClick={() => { setSignupOtpSent(false); setSignupOtp(""); setLoginError(""); }}
                    style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
                    Edit details
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleStaffLogin}>
              {isRegistering && (
                <div className="form-group">
                  <label className="form-label">Full Name <span style={{ color: "var(--c-pink)" }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter your full name" 
                    value={regName}
                    onChange={e => setRegName(window.V2_VALIDATE ? window.V2_VALIDATE.cleanName(e.target.value) : e.target.value)}
                    maxLength={60}
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="signin-email">Email address <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input
                  type="email"
                  id="signin-email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your full email address"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signin-password">Password <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input
                  type="password"
                  id="signin-password"
                  name="password"
                  className="form-input"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  required
                />
              </div>

              {!isRegistering && (
                <div style={{ textAlign: "right", marginTop: "-10px", marginBottom: "6px" }}>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(loginEmail); setForgotError(""); setForgotMsg(""); setForgotStep("email"); setStaffLoginOpen(false); }}
                    style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", font: "inherit", fontSize: "13px", textDecoration: "underline" }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {isRegistering && (
                <React.Fragment>
                  <div className="form-group">
                    <label className="form-label">Phone Number <span style={{ color: "var(--c-pink)" }}>*</span></label>
                    <V2PhoneField value={regPhone} onChange={setRegPhone} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">What Describes You Best <span style={{ color: "var(--c-pink)" }}>*</span></label>
                    <div className="form-radio-group">
                      <label className="form-radio-label">
                        <input 
                          type="radio" 
                          name="userType" 
                          value="Student" 
                          checked={regUserType === "Student"} 
                          onChange={e => setRegUserType(e.target.value)}
                          required
                        />
                        <span className="form-radio-custom"></span>
                        Student
                      </label>
                      <label className="form-radio-label">
                        <input 
                          type="radio" 
                          name="userType" 
                          value="Working Professional" 
                          checked={regUserType === "Working Professional"} 
                          onChange={e => setRegUserType(e.target.value)}
                          required
                        />
                        <span className="form-radio-custom"></span>
                        Working Professional
                      </label>
                    </div>
                  </div>
                </React.Fragment>
              )}

              <button 
                type="submit" 
                className="form-btn form-btn--accent" 
                disabled={loginLoading}
                style={isRegistering ? { background: "var(--c-pink)", color: "#fff" } : {}}
              >
                {loginLoading ? "Loading..." : isRegistering ? "Create Account" : "Sign In"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "20px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono", color: "var(--fg-faint)", textTransform: "uppercase" }}>or</span>
                <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
              </div>

              <button 
                type="button" 
                className="form-btn" 
                style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: 0 }}
                onClick={handleGoogleLogin}
                disabled={loginLoading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                {isRegistering ? "Sign Up with Google" : "Sign In with Google"}
              </button>

              {/* Point-of-request disclosure. Google's OAuth review checks that the
                  app is transparent about what it asks for at the moment it asks,
                  not only in the privacy policy. Links open in a new tab so the
                  half-filled sign-in form isn't lost. */}
              <p style={{ marginTop: "12px", marginBottom: 0, fontSize: "12.5px", lineHeight: 1.6, color: "var(--fg-faint)", textAlign: "center" }}>
                Google sign-in shares your name, email address and profile picture — nothing else.{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-rust)" }}>Privacy Policy</a>
                {" · "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-rust)" }}>Terms</a>
              </p>

              <div style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--fg-dim)" }}>
                {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
                <button 
                  type="button" 
                  style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", textDecoration: "underline", font: "inherit", fontWeight: "500" }}
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setLoginError("");
                    setSignupOtpSent(false);
                    setSignupOtp("");
                  }}
                >
                  {isRegistering ? "Sign in" : "Register now"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Forgot-password (OTP) modal */}
      {forgotStep && (
        <div className="modal-overlay" onClick={closeForgot} style={{ zIndex: 1100 }}>
          <div className="modal-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reset your password">
            <button className="modal-close" onClick={closeForgot} aria-label="Close">×</button>
            <h2 className="modal-title">Reset <em>password</em></h2>
            <p className="modal-desc" style={{ marginBottom: "20px" }}>
              {forgotStep === "email"
                ? "Enter your account email and we'll send you a 6-digit code."
                : forgotStep === "google"
                ? "This account uses Google sign-in."
                : "Enter the 6-digit code we emailed you, then choose a new password."}
            </p>

            {forgotMsg && (
              <div className="status-box status-box--success" style={{ padding: "12px 16px", marginBottom: "16px" }}>
                <span>✔</span><span>{forgotMsg}</span>
              </div>
            )}
            {forgotError && (
              <div className="status-box status-box--error" style={{ padding: "12px 16px", marginBottom: "16px" }}>
                <span>⚠</span><span>{forgotError}</span>
              </div>
            )}

            {forgotStep === "email" ? (
              <form onSubmit={handleRequestReset}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email address</label>
                  <input
                    type="email" id="forgot-email" name="email" className="form-input"
                    placeholder="you@gmail.com" value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    autoComplete="email" inputMode="email" required autoFocus
                  />
                </div>
                <button type="submit" className="form-btn form-btn--accent" disabled={forgotLoading}>
                  {forgotLoading ? "Sending…" : "Send code"}
                </button>
              </form>
            ) : forgotStep === "google" ? (
              <div>
                <p style={{ fontSize: "14px", color: "var(--fg-dim)", lineHeight: 1.5, marginBottom: "20px" }}>
                  You signed up with <strong>Google</strong>, so there's no password to reset — just use the
                  button below. If you'd prefer to set a password as well, you can do that instead.
                </p>
                <button
                  type="button"
                  className="form-btn"
                  style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}
                  onClick={() => { closeForgot(); handleGoogleLogin(); }}
                  disabled={forgotLoading}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </button>
                <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--fg-dim)" }}>
                  <button type="button" onClick={handleResetAnyway} disabled={forgotLoading}
                    style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
                    {forgotLoading ? "Sending…" : "Reset my password anyway"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmReset}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-otp">6-digit code</label>
                  <input
                    type="text" id="forgot-otp" name="otp" className="form-input"
                    placeholder="••••••" value={forgotOtp}
                    onChange={e => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" maxLength={6} autoComplete="one-time-code" required autoFocus
                    style={{ letterSpacing: "0.3em", fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-newpw">New password</label>
                  <input
                    type="password" id="forgot-newpw" name="new-password" className="form-input"
                    placeholder="At least 6 characters" value={forgotNewPw}
                    onChange={e => setForgotNewPw(e.target.value)} autoComplete="new-password" required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-newpw2">Confirm new password</label>
                  <input
                    type="password" id="forgot-newpw2" name="confirm-password" className="form-input"
                    placeholder="Re-enter new password" value={forgotNewPw2}
                    onChange={e => setForgotNewPw2(e.target.value)} autoComplete="new-password" required
                  />
                </div>
                <button type="submit" className="form-btn form-btn--accent" disabled={forgotLoading}>
                  {forgotLoading ? "Resetting…" : "Reset password"}
                </button>
                <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--fg-dim)" }}>
                  Didn't get the code?{" "}
                  <button type="button" onClick={() => requestCode(forgotForce)} disabled={forgotLoading}
                    style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
                    Resend
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3.5 Lead Capture Modal */}
      {(() => {
        const V2LeadCaptureModal = window.V2LeadCaptureModal;
        if (!V2LeadCaptureModal) return null;
        return (
          <V2LeadCaptureModal
            open={leadModalOpen}
            onClose={() => setLeadModalOpen(false)}
            source={leadModalSource}
            downloadUrl={leadModalDownloadUrl}
            onSuccess={() => {}}
          />
        );
      })()}

      {/* 4. Forced Profile Completion Modal */}
      {showCompleteProfile && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-container" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Complete your profile">
            <h2 className="modal-title">Complete <em>Profile</em></h2>
            <p className="modal-desc" style={{ marginBottom: "24px" }}>
              Just a few more details to set up your account and start learning.
            </p>

            {loginError && (
              <div className="status-box status-box--error" style={{ padding: "12px 16px", marginBottom: "20px" }}>
                <span>⚠</span>
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteProfileSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter your full name" 
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                  value={user ? user.email : ""}
                  autoComplete="email"
                  disabled
                  readOnly
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <V2PhoneField value={regPhone} onChange={setRegPhone} required />
              </div>

              <div className="form-group">
                <label className="form-label">What Describes You Best <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <div className="form-radio-group">
                  <label className="form-radio-label">
                    <input 
                      type="radio" 
                      name="completeUserType" 
                      value="Student" 
                      checked={regUserType === "Student"} 
                      onChange={e => setRegUserType(e.target.value)}
                      required
                    />
                    <span className="form-radio-custom"></span>
                    Student
                  </label>
                  <label className="form-radio-label">
                    <input 
                      type="radio" 
                      name="completeUserType" 
                      value="Working Professional" 
                      checked={regUserType === "Working Professional"} 
                      onChange={e => setRegUserType(e.target.value)}
                      required
                    />
                    <span className="form-radio-custom"></span>
                    Working Professional
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                className="form-btn form-btn--accent" 
                disabled={loginLoading}
                style={{ background: "var(--c-pink)", color: "#fff" }}
              >
                {loginLoading ? "Saving Profile..." : "Complete Account Setup"}
              </button>
              <div style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--fg-dim)" }}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--fg-faint)", cursor: "pointer", textDecoration: "underline", font: "inherit" }}
                  onClick={() => { setShowCompleteProfile(false); handleLogout(); }}
                >
                  Not now — sign out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Command Palette Overlay */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onJumpPhase={scrollToPhase}
        onJumpCapstone={scrollToCapstone}
        videoLinks={videoLinks}
      />

      {/* Dock component (Rendered only if Full Roadmap active) */}
      {activeMainTab === 'roadmap' && (
        <div className={`dock ${dockVisible ? 'visible' : ''}`}>
          {window.ROADMAP.map((p, i) => (
            <button key={p.id}
              type="button"
              aria-label={`Jump to phase ${String(p.id).padStart(2, '0')}: ${p.title}`}
              ref={el => dockNodeRefs.current[i] = el}
              className="dock__node"
              data-color={p.color}
              onClick={() => scrollToPhase(i)}>
              {String(p.id).padStart(2, '0')}
              <span className="dock__node-tooltip">{p.short}</span>
            </button>
          ))}
          <div className="dock__progress">
            <div className="dock__progress-fill" ref={progressFillRef} />
            <div className="dock__progress-dot" ref={progressDotRef} />
          </div>
        </div>
      )}

      <V2MobileStickyBar nextMc={nextMasterclass} onReserve={openBooking} reserved={nextMcReserved} onManage={goToAccount} />
      <V2WhatsAppButton />
      <V2LegalModal page={legalPage} onClose={() => setLegalPage(null)} />

    </React.Fragment>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('React ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: '40px', fontFamily: 'monospace', color: '#c00', background: '#fff', fontSize: '13px', whiteSpace: 'pre-wrap' }
      }, React.createElement('strong', null, 'React Error:\n'), (this.state.error && this.state.error.stack) || String(this.state.error));
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ErrorBoundary, null, React.createElement(App, null)));
