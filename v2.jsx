// ===============================================================
// Coaching Site V2 — utilities & components
// ===============================================================

const V2_SITE_URL = 'https://coaching-site-gowtam-2026.web.app';
const V2_ROADMAP_URL = 'https://ch-balaji.github.io/ai-engineer-roadmap/';

// All editable content/copy lives in site.config.js → window.SITE_CONFIG.
// V2_CONFIG below is the legacy feature-flag object; it reads from SITE_CONFIG
// when present (so flipping flags in site.config.js works without code edits).
const _SC = (typeof window !== 'undefined' && window.SITE_CONFIG) || {};
const _FF = _SC.featureFlags || {};
const V2_CONFIG = {
  showWelcomePopup: _FF.showWelcomePopup !== false,
  welcomePopupDelayMs: (_SC.welcomePopup && _SC.welcomePopup.delayMs) || 1800,
  showQuoteBand: _FF.showQuoteBand === true,
  showSuccessStories: _FF.showSuccessStories === true,
  showHowItWorks: _FF.showHowItWorks !== false,
  showWhereToStart: _FF.showWhereToStart !== false,
  showHeroSecondaryCta: _FF.showHeroSecondaryCta !== false,
  showCurriculumSection: _FF.showCurriculumSection !== false,
};

// Brand identity & socials sourced from site.config.js (window.SITE_CONFIG.brand).
// Fallback object below is used if the config file failed to load — keeps the app booting.
const V2_BRAND = Object.assign({
  name: 'Balaji Chippada',
  tagline: 'The Agent Engineer',
  youtubeChannel: 'https://www.youtube.com/@balajichippada',
  roadmapVideoId: 'Eze6D8jAMjI',
  roadmapVideoUrl: 'https://www.youtube.com/watch?v=Eze6D8jAMjI',
  whatsappCommunity: 'https://chat.whatsapp.com/KbBr6JNlToy4e5M34MrOsY?mode=gi_t',
  linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
  instagram: 'https://www.instagram.com/balajichippada',
  github: 'https://github.com/ch-balaji',
}, (_SC.brand || {}));

const V2_SOCIAL = Object.assign({
  youtubeSubs: '17K+',
  roadmapViews: '115K+',
  studentsTrained: '50+',
}, ((_SC.brand && _SC.brand.stats) || {}));

const V2_INSTRUCTOR = Object.assign({
  name: 'Balaji Chippada',
  title: 'Senior AI Engineer · Roadmap creator',
  photo: '',
  bio: 'Builder + teacher of agentic AI systems.',
  linkedin: V2_BRAND.linkedin,
  youtube: V2_BRAND.youtubeChannel,
}, (_SC.instructor || {}));

// Rotating testimonials — read from site.config.js so we can swap in real YouTube comments later.
const V2_HERO_QUOTES = (_SC.heroQuotes && _SC.heroQuotes.length) ? _SC.heroQuotes : [
  { text: 'Shipped my first agent in 3 days — demo-first teaching just works.', author: 'Rahul · SDE, Bengaluru' },
  { text: 'Finally got LLM vs workflow vs agent. Balaji shows the agent running first.', author: 'Sneha · ML engineer' },
];

// Optional configured masterclass — merged into the runtime Firestore doc.
// Lets you edit title/copy/curriculum/thumbnail in code while Firestore handles live state (seats etc).
const V2_CONFIG_MASTERCLASS = _SC.nextMasterclass || null;

// Single source of truth: site.config.js wins for ALL content (title, price,
// dateTime, curriculum, etc). Firestore only contributes runtime state — booked
// seat count, zoom link / recording link the admin pastes later, status.
//
// This is intentional: if you want to change anything visible, edit site.config.js.
function mergeMcWithConfig(mc, masterclasses, sessions) {
  // If the featured masterclass is explicitly marked as deleted in Firestore, we should not fall back to it
  const featuredId = V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id;
  let isFeaturedDeleted = false;
  if (featuredId) {
    isFeaturedDeleted = [...(masterclasses || []), ...(sessions || [])]
      .some(item => item && item.id === featuredId && (item.deleted || item.status === 'deleted'));
  }

  if (mc) {
    // If the dynamic class is the featured one and it's deleted, don't display it
    if (featuredId && mc.id === featuredId && isFeaturedDeleted) {
      return null;
    }
  } else {
    // Fallback mode: if no upcoming dynamic class, check if the config class is deleted or missing
    if (isFeaturedDeleted || !V2_CONFIG_MASTERCLASS) {
      return null;
    }
  }

  if (!V2_CONFIG_MASTERCLASS && !mc) return null;
  if (!V2_CONFIG_MASTERCLASS) return mc;             // no config → use Firestore as-is
  if (!mc) return Object.assign({}, V2_CONFIG_MASTERCLASS, { instructor: V2_INSTRUCTOR });

  // Map dynamic Firestore content so it completely overrides hardcoded details
  const dynamicContent = {
    id: mc.id || mc.uid || V2_CONFIG_MASTERCLASS.id,
    title: mc.title || V2_CONFIG_MASTERCLASS.title,
    shortTitle: mc.shortTitle || mc.title || V2_CONFIG_MASTERCLASS.shortTitle,
    subtitle: mc.description || mc.subtitle || V2_CONFIG_MASTERCLASS.subtitle,
    about: mc.rawSyllabus || mc.description || V2_CONFIG_MASTERCLASS.about,
    dateTime: mc.dateTime || V2_CONFIG_MASTERCLASS.dateTime,
    price: typeof mc.price === 'number' ? mc.price : V2_CONFIG_MASTERCLASS.price,
    videoUrl: mc.videoUrl || mc.youtubeVideoId || mc.videoId || V2_CONFIG_MASTERCLASS.videoUrl || null,
    instructor: Object.assign({}, V2_INSTRUCTOR, 
      typeof mc.instructor === 'object' 
        ? mc.instructor 
        : { name: mc.instructor || V2_INSTRUCTOR.name }
    )
  };

  // Map AI-generated structured syllabus array into curriculum array structure
  if (Array.isArray(mc.syllabus) && mc.syllabus.length > 0) {
    dynamicContent.curriculum = mc.syllabus.map((s, i) => ({
      module: s.index ? `Module ${s.index}` : `Module ${String(i + 1).padStart(2, '0')}`,
      title: s.topicTitle || s.title,
      points: s.subTopics || s.points || []
    }));
  } else if (Array.isArray(mc.curriculum)) {
    dynamicContent.curriculum = mc.curriculum;
  }

  // Runtime live states
  const runtime = {};
  if (typeof mc.seatsBooked === 'number') runtime.seatsBooked = mc.seatsBooked;
  if (mc.seatsTotal) runtime.seatsTotal = mc.seatsTotal;
  if (mc.status) runtime.status = mc.status;
  if (mc.zoomLink) runtime.zoomLink = mc.zoomLink;
  if (mc.recordingUrl) runtime.recordingUrl = mc.recordingUrl;
  if (mc.slidesUrl) runtime.slidesUrl = mc.slidesUrl;
  if (mc.prepPdfUrl) runtime.prepPdfUrl = mc.prepPdfUrl;

  return Object.assign({}, V2_CONFIG_MASTERCLASS, dynamicContent, runtime);
}

function getSeatsRemaining(mc) {
  if (!mc) return 0;
  const total = mc.seatsTotal || 50;
  const booked = mc.seatsBooked || 0;
  return Math.max(0, total - booked);
}

function getNextUpcomingMasterclass(masterclasses, sessions) {
  const all = [...(masterclasses || []), ...(sessions || [])]
    .filter(Boolean)
    .filter(item => !item.deleted && item.status !== 'deleted');
  const now = Date.now();

  // Find all valid upcoming classes in the future
  const upcoming = all
    .filter((item) => item.dateTime && new Date(item.dateTime).getTime() > now)
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  // 1. If there is a dynamic upcoming class in Firestore, advertise it!
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  // 2. If no dynamic upcoming sessions, check if the featured config session was explicitly deleted
  const featuredId = V2_CONFIG_MASTERCLASS && V2_CONFIG_MASTERCLASS.id;
  if (featuredId) {
    const isExplicitlyDeleted = [...(masterclasses || []), ...(sessions || [])]
      .some(item => item && item.id === featuredId && (item.deleted || item.status === 'deleted'));
    if (isExplicitlyDeleted) {
      return null;
    }

    const match = all.find((item) => item && item.id === featuredId);
    if (match) return match;
  }

  // 3. Fallback to null (no upcoming session found)
  return null;
}

function formatMcShortDate(dateTime) {
  if (!dateTime) return 'Date TBA';
  return new Date(dateTime).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
  });
}

function formatMcFullDateTime(dateTime) {
  if (!dateTime) return 'Date TBA';
  const d = new Date(dateTime);
  return `${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
}

function getMcTiers(mc) {
  if (mc && mc.tiers && mc.tiers.length) return mc.tiers;
  const base = getMcPrice(mc);
  return [
    { name: 'Standard', price: base, includes: ['Live session', '30-day recording', 'Slides & GitHub repo'], recommended: true },
  ];
}

// Reads explicit numeric price (including 0 for FREE).
// Defaults to 0 (free) when undefined — safer than silently charging.
// If you want a paid masterclass, set `price` explicitly in site.config.js or Firestore.
function getMcPrice(mc) {
  if (!mc) return 0;
  if (typeof mc.price === 'number') return mc.price;
  if (mc.tiers && mc.tiers[0] && typeof mc.tiers[0].price === 'number') return mc.tiers[0].price;
  return 0;
}

function isMcFree(mc) {
  return getMcPrice(mc) === 0;
}

function formatMcPriceLabel(mc) {
  if (!mc) return '';
  if (isMcFree(mc)) return 'Free to attend';
  return `₹${getMcPrice(mc).toLocaleString()}`;
}

function formatMcPriceShort(mc) {
  if (!mc) return '';
  return isMcFree(mc) ? 'Free' : `₹${getMcPrice(mc).toLocaleString()}`;
}

function padIcs(n) { return String(n).padStart(2, '0'); }

function toIcsDate(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${padIcs(d.getUTCMonth() + 1)}${padIcs(d.getUTCDate())}T${padIcs(d.getUTCHours())}${padIcs(d.getUTCMinutes())}${padIcs(d.getUTCSeconds())}Z`;
}

function generateICS({ title, startDate, endDate, description, location, organizerEmail }) {
  const uid = `${Date.now()}@agentengineer.in`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Agent Engineer//EN', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${toIcsDate(new Date())}`, `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`, `SUMMARY:${title}`, `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location || 'Online'}`, `ORGANIZER:mailto:${organizerEmail || 'balajichippada.20@gmail.com'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function openBookingForSession(session, ctx) {
  if (!session) return;
  // Always merge with site.config.js so the wizard sees the SAME price/title/date
  // the rest of the page is showing — no drift between hero and checkout.
  const merged = mergeMcWithConfig(session) || session;
  ctx.setBookingSession(merged);
  ctx.setBookingStep(1);
  ctx.setBookingSuccess(null);
  ctx.setSelectedTier(getMcTiers(merged)[0]);
  ctx.setBookingName(ctx.user?.displayName || '');
  ctx.setBookingEmail(ctx.user?.email || '');
  ctx.setBookingPhone('');
  ctx.setBookingError('');
}

function getMcOutcome(mc) {
  if (mc?.outcome || mc?.deliverable) return mc.outcome || mc.deliverable;
  const t = (mc?.title || '').toLowerCase();
  if (t.includes('claude')) {
    return 'By the end, you\'ll have a Claude Code agent that autonomously reviews PRs in your repo — with TDD workflow, multi-file refactoring, and a critic feedback loop.';
  }
  if (t.includes('rag')) {
    return 'You\'ll deploy a hybrid retrieval pipeline with a golden eval dataset — and know exactly why your RAG is wrong when it fails.';
  }
  if (t.includes('multi-agent') || t.includes('langgraph') || t.includes('orchestr')) {
    return 'You\'ll build a multi-agent graph with supervisors, tools, and memory — with production traces you can show in interviews.';
  }
  if (t.includes('guardrail') || t.includes('llmops')) {
    return 'You\'ll implement guardrails, eval harnesses, and LLMOps patterns that catch agent failures before users do.';
  }
  return mc?.description || 'Live build session — you ship a working agentic AI system on the call, not just watch slides.';
}

// Click-to-play YouTube thumbnail. No iframe loads until user clicks — faster, no ads on the page,
// and we still capture the watch on YouTube once they click through.
function V2ClickToPlayVideo({ videoId, title, caption }) {
  const [playing, setPlaying] = useState(false);
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className="v2-video-block">
      <div className="v2-video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="v2-video-poster"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${title}`}
            style={{ backgroundImage: `url(${thumbUrl})` }}
          >
            <span className="v2-video-play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      {caption && (
        <p className="v2-video-caption">
          <a href={watchUrl} target="_blank" rel="noopener noreferrer">{caption}</a>
        </p>
      )}
    </div>
  );
}

function V2HeroSocialProof() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % V2_HERO_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const q = V2_HERO_QUOTES[idx];
  return (
    <div className="v2-hero-proof" aria-live="polite">
      <span className="v2-hero-proof-stars" aria-hidden="true">★★★★★</span>
      <span className="v2-hero-proof-text">&ldquo;{q.text}&rdquo;</span>
      <span className="v2-hero-proof-author">— {q.author}</span>
    </div>
  );
}

function V2HeroSection({ nextMc, onReserve, onRoadmap, onExploreCurriculum }) {
  const seats = getSeatsRemaining(nextMc);
  const dateStr = nextMc ? formatMcShortDate(nextMc.dateTime) : 'Coming soon';
  const free = isMcFree(nextMc);

  return (
    <header className="coaching-home__hero v2-hero hero--split">
      <div className="v2-hero-grid">
        {/* LEFT: copy + CTAs */}
        <div className="v2-hero-left">
          <div className="v2-hero-eyebrow">
            <span className="hero__eyebrow-dot" />
            {V2_BRAND.name} · {V2_SOCIAL.roadmapViews} watched on YouTube
          </div>

          <h1 className="v2-hero-title">
            <span className="v2-hero-title-line">Learn from a builder.</span>
            <em className="v2-hero-title-em">Become one.</em>
          </h1>

          <p className="v2-hero-sub">
            Live build sessions where you ship a production-grade agent on the call —
            demo first, then we build together. Not ChatGPT tips. Not hype.
          </p>

          <p className="v2-hero-telugu">
            English + Telugu · built for Indian engineers
          </p>

          <div className="v2-hero-actions">
            <button
              type="button"
              className="v2-hero-cta"
              onClick={() => onReserve(nextMc)}
              disabled={!nextMc}
            >
              {nextMc ? (
                <>
                  <span className="v2-hero-cta-text">
                    {free ? `Reserve free seat · ${dateStr}` : `Book my seat · ${formatMcPriceShort(nextMc)} · ${dateStr}`}
                  </span>
                  <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
                </>
              ) : (
                'Next masterclass dropping soon'
              )}
            </button>
            {V2_CONFIG.showHeroSecondaryCta && (
              <button
                type="button"
                className="v2-hero-cta v2-hero-cta--ghost"
                onClick={onExploreCurriculum || onRoadmap}
              >
                <span className="v2-hero-cta-text">Explore the curriculum</span>
                <span className="v2-hero-cta-icon" aria-hidden="true">→</span>
              </button>
            )}
          </div>

          {nextMc && (
            <p className="v2-hero-microcopy">
              {free ? (
                <>
                  <span className="v2-hero-microcopy-lock" aria-hidden="true">🎟️</span>
                  Free to attend · Calendar invite + Zoom link emailed instantly
                </>
              ) : (
                <>
                  <span className="v2-hero-microcopy-lock" aria-hidden="true">🔒</span>
                  Razorpay · 100% refund within 24h
                </>
              )}
              {seats > 0 && (
                <>
                  {' · '}
                  <span className="v2-hero-microcopy-seats">{seats} of {nextMc.seatsTotal || 50} seats left</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* RIGHT: video */}
        <div className="v2-hero-right">
          {(() => {
            const dynamicVideoUrl = nextMc?.videoUrl || nextMc?.youtubeVideoId || nextMc?.videoId;
            let finalVideoId = V2_BRAND.roadmapVideoId;
            let isCustomVideo = false;

            if (dynamicVideoUrl) {
              const trimmed = dynamicVideoUrl.trim();
              if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
                finalVideoId = trimmed;
                isCustomVideo = true;
              } else {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = trimmed.match(regExp);
                if (match && match[2].length === 11) {
                  finalVideoId = match[2];
                  isCustomVideo = true;
                }
              }
            }

            const titleText = isCustomVideo 
              ? `${nextMc.title || "Masterclass"} Promo — Balaji Chippada` 
              : "Agentic AI Engineer Roadmap 2026 — Balaji Chippada";
            
            const captionText = isCustomVideo
              ? `Watch masterclass trailer · Watch on YouTube`
              : `99% People Learn AI Wrong · ${V2_SOCIAL.roadmapViews} views · Watch on YouTube`;

            return (
              <V2ClickToPlayVideo
                videoId={finalVideoId}
                title={titleText}
                caption={captionText}
              />
            );
          })()}
        </div>
      </div>

      {/* Anchor stat row — mirrors the roadmap hero rhythm */}
      <div className="hero__stats v2-hero-stats">
        <div>
          <div className="hero__stat-num">{V2_SOCIAL.roadmapViews}</div>
          <div className="hero__stat-label">Roadmap views</div>
        </div>
        <div>
          <div className="hero__stat-num">{V2_SOCIAL.youtubeSubs}</div>
          <div className="hero__stat-label">Subscribers</div>
        </div>
        <div>
          <div className="hero__stat-num">3hr</div>
          <div className="hero__stat-label">Live session</div>
        </div>
        <div>
          <div className="hero__stat-num">{free ? 'Free' : '24h'}</div>
          <div className="hero__stat-label">{free ? 'First class' : '100% refund'}</div>
        </div>
      </div>
    </header>
  );
}

// Thin centered testimonial band — sits between the hero and the social cards.
// No borders, no dividers — just a quote with the rotating quote component.
function V2QuoteBand() {
  return (
    <section className="v2-quote-band" aria-label="Student testimonial">
      <V2HeroSocialProof />
    </section>
  );
}

function V2BookingWizard({
  session, step, setStep, user, selectedTier, setSelectedTier,
  bookingName, setBookingName, bookingEmail, setBookingEmail, bookingPhone, setBookingPhone,
  bookingLoading, bookingError, onClose, onGoogleLogin, onSubmitPayment, onSuccess,
  successData, setActiveMainTab,
}) {
  if (!session) return null;
  const tiers = getMcTiers(session);
  const tier = selectedTier || tiers[0];
  const price = typeof tier?.price === 'number' ? tier.price : getMcPrice(session);
  const free = price === 0;
  const seats = getSeatsRemaining(session);

  if (successData) {
    const start = session.dateTime ? new Date(session.dateTime) : new Date();
    const end = new Date(start.getTime() + (session.duration || 180) * 60000);
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container v2-booking-modal" onClick={(e) => e.stopPropagation()}>
          <div className="v2-booking-success">
            <div className="v2-success-icon">✅</div>
            <h2 className="modal-title">You&apos;re in!</h2>
            <p className="modal-desc"><strong>{session.title}</strong><br />{formatMcFullDateTime(session.dateTime)}</p>
            <p className="v2-booking-hint" style={{ marginTop: '8px' }}>
              Confirmation sent to <strong>{bookingEmail}</strong>. Zoom link drops 15 minutes before the session.
            </p>
            <div className="v2-success-actions">
              <button type="button" className="form-btn" onClick={() => generateICS({
                title: session.title, startDate: start, endDate: end,
                description: `Masterclass with Balaji Chippada. Zoom link will be emailed before the session.`,
                location: session.zoomLink || 'Online',
              })}>📅 Add to Calendar</button>
              <a href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer" className="form-btn v2-btn-secondary">
                💬 Join WhatsApp Community
              </a>
              {!user || user.isAnonymous ? (
                <button type="button" className="form-btn v2-btn-secondary" onClick={onGoogleLogin} disabled={bookingLoading}>
                  Save my booking · Sign in with Google
                </button>
              ) : (
                <button type="button" className="form-btn v2-btn-secondary" onClick={() => { onClose(); setActiveMainTab('mybookings'); }}>
                  Go to My Dashboard →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container v2-booking-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {!free && (
          <div className="v2-step-indicator">
            <span className={step >= 1 ? 'active' : ''}>① Your details</span>
            <span>→</span>
            <span className={step >= 2 ? 'active' : ''}>② Pay securely</span>
          </div>
        )}

        <h2 className="modal-title">{free ? 'Reserve your free seat' : 'Reserve your seat'}</h2>
        <p className="modal-desc">
          <strong>{session.title}</strong><br />
          {formatMcFullDateTime(session.dateTime)}
        </p>

        {seats > 0 && seats <= 10 && (
          <div className="v2-modal-urgency">
            🔥 Only {seats} seats left
          </div>
        )}

        {bookingError && (
          <div className="status-box status-box--error" style={{ padding: '12px 16px', marginBottom: '16px' }}>
            <span>⚠</span><span>{bookingError}</span>
          </div>
        )}

        {step === 1 && (
          <form className="v2-booking-step" onSubmit={(e) => {
            e.preventDefault();
            if (!bookingName.trim() || !bookingEmail.trim()) {
              return;
            }
            // FREE → submit straight from this form. PAID → continue to payment step.
            if (free) {
              onSubmitPayment();
            } else {
              setStep(2);
            }
          }}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                type="text"
                className="form-input"
                value={bookingName}
                onChange={(e) => setBookingName(e.target.value)}
                placeholder="Your name on the certificate"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={bookingEmail}
                onChange={(e) => setBookingEmail(e.target.value)}
                placeholder="you@example.com"
                required
                readOnly={!!(user && !user.isAnonymous && bookingEmail)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone <span className="form-label-hint">(optional · for WhatsApp reminders)</span></label>
              <input
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={bookingPhone}
                onChange={(e) => setBookingPhone(e.target.value)}
              />
            </div>

            <div className="v2-order-summary">
              <div className="v2-order-summary-row">
                <span>One live session · 3 hours · recording included</span>
                <span className="v2-order-price">{free ? 'Free' : `₹${price.toLocaleString()}`}</span>
              </div>
            </div>

            <button type="submit" className="form-btn v2-pay-btn" disabled={bookingLoading}>
              {free
                ? (bookingLoading ? 'Reserving…' : 'Confirm my free seat →')
                : 'Continue to payment →'}
            </button>
            <p className="v2-booking-hint">
              {free
                ? 'No payment, no account needed. We\u2019ll email your Zoom link instantly.'
                : 'No account needed. We\u2019ll email your Zoom link instantly.'}
            </p>
          </form>
        )}

        {step === 2 && !free && (
          <div className="v2-booking-step">
            <div className="v2-order-summary">
              <div className="v2-order-summary-row">
                <span><strong>{session.title}</strong></span>
                <span className="v2-order-price">₹{price.toLocaleString()}</span>
              </div>
              <div className="v2-order-summary-sub">
                {formatMcFullDateTime(session.dateTime)}
              </div>
              <div className="v2-order-summary-sub">
                {bookingName} · {bookingEmail}
              </div>
            </div>
            <button type="button" className="form-btn v2-pay-btn" disabled={bookingLoading} onClick={onSubmitPayment}>
              {bookingLoading ? 'Processing…' : `Pay ₹${price.toLocaleString()} securely →`}
            </button>
            <p className="v2-booking-hint">🔒 Razorpay · UPI · card · netbanking · 100% refund within 24h</p>
            <button type="button" className="v2-modal-back" onClick={() => setStep(1)}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

function V2StudentDashboard({ user, db, onReserve }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [inquiry, setInquiry] = useState('');
  const [inquirySent, setInquirySent] = useState(false);

  useEffect(() => {
    if (!db || !user) { setLoading(false); return; }
    const unsub = db.collection('users').doc(user.uid).collection('bookings')
      .orderBy('bookedAt', 'desc')
      .onSnapshot((snap) => {
        const list = [];
        snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setBookings(list);
        setLoading(false);
      }, () => {
        db.collection('registrations').where('studentEmail', '==', user.email).get().then((snap) => {
          const list = [];
          snap.forEach((doc) => list.push({ id: doc.id, ...doc.data(), masterclassTitle: doc.data().sessionTitle }));
          setBookings(list);
          setLoading(false);
        }).catch(() => setLoading(false));
      });
    return () => unsub();
  }, [user, db]);

  useEffect(() => {
    if (!db || !user) return;
    db.collection('users').doc(user.uid).get().then((doc) => {
      if (doc.exists) {
        setProfileName(doc.data().name || user.displayName || '');
        setProfilePhone(doc.data().phone || '');
      }
    });
  }, [user, db]);

  const now = Date.now();
  const upcoming = bookings.filter((b) => {
    const d = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
    return b.status === 'confirmed' || b.status === 'completed' ? (d ? d.getTime() >= now - 3600000 : true) : false;
  });
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').filter((b) => {
    const d = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
    return d && d.getTime() < now - 3600000;
  });

  const saveProfile = async () => {
    if (!db || !user) return;
    setSaving(true);
    await db.collection('users').doc(user.uid).set({ name: profileName, phone: profilePhone }, { merge: true });
    setSaving(false);
  };

  const submitInquiry = async () => {
    if (!db || !user || !inquiry.trim()) return;
    await db.collection('inquiries').add({
      userId: user.uid, email: user.email, message: inquiry.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setInquiry('');
    setInquirySent(true);
  };

  if (loading) return <div className="v2-dashboard"><p className="v2-dashboard-loading">Loading your masterclasses…</p></div>;

  return (
    <div className="v2-dashboard">
      <h1 className="v2-dashboard-title">My Masterclasses</h1>
      <section className="v2-dash-section">
        <h2>Upcoming Sessions</h2>
        {upcoming.length === 0 ? (
          <p className="v2-empty">No upcoming sessions. <button type="button" className="v2-link-btn" onClick={() => { window.scrollTo({ top: 0 }); onReserve && onReserve(); }}>Browse masterclasses</button></p>
        ) : upcoming.map((b) => {
          const sessionDate = b.sessionDate?.toDate ? b.sessionDate.toDate() : (b.sessionDate ? new Date(b.sessionDate) : null);
          const minsUntil = sessionDate ? (sessionDate.getTime() - now) / 60000 : 9999;
          const canJoin = minsUntil <= 15 && minsUntil >= -30 && b.zoomLink;
          return (
            <div key={b.id} className="v2-session-card upcoming">
              {minsUntil <= 1440 && minsUntil > 0 && <div className="v2-live-badge">Starts in {Math.round(minsUntil)} min</div>}
              <h3>{b.masterclassTitle || b.sessionTitle}</h3>
              <p>{sessionDate ? formatMcFullDateTime(sessionDate) : 'Date TBA'}</p>
              <div className="v2-session-actions">
                {canJoin && b.zoomLink && <a href={b.zoomLink} target="_blank" rel="noopener noreferrer" className="form-btn">Join Live →</a>}
                {sessionDate && (
                  <button type="button" className="v2-btn-secondary" onClick={() => generateICS({
                    title: b.masterclassTitle || b.sessionTitle,
                    startDate: sessionDate,
                    endDate: new Date(sessionDate.getTime() + 180 * 60000),
                    location: b.zoomLink || 'Online',
                  })}>Add to Calendar</button>
                )}
                {b.prepPdfUrl && <a href={b.prepPdfUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Prep Guide</a>}
              </div>
            </div>
          );
        })}
      </section>
      <section className="v2-dash-section">
        <h2>Past Sessions</h2>
        {past.length === 0 ? <p className="v2-empty">No past sessions yet.</p> : past.map((b) => (
          <div key={b.id} className="v2-session-card">
            <h3>{b.masterclassTitle || b.sessionTitle}</h3>
            <div className="v2-session-actions">
              {b.recordingUrl && <a href={b.recordingUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Watch Recording</a>}
              {b.slidesUrl && <a href={b.slidesUrl} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary">Download Slides</a>}
            </div>
          </div>
        ))}
      </section>
      <section className="v2-dash-section">
        <h2>Profile</h2>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} /></div>
        <button type="button" className="form-btn" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
      </section>
      <section className="v2-dash-section">
        <h2>Ask a Question</h2>
        <textarea className="form-input" rows={3} placeholder="Submit a question for an upcoming session…" value={inquiry} onChange={(e) => setInquiry(e.target.value)} />
        <button type="button" className="form-btn" style={{ marginTop: '12px' }} onClick={submitInquiry}>Submit Inquiry</button>
        {inquirySent && <p className="v2-success-msg">Question submitted! We&apos;ll respond before your session.</p>}
      </section>
    </div>
  );
}

function V2RoadmapTeaser({ onRoadmap, onEmailCapture }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const phases = (window.ROADMAP || []).slice(0, 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    onEmailCapture(email.trim());
    setSent(true);
  };

  return (
    <section className="v2-roadmap-teaser">
      <h2>The roadmap {V2_SOCIAL.roadmapViews} engineers watched</h2>
      <p>26 weeks · 9 phases · 62 modules · 3 production capstones · free &amp; open source</p>
      <div className="v2-phase-previews">
        {phases.map((p) => (
          <div key={p.id} className="v2-phase-preview">
            <span className="v2-phase-num">Phase {String(p.id).padStart(2, '0')}</span>
            <strong>{p.title}</strong>
            <span>{p.weeks}</span>
          </div>
        ))}
      </div>
      <div className="v2-teaser-actions">
        <button className="hero__secondary-cta" onClick={onRoadmap}>Explore the full roadmap →</button>
        <a className="hero__secondary-cta" href={V2_ROADMAP_URL} target="_blank" rel="noopener noreferrer">Open roadmap website</a>
        <a className="hero__secondary-cta" href={V2_BRAND.roadmapVideoUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
      </div>
      <form className="v2-email-capture" onSubmit={handleSubmit}>
        <input type="email" placeholder="Get roadmap updates — enter email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button type="submit" className="form-btn">{sent ? '✓ Sent!' : 'Notify me'}</button>
      </form>
    </section>
  );
}

function V2FAQSection({ onLegal }) {
  const [open, setOpen] = useState(0);
  const faqs = (_SC.faqs && _SC.faqs.length) ? _SC.faqs : [
    { q: "I'm a beginner — is this too advanced?", a: "If you can write Python and use a terminal — Phase 1 of the free roadmap — you're ready." },
    { q: "What's the refund policy?", a: '100% refund within 24 hours of purchase, no questions asked.', link: 'refund' },
  ];

  return (
    <section className="v2-faq" id="v2-faq">
      <V2SectionHeader
        eyebrow="Got questions?"
        plain="Frequently asked"
        em="questions."
      />
      <div className="v2-faq-list">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`v2-faq-card ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="v2-faq-q"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
              >
                <span className="v2-faq-q-text">{f.q}</span>
                <span className="v2-faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="v2-faq-a">
                  <p>{f.a}</p>
                  {f.link && (
                    <button type="button" className="v2-link-btn" onClick={() => onLegal(f.link)}>
                      Read full policy →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// V2WhoThisIsFor + V2BigNumbers removed — components were defined but never
// rendered (confirmed dead code in the v47 review). FAQ already answers
// "who is this for?" more naturally.

// Top promo banner — ByteByteGo style, dismissible.
// Dismissal is keyed to the masterclass id, so a new masterclass shows a fresh banner.
function V2TopBanner({ nextMc, onReserve }) {
  const bannerKey = nextMc ? `v2_top_banner_dismissed:${nextMc.id || 'default'}` : null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!bannerKey) return;
    try {
      setDismissed(localStorage.getItem(bannerKey) === '1');
    } catch (e) {
      setDismissed(false);
    }
  }, [bannerKey]);

  useEffect(() => {
    if (!dismissed && nextMc) {
      document.body.classList.add('has-promo-banner');
    } else {
      document.body.classList.remove('has-promo-banner');
    }
    return () => document.body.classList.remove('has-promo-banner');
  }, [dismissed, nextMc]);

  // Dev escape hatch: window.resetPromoBanner() un-dismisses the current banner.
  useEffect(() => {
    window.resetPromoBanner = () => {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('v2_top_banner_dismissed')) localStorage.removeItem(k);
        });
      } catch (e) {}
      setDismissed(false);
      console.log('[banner] reset — banner should reappear');
    };
    return () => { delete window.resetPromoBanner; };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { if (bannerKey) localStorage.setItem(bannerKey, '1'); } catch (e) {}
  };

  if (dismissed || !nextMc) return null;
  const dateStr = formatMcShortDate(nextMc.dateTime);
  const free = isMcFree(nextMc);
  const titleShort = (nextMc.title || 'Live Masterclass').split(' ').slice(0, 3).join(' ');

  return (
    <div className="v2-top-banner" role="region" aria-label="Enrollment announcement">
      <div className="v2-top-banner-inner">
        <span className="v2-top-banner-badge">{free ? 'FREE WEBINAR' : 'NOW ENROLLING'}</span>
        <span className="v2-top-banner-text">
          Learn by doing — <strong>{titleShort}</strong> · {dateStr} · {formatMcPriceShort(nextMc)}
        </span>
        <button type="button" className="v2-top-banner-cta" onClick={() => onReserve(nextMc)}>
          {free ? 'Reserve free seat →' : 'Enroll now →'}
        </button>
      </div>
      <button type="button" className="v2-top-banner-close" onClick={handleDismiss} aria-label="Dismiss banner">×</button>
    </div>
  );
}

// Real social icon cards — bigger, equal-height, click-to-follow.
function V2SocialIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };
  if (name === 'youtube') {
    return (
      <svg {...common}>
        <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
      </svg>
    );
  }
  if (name === 'linkedin') {
    return (
      <svg {...common}>
        <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
      </svg>
    );
  }
  if (name === 'github') {
    return (
      <svg {...common}>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2c-3.2.69-3.87-1.34-3.87-1.34-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.05.78 2.12v3.14c0 .3.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }
  if (name === 'instagram') {
    return (
      <svg {...common}>
        <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
      </svg>
    );
  }
  return null;
}

// Live countdown to a date — used in the welcome popup.
function V2Countdown({ dateTime }) {
  const computeRemaining = () => {
    if (!dateTime) return null;
    const ms = new Date(dateTime).getTime() - Date.now();
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
    return {
      days: Math.floor(ms / 86400000),
      hours: Math.floor((ms % 86400000) / 3600000),
      minutes: Math.floor((ms % 3600000) / 60000),
      seconds: Math.floor((ms % 60000) / 1000),
      past: false,
    };
  };
  const [t, setT] = useState(computeRemaining);
  useEffect(() => {
    const id = setInterval(() => setT(computeRemaining()), 1000);
    return () => clearInterval(id);
  }, [dateTime]);
  if (!t) return null;
  if (t.past) return <div className="v2-countdown-past">Live now or just wrapped — check the schedule.</div>;
  return (
    <div className="v2-countdown">
      <div className="v2-countdown-label">Starts in</div>
      <div className="v2-countdown-cells">
        {[
          { v: t.days, l: 'DAYS' },
          { v: t.hours, l: 'HRS' },
          { v: t.minutes, l: 'MIN' },
          { v: t.seconds, l: 'SEC' },
        ].map((cell) => (
          <div key={cell.l} className="v2-countdown-cell">
            <div className="v2-countdown-num">{String(cell.v).padStart(2, '0')}</div>
            <div className="v2-countdown-unit">{cell.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Auto-show modal on first visit per masterclass. Two-view: summary → details.
// Inspired by Krish Naik's webinar popup. Per-mc storage key.
function V2WelcomePopup({ nextMc, onReserve }) {
  if (!nextMc) return null;
  const merged = mergeMcWithConfig(nextMc);
  const popupKey = merged ? `v2_welcome_popup_dismissed:${merged.id || 'default'}` : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('summary'); // 'summary' | 'details'

  // IMPORTANT: depend only on the STABLE popupKey (a string), NOT on `merged`.
  // `merged` is a fresh object on every render — including it would clear/reset
  // the 1.8s timer on every Firestore/auth re-render, so the popup would never
  // get to open. The popupKey is derived from merged.id which only changes when
  // the actual masterclass changes.
  useEffect(() => {
    if (!V2_CONFIG.showWelcomePopup || !popupKey) return undefined;
    let dismissed = false;
    try { dismissed = localStorage.getItem(popupKey) === '1'; } catch (e) {}
    if (dismissed) return undefined;
    const id = setTimeout(() => setOpen(true), V2_CONFIG.welcomePopupDelayMs);
    return () => clearTimeout(id);
  }, [popupKey]);

  // Dev escape hatch — same pattern as the banner reset.
  useEffect(() => {
    window.resetWelcomePopup = () => {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('v2_welcome_popup_dismissed')) localStorage.removeItem(k);
        });
      } catch (e) {}
      setView('summary');
      setOpen(true);
      console.log('[popup] reset — popup should reappear');
    };
    return () => { delete window.resetWelcomePopup; };
  }, []);

  // Lock body scroll while popup is open so the page underneath doesn't bleed.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    setView('summary');
    try { if (popupKey) localStorage.setItem(popupKey, '1'); } catch (e) {}
  };

  const register = () => {
    setOpen(false);
    try { if (popupKey) localStorage.setItem(popupKey, '1'); } catch (e) {}
    onReserve(nextMc); // pass the original mc so booking flow gets the live state
  };

  if (!open || !merged) return null;
  const free = isMcFree(merged);
  const wp = (_SC.welcomePopup || {});
  const livePill = wp.livePillLabel || (free ? 'FREE WEBINAR' : 'PAID COHORT');
  const instructor = merged.instructor || V2_INSTRUCTOR;
  const instName = typeof instructor.name === 'string' ? instructor.name : 'Balaji Chippada';
  const initials = instName.split(' ').map((s) => s[0]).slice(0, 2).join('');

  // Poster: real image when provided, else gradient block.
  const poster = merged.thumbnail ? (
    <div className="v2-welcome-poster v2-welcome-poster--image" style={{ backgroundImage: `url(${merged.thumbnail})` }}>
      <span className="v2-welcome-live"><span className="v2-welcome-live-dot" /> LIVE · {livePill}</span>
    </div>
  ) : (
    <div className="v2-welcome-poster">
      <span className="v2-welcome-live"><span className="v2-welcome-live-dot" /> LIVE · {livePill}</span>
      <div className="v2-welcome-poster-title">{(merged.title || 'Live Masterclass').toUpperCase()}</div>
      <div className="v2-welcome-poster-sub">Live with {V2_BRAND.name} · Demo first, then we build</div>
    </div>
  );

  return (
    <div className="v2-welcome-overlay" onClick={dismiss}>
      <div className={`v2-welcome-modal v2-welcome-modal--${view}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live masterclass">
        <button type="button" className="v2-welcome-close" onClick={dismiss} aria-label="Close">×</button>

        {poster}

        {view === 'summary' && (
          <div className="v2-welcome-body">
            <span className="v2-welcome-eyebrow">Next live masterclass</span>
            <h2 className="v2-welcome-title">{merged.title}</h2>
            {merged.subtitle && <p className="v2-welcome-subtitle">{merged.subtitle}</p>}
            <div className="v2-welcome-meta">
              <span>📅 {formatMcFullDateTime(merged.dateTime)}</span>
              {merged.duration && <span> · ⏱ {merged.duration} min</span>}
            </div>
            <V2Countdown dateTime={merged.dateTime} />
            <div className="v2-welcome-actions">
              <button type="button" className="v2-welcome-primary" onClick={() => setView('details')}>
                {wp.primaryCtaSummary || 'View details & register'} →
              </button>
              <button type="button" className="v2-welcome-secondary" onClick={dismiss}>
                {wp.dismissLabel || 'Maybe later'}
              </button>
            </div>
          </div>
        )}

        {view === 'details' && (
          <div className="v2-welcome-body v2-welcome-details">
            <button type="button" className="v2-welcome-back" onClick={() => setView('summary')}>← Back</button>
            <h2 className="v2-welcome-title">{merged.title}</h2>

            <div className="v2-welcome-meta-row">
              <span className="v2-welcome-chip">📅 {formatMcShortDate(merged.dateTime)}</span>
              <span className="v2-welcome-chip">⏱ {merged.duration || 180} min</span>
              <span className="v2-welcome-chip v2-welcome-chip--accent">{free ? '🎟️ Free to attend' : formatMcPriceShort(merged)}</span>
            </div>

            {/* Instructor */}
            <div className="v2-welcome-section-label">Instructor</div>
            <div className="v2-welcome-instructor">
              {instructor.photo ? (
                <img className="v2-welcome-instructor-photo" src={instructor.photo} alt={instructor.name} />
              ) : (
                <div className="v2-welcome-instructor-photo v2-welcome-instructor-photo--initials">{initials}</div>
              )}
              <div className="v2-welcome-instructor-text">
                <div className="v2-welcome-instructor-name">{instructor.name}</div>
                <div className="v2-welcome-instructor-title">{instructor.title}</div>
              </div>
              {instructor.linkedin && (
                <a className="v2-welcome-instructor-link" href={instructor.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>
              )}
            </div>

            {/* About */}
            {merged.about && (
              <>
                <div className="v2-welcome-section-label">About this masterclass</div>
                <p className="v2-welcome-prose">{merged.about}</p>
              </>
            )}

            {/* What we'll cover */}
            {Array.isArray(merged.learnings) && merged.learnings.length > 0 && (
              <>
                <div className="v2-welcome-section-label">What we&apos;ll cover</div>
                <ul className="v2-welcome-checks">
                  {merged.learnings.map((line, i) => (
                    <li key={i}><span className="v2-welcome-check">✓</span>{line}</li>
                  ))}
                </ul>
              </>
            )}

            <V2Countdown dateTime={merged.dateTime} />

            <div className="v2-welcome-actions">
              <button type="button" className="v2-welcome-primary" onClick={register}>
                {wp.primaryCtaDetails || (free ? 'Reserve my free seat' : 'Reserve my seat')} →
              </button>
              <button type="button" className="v2-welcome-secondary" onClick={dismiss}>
                {wp.dismissLabel || 'Maybe later'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "Three steps to your seat" explainer — adapts copy for free vs paid.
function V2HowItWorks({ nextMc }) {
  const free = isMcFree(nextMc);
  const steps = [
    {
      n: '01',
      title: 'Pick a masterclass',
      body: 'Curated, focused topics — no endless catalog. Read the syllabus and outcome.',
    },
    {
      n: '02',
      title: free ? 'Reserve free' : 'Reserve & pay',
      body: free
        ? 'Drop your name and email. We hold your seat instantly — no payment, no account needed.'
        : 'Pay securely via Razorpay. Calendar invite + Zoom link emailed instantly.',
    },
    {
      n: '03',
      title: 'Show up & build',
      body: 'Join live, build alongside Balaji, ask questions in real time, get the recording.',
    },
  ];
  return (
    <section className="v2-howitworks" aria-label="How it works">
      <V2SectionHeader
        eyebrow="How it works"
        plain="Three steps to"
        em="your seat."
      />
      <div className="v2-howitworks-grid">
        {steps.map((s) => (
          <div key={s.n} className="v2-howitworks-card">
            <div className="v2-howitworks-num">{s.n}</div>
            <h3 className="v2-howitworks-title">{s.title}</h3>
            <p className="v2-howitworks-body">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// On-page curriculum section — what the "Explore the curriculum" hero button scrolls to.
// Reads instructor + about + curriculum modules from site.config.js so this is fully editable.
function V2Curriculum({ nextMc, onReserve }) {
  if (!nextMc) return null;
  const merged = mergeMcWithConfig(nextMc);
  if (!merged) return null;
  const instructor = merged.instructor || V2_INSTRUCTOR;
  const instName = typeof instructor.name === 'string' ? instructor.name : 'Balaji Chippada';
  const initials = instName.split(' ').map((s) => s[0]).slice(0, 2).join('');
  const modules = Array.isArray(merged.curriculum) ? merged.curriculum : [];
  const free = isMcFree(merged);

  return (
    <section className="v2-curriculum" id="v2-curriculum">
      <V2SectionHeader
        eyebrow="Curriculum"
        plain="What we'll build"
        em="together, live."
      />

      <div className="v2-curriculum-meta">
        <span className="v2-curriculum-chip">📅 {formatMcFullDateTime(merged.dateTime)}</span>
        <span className="v2-curriculum-chip">⏱ {merged.duration || 180} min</span>
        <span className="v2-curriculum-chip v2-curriculum-chip--accent">{free ? '🎟️ Free to attend' : formatMcPriceShort(merged)}</span>
        {Array.isArray(merged.stack) && merged.stack.length > 0 && (
          <span className="v2-curriculum-stack">{merged.stack.join(' · ')}</span>
        )}
      </div>

      {/* Instructor strip */}
      <div className="v2-curriculum-instructor">
        {instructor.photo ? (
          <img className="v2-curriculum-photo" src={instructor.photo} alt={instructor.name} />
        ) : (
          <div className="v2-curriculum-photo v2-curriculum-photo--initials">{initials}</div>
        )}
        <div className="v2-curriculum-itext">
          <div className="v2-curriculum-iname">{instructor.name}</div>
          <div className="v2-curriculum-ititle">{instructor.title}</div>
          {instructor.bio && <p className="v2-curriculum-ibio">{instructor.bio}</p>}
        </div>
      </div>

      {/* About */}
      {merged.about && (
        <div className="v2-curriculum-about">
          <h3>About this masterclass</h3>
          <p>{merged.about}</p>
          {merged.whyJoin && <p><strong>Why join:</strong> {merged.whyJoin}</p>}
          {merged.idealFor && <p><strong>Ideal for:</strong> {merged.idealFor}</p>}
        </div>
      )}

      {/* Modules */}
      {modules.length > 0 && (
        <div className="v2-curriculum-modules">
          {modules.map((m, i) => (
            <div key={i} className="v2-curriculum-module">
              <div className="v2-curriculum-module-head">
                <span className="v2-curriculum-module-num">{m.module || `Module ${String(i + 1).padStart(2, '0')}`}</span>
                {m.duration && <span className="v2-curriculum-module-time">{m.duration}</span>}
              </div>
              <h4 className="v2-curriculum-module-title">{m.title}</h4>
              {Array.isArray(m.points) && (
                <ul>
                  {m.points.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="v2-curriculum-footer">
        <button type="button" className="v2-curriculum-cta" onClick={() => onReserve(nextMc)}>
          {free ? 'Reserve my free seat' : `Book my seat · ${formatMcPriceShort(merged)}`} →
        </button>
      </div>
    </section>
  );
}

// Wide "Not sure where to start?" CTA card — routes the unsure visitor to the roadmap.
function V2WhereToStart({ onRoadmap }) {
  return (
    <section className="v2-wts" aria-label="Not sure where to start">
      <div className="v2-wts-card">
        <div className="v2-wts-text">
          <h3>Not sure where to start with <span className="v2-wts-accent">Agentic AI</span>?</h3>
          <p>Follow a step-by-step roadmap — know exactly what to learn, in what order, and which projects to build first.</p>
        </div>
        <button type="button" className="v2-wts-cta" onClick={onRoadmap}>
          View roadmap →
        </button>
      </div>
    </section>
  );
}

function V2FollowGrid() {
  const cards = [
    {
      key: 'youtube',
      label: 'YouTube',
      sub: `${V2_SOCIAL.youtubeSubs} subscribers`,
      cta: 'Subscribe',
      href: V2_BRAND.youtubeChannel,
      brandClass: 'is-youtube',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      sub: 'Connect & follow',
      cta: 'Follow',
      href: V2_BRAND.linkedin,
      brandClass: 'is-linkedin',
    },
    {
      key: 'github',
      label: 'GitHub',
      sub: 'Open-source roadmap',
      cta: 'Star repo',
      href: V2_ROADMAP_URL,
      brandClass: 'is-github',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      sub: 'Behind the scenes',
      cta: 'Follow',
      href: V2_BRAND.instagram,
      brandClass: 'is-instagram',
    },
  ];
  return (
    <section className="v2-follow" aria-label="Follow Balaji">
      <div className="v2-follow-eyebrow">Follow Balaji · same content, every platform</div>
      <div className="v2-follow-grid">
        {cards.map((c) => (
          <a
            key={c.key}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`v2-follow-card ${c.brandClass}`}
          >
            <span className="v2-follow-icon"><V2SocialIcon name={c.key} /></span>
            <span className="v2-follow-name">{c.label}</span>
            <span className="v2-follow-sub">{c.sub}</span>
            <span className="v2-follow-cta">{c.cta} →</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Reusable centered section header — eyebrow + serif-italic emphasized title.
function V2SectionHeader({ eyebrow, plain, em }) {
  return (
    <header className="v2-section-header">
      {eyebrow && <span className="v2-section-eyebrow">{eyebrow}</span>}
      <h2 className="v2-section-title">
        {plain}
        {em && <em className="v2-section-title-em"> {em}</em>}
      </h2>
    </header>
  );
}

function V2SuccessStories() {
  const stories = [
    {
      quote: 'Shipped my first agentic feature in 3 days. Demo-first teaching just works.',
      name: 'Rahul Mehta',
      role: 'SDE · Bengaluru',
      tag: 'After Claude Code session',
    },
    {
      quote: 'Finally got LLM vs workflow vs agent. Balaji runs the agent first, then explains.',
      name: 'Sneha Iyer',
      role: 'ML Engineer',
      tag: 'After roadmap',
    },
    {
      quote: 'Free roadmap got me started. The masterclass got me shipping in production.',
      name: 'Vikram K.',
      role: 'Fresher · Hyderabad',
      tag: 'After RAG session',
    },
  ];
  return (
    <section className="v2-stories" aria-label="Student success stories">
      <V2SectionHeader
        eyebrow="From the cohort"
        plain="Engineers shipping,"
        em="not just learning."
      />
      <div className="v2-stories-grid">
        {stories.map((s, i) => (
          <article key={i} className="v2-story-card">
            <div className="v2-story-stars" aria-hidden="true">★★★★★</div>
            <p className="v2-story-quote">&ldquo;{s.quote}&rdquo;</p>
            <div className="v2-story-meta">
              <div className="v2-story-name">{s.name}</div>
              <div className="v2-story-role">{s.role}</div>
            </div>
            <span className="v2-story-tag">{s.tag}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function V2ClosingCTA({ nextMc, onReserve }) {
  if (!nextMc) return null;
  const free = isMcFree(nextMc);
  const seats = getSeatsRemaining(nextMc);
  return (
    <section className="closing-cta">
      <RevealOnScroll>
        <span className="closing-cta__eyebrow">Next session · {formatMcFullDateTime(nextMc.dateTime)}</span>
        <h2 className="closing-cta__headline">Stop watching tutorials. Ship one with me.</h2>
        <p className="closing-cta__sub">
          3 hours live · {free ? 'free first masterclass' : 'single price'} · recording &amp; slides included
          {free ? ' · WhatsApp community access' : ' · 100% refund within 24h'}.
        </p>
        <button className="hero__primary-cta v2-closing-btn" onClick={() => onReserve(nextMc)}>
          {free ? `Reserve my free seat →` : `Book my seat · ${formatMcPriceShort(nextMc)} →`}
        </button>
        <div className="closing-cta__microcopy">
          {seats > 0 ? `Only ${seats} seats left · ` : ''}Instant Zoom link · No account needed
        </div>
      </RevealOnScroll>
    </section>
  );
}

function V2MobileStickyBar({ nextMc, onReserve }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!nextMc) return null;
  const seats = getSeatsRemaining(nextMc);
  const free = isMcFree(nextMc);
  return (
    <div className={`v2-mobile-sticky ${visible ? 'is-visible' : ''}`}>
      <div className="v2-mobile-sticky-meta">
        <span className="v2-mobile-sticky-date">{formatMcShortDate(nextMc.dateTime)}</span>
        {seats > 0 && seats <= 20 && (
          <span className="v2-mobile-sticky-seats">{seats} seats left</span>
        )}
      </div>
      <button type="button" className="hero__primary-cta v2-mobile-sticky-btn" onClick={() => onReserve(nextMc)}>
        {free ? 'Reserve · Free' : `Book · ${formatMcPriceShort(nextMc)}`}
      </button>
    </div>
  );
}

function V2WhatsAppButton() {
  return (
    <a className="v2-whatsapp-float" href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer">
      💬 Join WhatsApp community
    </a>
  );
}

function V2LegalModal({ page, onClose }) {
  if (!page) return null;
  const content = {
    refund: { title: 'Refund Policy', body: '100% refund within 24 hours of purchase, no questions asked. Email balajichippada.20@gmail.com with your order ID.' },
    privacy: { title: 'Privacy Policy', body: 'We collect name, email, and phone to deliver masterclass access and updates. We do not sell your data. Contact us to delete your account.' },
    terms: { title: 'Terms of Service', body: 'Masterclass content is for personal learning. Recording redistribution is prohibited. Sessions may be rescheduled with 48h notice.' },
    contact: { title: 'Contact', body: `Email: balajichippada.20@gmail.com · WhatsApp community: ${V2_BRAND.whatsappCommunity} · We respond within 24 hours.` },
  }[page] || { title: page, body: '' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 className="modal-title">{content.title}</h2>
        <p className="modal-desc">{content.body}</p>
      </div>
    </div>
  );
}
