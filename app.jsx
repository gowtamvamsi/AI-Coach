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
// ===============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCtnlKe9bPzqbMcOJ4aRySyEPgK_7_VjBc",
  authDomain: "coaching-site-gowtam-2026.firebaseapp.com",
  projectId: "coaching-site-gowtam-2026",
  storageBucket: "coaching-site-gowtam-2026.firebasestorage.app",
  messagingSenderId: "133891754247",
  appId: "1:133891754247:web:ceddd03771cbd3fcf1dda2"
};

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
  functions = firebase.functions();
}

// Helper: Check if platform is Mac/iOS
const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');


// ===============================================================
// HELPER COMPONENTS
// ===============================================================

function PhaseTabBox({ phase }) {
  const [activeTab, setActiveTab] = useState(0);
  const section = phase.sections[activeTab];
  return (
    <div className="tabbox">
      <div className="tabbox__tabs" role="tablist">
        {phase.sections.map((s, i) => (
          <button key={i} role="tab" aria-selected={i === activeTab}
            className={`tabbox__tab ${i === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}>
            <span className="tabbox__tab-num">{s.n}</span>
            <span className="tabbox__tab-title">{s.title}</span>
          </button>
        ))}
      </div>
      <div className="tabbox__panel" role="tabpanel">
        <div className="tabbox__panel-content" key={activeTab}>
          <div className="tabbox__panel-num">Module {section.n}</div>
          <h3 className="tabbox__panel-title">{section.title}</h3>
          <ul className="tabbox__items">
            {section.items.map((item, ii) => (
              <li key={ii} className="tabbox__item">
                <span className="tabbox__item-marker">{String(ii + 1).padStart(2, '0')}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, onJumpPhase, onJumpCapstone }) {
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
    return out;
  }, []);

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

function RoadmapView({ searchOpen, setSearchOpen, scrollToPhase, scrollToCapstone, scrollToAgenda, agendaRef, totalSections, capstoneTiles, phaseRefs, capstoneRefs }) {
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
              <span className="hero__eyebrow-dot" />
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
            <div className="hero__actions">
              <button className="hero__cta" type="button" onClick={scrollToAgenda}>
                Explore the roadmap
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          <div className="hero__video">
            <V2ClickToPlayVideo
              videoId={V2_BRAND.roadmapVideoId}
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

      {/* INSTRUCTOR */}
      <section className="instructor reveal" data-screen-label="03 Instructor">
        <div className="instructor__card">
          <div className="instructor__photo">
            <img src="uploads/balaji-chippada.png" alt="Balaji Chippada" />
          </div>
          <div className="instructor__body">
            <div className="instructor__label">Your Instructor</div>
            <h3 className="instructor__name">{V2_BRAND.name}</h3>
            <div className="instructor__role">8 years in AI/ML · Production agentic AI · {V2_SOCIAL.youtubeSubs} YouTube</div>
            <p className="instructor__quote">&ldquo;If I had to start all over again in 2026, this is exactly how I would begin.&rdquo;</p>
            <p className="instructor__bio">
              I build <span>production-scale agentic applications</span> and teach what matters when systems
              leave the demo stage. This roadmap is the free, open-source curriculum from my
              <span> {V2_SOCIAL.roadmapViews}-view</span> YouTube walkthrough — no paywall, no course funnel at the end.
            </p>
            <div className="instructor__chips">
              <span className="instructor__chip">{V2_SOCIAL.roadmapViews} roadmap views</span>
              <span className="instructor__chip">LangGraph</span>
              <span className="instructor__chip">ReAct · MCP</span>
              <span className="instructor__chip">Production RAG</span>
              <span className="instructor__chip">Multi-Agent</span>
              <span className="instructor__chip">LLMOps</span>
            </div>
          </div>
          <div className="instructor__cta">
            <div className="instructor__connect-label">Connect with me</div>
            <a className="instructor__community-link" href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer">
              Join WhatsApp community →
            </a>
            <div className="instructor__socials">
              <a className="instructor__social" href={V2_BRAND.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Connect with Balaji Chippada on LinkedIn">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
                </svg>
              </a>
              <a className="instructor__social" href={V2_BRAND.youtubeChannel} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on YouTube">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                </svg>
              </a>
              <a className="instructor__social" href={V2_BRAND.instagram} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PHASES */}
      <section className="phases">
        {window.ROADMAP.map((phase, i) => (
          <article key={phase.id} className="phase"
            ref={el => phaseRefs.current[i] = el}
            data-screen-label={`${String(phase.id).padStart(2, '0')} ${phase.title}`}>
            <div className="phase__index">
              <span className="phase__num-prefix" data-color={phase.color}>Phase {String(phase.id).padStart(2, '0')}</span>
              <span className="phase__num">{String(phase.id).padStart(2, '0')}</span>
              <div className="phase__num-bar" data-color={phase.color} />
              <div className="phase__weeks-block" data-color={phase.color}>
                <div className="phase__weeks-label">Time frame</div>
                <div className="phase__weeks">{phase.weeks}</div>
                <div className="phase__weeks-detail">{phase.weeksDetail}</div>
                <div className="phase__diff">
                  <span>Difficulty</span>
                  <span className="phase__diff-score">{phase.difficulty}/5</span>
                  <span className="phase__diff-dots" aria-label={`Difficulty ${phase.difficulty} out of 5`}>
                    {[1,2,3,4,5].map(d => (
                      <span key={d} className={`phase__diff-dot ${d <= phase.difficulty ? 'on' : ''}`} />
                    ))}
                  </span>
                </div>
                {phase.difficultyNote && (
                  <div className="phase__diff-note">{phase.difficultyNote}</div>
                )}
              </div>
              {phase.capstone && (
                <div className="phase__capstone-pill">Capstone {phase.capstone}</div>
              )}
            </div>
            <div className="phase__body">
              <h2 className="phase__title">
                <span className="phase__title-accent" data-color={phase.color} />
                {phase.title}
              </h2>
              <p className="phase__summary">{phase.summary}</p>
              <PhaseTabBox phase={phase} />
              <div className="phase__endstate reveal">
                <div className="phase__endstate-label">End state</div>
                <div className="phase__endstate-text">{phase.endState}</div>
              </div>
            </div>
          </article>
        ))}
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

function MasterclassCard({ mc, idx, user, onBook }) {
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
  const cardOpacity = useTransform ? useTransform(activeProgress, [0, 0.15, 0.85, 1], [0.65, 1, 1, 0.65]) : 1;

  const mcDate = mc.dateTime ? new Date(mc.dateTime) : null;
  const isMostPopular = mc.title.toLowerCase().includes('rag') || idx === 0;
  const seatsLeft = getSeatsRemaining(mc);
  const outcome = getMcOutcome(mc);

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
                  <span className="live-dot" aria-hidden="true" />
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
                <div className="mc-card__price">₹{(mc.price || 0).toLocaleString()}</div>
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
                {seatsLeft > 0 && (
                <div className="mc-card__urgency" style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#A32D2D',
                  background: '#FCEBEB',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  width: 'fit-content',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D85A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                  <span>Only {seatsLeft} seats remaining</span>
                </div>
                )}
              </div>

              <div className="mc-card__cta-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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
                    <span>Book my seat — ₹{(mc.price || 0).toLocaleString()}</span>
                  </div>
                </ShimmerButton>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--fg-faint)',
                  textAlign: 'right',
                  marginTop: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  Instant Zoom link · No account needed
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
                  <span className="live-dot" aria-hidden="true" />
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
                <div className="mc-card__price">₹{(mc.price || 0).toLocaleString()}</div>
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
                {seatsLeft > 0 && (
                <div className="mc-card__urgency" style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#A32D2D',
                  background: '#FCEBEB',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  width: 'fit-content',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D85A30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                  </svg>
                  <span>Only {seatsLeft} seats remaining</span>
                </div>
                )}
              </div>

              <div className="mc-card__cta-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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
                    <span>Book my seat — ₹{(mc.price || 0).toLocaleString()}</span>
                  </div>
                </ShimmerButton>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--fg-faint)',
                  textAlign: 'right',
                  marginTop: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  Instant Zoom link · No account needed
                </div>
              </div>
            </div>
          </article>
        )}
      </RevealOnScroll>
    </div>
  );
}

function InstructorBio() {
  const containerRef = useRef(null);
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
      target: containerRef,
      offset: ["start end", "end start"]
    }) : null;
    scrollYProgress = scrollObj ? scrollObj.scrollYProgress : null;
  } catch (e) {
    console.warn("Framer Motion useScroll element target not available", e);
  }

  const dummyValue = useMotionValue ? useMotionValue(0.5) : null;
  const activeProgress = scrollYProgress || dummyValue;

  const scaleMin = isMobileViewport ? 0.98 : 0.93;
  const scaleMax = isMobileViewport ? 1.02 : 1.06;

  // Symmetrical grow and shrink card effect:
  // Starts at scale 0.93 when entering from bottom, peaks at scale 1.06 in viewport center, shrinks back to 0.93 as it exits top.
  const cardScale = useTransform ? useTransform(activeProgress, [0, 0.5, 1], [scaleMin, scaleMax, scaleMin]) : 1;
  const cardOpacity = useTransform ? useTransform(activeProgress, [0, 0.15, 0.85, 1], [0.65, 1, 1, 0.65]) : 1;

  return (
    <section ref={containerRef} id="instructor" style={{ margin: isMobileViewport ? '40px 0' : '120px 0', padding: '0', overflow: 'visible' }}>
      <RevealOnScroll>
        {motion ? (
          <motion.div 
            className="instructor__card"
            style={{ 
              scale: cardScale, 
              opacity: cardOpacity,
              transformOrigin: 'center center'
            }}
          >
            <div className="instructor__photo">
              <img src={V2_INSTRUCTOR.photo || 'uploads/balaji-chippada.png'} alt={V2_INSTRUCTOR.name} />
            </div>
            <div className="instructor__body">
              <div className="instructor__label">Your Instructor</div>
              <h3 className="instructor__name">{V2_INSTRUCTOR.name}</h3>
              <div className="instructor__role">{V2_INSTRUCTOR.title}</div>
              {V2_INSTRUCTOR.quote && (
                <p className="instructor__quote">&ldquo;{V2_INSTRUCTOR.quote}&rdquo;</p>
              )}
              <p className="instructor__bio">{V2_INSTRUCTOR.bio}</p>
              {Array.isArray(V2_INSTRUCTOR.chips) && V2_INSTRUCTOR.chips.length > 0 && (
                <div className="instructor__chips">
                  {V2_INSTRUCTOR.chips.map((chip, i) => (
                    <span key={i} className="instructor__chip">{chip}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="instructor__cta">
              <div className="instructor__connect-label">Connect with me</div>
              <a className="instructor__community-link" href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer">
                Join WhatsApp community →
              </a>
              <div className="instructor__socials">
                <a className="instructor__social" href={V2_BRAND.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Connect with Balaji Chippada on LinkedIn">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
                  </svg>
                </a>
                <a className="instructor__social" href={V2_BRAND.youtubeChannel} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on YouTube">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                  </svg>
                </a>
                <a className="instructor__social" href={V2_BRAND.instagram} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on Instagram">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                  </svg>
                </a>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="instructor__card">
            <div className="instructor__photo">
              <img src={V2_INSTRUCTOR.photo || 'uploads/balaji-chippada.png'} alt={V2_INSTRUCTOR.name} />
            </div>
            <div className="instructor__body">
              <div className="instructor__label">Your Instructor</div>
              <h3 className="instructor__name">{V2_INSTRUCTOR.name}</h3>
              <div className="instructor__role">{V2_INSTRUCTOR.title}</div>
              {V2_INSTRUCTOR.quote && (
                <p className="instructor__quote">&ldquo;{V2_INSTRUCTOR.quote}&rdquo;</p>
              )}
              <p className="instructor__bio">{V2_INSTRUCTOR.bio}</p>
              {Array.isArray(V2_INSTRUCTOR.chips) && V2_INSTRUCTOR.chips.length > 0 && (
                <div className="instructor__chips">
                  {V2_INSTRUCTOR.chips.map((chip, i) => (
                    <span key={i} className="instructor__chip">{chip}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="instructor__cta">
              <div className="instructor__connect-label">Connect with me</div>
              <a className="instructor__community-link" href={V2_BRAND.whatsappCommunity} target="_blank" rel="noopener noreferrer">
                Join WhatsApp community →
              </a>
              <div className="instructor__socials">
                <a className="instructor__social" href={V2_BRAND.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Connect with Balaji Chippada on LinkedIn">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.7 9.2H3.2v11.3h3.5V9.2ZM4.9 3.5C3.8 3.5 3 4.3 3 5.4s.8 1.9 1.9 1.9 1.9-.8 1.9-1.9-.8-1.9-1.9-1.9Zm15.6 10.6c0-3.3-1.8-5.2-4.4-5.2-1.8 0-2.8 1-3.2 1.7V9.2H9.5v11.3H13v-6.1c0-1.6.8-2.5 2-2.5s1.9.8 1.9 2.5v6.1h3.6v-6.4Z" />
                  </svg>
                </a>
                <a className="instructor__social" href={V2_BRAND.youtubeChannel} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on YouTube">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                  </svg>
                </a>
                <a className="instructor__social" href={V2_BRAND.instagram} target="_blank" rel="noopener noreferrer" aria-label="Open Balaji Chippada on Instagram">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.5 2.8h9A4.7 4.7 0 0 1 21.2 7.5v9a4.7 4.7 0 0 1-4.7 4.7h-9a4.7 4.7 0 0 1-4.7-4.7v-9a4.7 4.7 0 0 1 4.7-4.7Zm0 2A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm4.5 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </RevealOnScroll>
    </section>
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
          Instant confirmation · Zoom link sent by email
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
        { title: 'Claude Code Masterclass', href: '#masterclasses', isScroll: true },
        { title: 'Live Cohorts', href: '#masterclasses', isScroll: true },
        { title: '2026 Roadmap', href: '#', onClickTab: 'roadmap' },
        { title: 'Full Syllabus', href: '#', onClickTab: 'roadmap' }
      ]
    },
    {
      label: 'Company',
      links: [
        { title: 'About Balaji', href: '#instructor', isScroll: true },
        { title: 'Privacy Policy', href: '#', legal: 'privacy' },
        { title: 'Terms of Service', href: '#', legal: 'terms' },
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
                <svg className="site-footer__logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="footer-logo-grad" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0" stopColor="#c2533c"/>
                      <stop offset="0.5" stopColor="#d18a2a"/>
                      <stop offset="1" stopColor="#6b4d80"/>
                    </linearGradient>
                  </defs>
                  <rect width="32" height="32" rx="8" fill="url(#footer-logo-grad)"/>
                  <text x="16" y="22" textAnchor="middle" fontFamily="-apple-system,system-ui,sans-serif" fontSize="18" fontWeight="700" fill="white">A</text>
                </svg>
                <span className="site-footer__brand-name">The Agent Engineer</span>
              </div>
              <p className="site-footer__copyright">
                © {new Date().getFullYear()} The Agent Engineer. All rights reserved.
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
            onClick={() => openBooking(nextMasterclass)}
          >
            Book my seat →
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
// STAFF / ADMIN DASHBOARD TAB VIEW
// ===============================================================

function DashboardView({ user, role, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [editSessionId, setEditSessionId] = useState("");
  
  // Form fields (sessions)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [instructor, setInstructor] = useState("Balaji Chippada");
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // ── AI Masterclass Creation State ──
  const [masterclasses, setMasterclasses] = useState([]);
  const [mcTitle, setMcTitle] = useState("");
  const [mcInstructor, setMcInstructor] = useState("Balaji Chippada");
  const [mcPrice, setMcPrice] = useState("");
  const [mcDateTime, setMcDateTime] = useState("");
  const [mcRawSyllabus, setMcRawSyllabus] = useState("");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [aiStatus, setAiStatus] = useState({ type: '', msg: '' }); // loading | success | error
  const [mcLoading, setMcLoading] = useState(false);
  const [mcPreview, setMcPreview] = useState(null); // last generated syllabus for preview

  // Load sessions for management panel
  useEffect(() => {
    if (!db) return;
    // Try ordered fetch, fall back to unordered if index is missing
    let unsubscribe = db.collection("sessions")
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setSessions(list);
      }, () => {
        // Fallback: fetch without ordering if createdAt field/index missing
        unsubscribe = db.collection("sessions").onSnapshot(snap => {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          setSessions(list);
        });
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

  // Load AI-structured masterclasses
  useEffect(() => {
    if (!db) return;
    const unsubscribe = db.collection('masterclasses')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setMasterclasses(list);
      }, () => {
        db.collection('masterclasses').onSnapshot(snap => {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          setMasterclasses(list);
        });
      });
    return () => unsubscribe();
  }, []);

  // Handle selected session for editing
  const handleSelectSessionToEdit = (id) => {
    setEditSessionId(id);
    if (!id) {
      // Reset form to blank creation
      setTitle("");
      setDescription("");
      setPrice("");
      setDateTime("");
      return;
    }
    const session = sessions.find(s => s.id === id);
    if (session) {
      setTitle(session.title || "");
      setDescription(session.description || "");
      setPrice(session.price || "");
      
      // format to datetime-local expected string 'YYYY-MM-DDTHH:MM'
      try {
        const dateObj = new Date(session.dateTime);
        if (!isNaN(dateObj.getTime())) {
          const tzoffset = dateObj.getTimezoneOffset() * 60000; //offset in milliseconds
          const localISOTime = (new Date(dateObj.getTime() - tzoffset)).toISOString().slice(0, 16);
          setDateTime(localISOTime);
        } else {
          setDateTime("");
        }
      } catch(e) {
        setDateTime("");
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!db) {
      setStatus({ type: "error", message: "Firestore database not loaded." });
      return;
    }

    if (!title || !description || !price || !dateTime) {
      setStatus({ type: "error", message: "Please fill in all required fields." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new Error("Price must be a valid positive number.");
      }

      // Convert date to generic ISO string format
      const formattedDate = new Date(dateTime).toISOString();

      if (editSessionId) {
        // Mode: Update Existing Session
        await db.collection("sessions").doc(editSessionId).update({
          title,
          description,
          price: priceNum,
          dateTime: formattedDate,
          instructor
        });
        setStatus({ type: "success", message: "Masterclass updated successfully!" });
      } else {
        // Mode: Create New Session
        await db.collection("sessions").add({
          title,
          description,
          price: priceNum,
          dateTime: formattedDate,
          instructor,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setStatus({ type: "success", message: "New Masterclass scheduled successfully!" });
        
        // Reset form
        setTitle("");
        setDescription("");
        setPrice("");
        setDateTime("");
      }
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to commit session to database." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId, sessionTitle) => {
    if (!window.confirm(`Delete "${sessionTitle}"? This cannot be undone.`)) return;
    try {
      await db.collection("sessions").doc(sessionId).delete();
      // If we were editing this session, reset form
      if (editSessionId === sessionId) handleSelectSessionToEdit("");
      setStatus({ type: "success", message: `"${sessionTitle}" deleted.` });
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('masterclasses').add(mcDoc);

      setMcPreview(syllabus);
      setAiStatus({ type: 'success', msg: `✅ "${mcTitle}" published with ${syllabus.length} structured topics!` });

      // Reset form
      setMcTitle(''); setMcPrice(''); setMcDateTime(''); setMcRawSyllabus('');
      setMcInstructor('Balaji Chippada');

    } catch (err) {
      setAiStatus({ type: 'error', msg: err.message || 'Something went wrong. Check your API key and try again.' });
    } finally {
      setMcLoading(false);
    }
  };

  const handleDeleteMasterclass = async (mcId, mcTitle) => {
    if (!window.confirm(`Delete "${mcTitle}"? This cannot be undone.`)) return;
    try {
      await db.collection('masterclasses').doc(mcId).delete();
      setStatus({ type: 'success', message: `"${mcTitle}" masterclass deleted.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to delete masterclass.' });
    }
  };

  // Compute metrics

  const totalRevenue = registrations
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.amount / 100), 0);

  const totalSeats = registrations
    .filter(r => r.status === 'completed').length;

  const ADMIN_EMAILS = ['gowtamsbh1234@gmail.com', 'balajichippada.20@gmail.com'];
  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase());

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Staff <em>Control Panel</em></h1>
          <p className="hero__sub" style={{ marginTop: "8px" }}>Manage scheduled masterclasses, edit metadata, and monitor registrations.</p>
        </div>
        <div className="dashboard__userinfo">
          <span>{user.email}</span>
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

      {/* ── Sessions Management Section (Admins only) ── */}
      {isAdmin && (
        <div className="dashboard__panel" style={{ marginBottom: "28px" }}>
          <h2 className="dashboard__panel-title" style={{ marginBottom: "18px" }}>Scheduled Masterclasses ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fg-faint)", border: "1px dashed var(--line)", borderRadius: "10px" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
              <p style={{ margin: 0, fontSize: "14px" }}>No masterclasses yet. Use the form below to schedule your first session.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
              {sessions.map(s => {
                const sessionDate = s.dateTime ? new Date(s.dateTime) : null;
                const isEditing = editSessionId === s.id;
                return (
                  <div key={s.id} style={{
                    background: isEditing ? "rgba(var(--c-violet-rgb, 138,92,246),0.08)" : "var(--bg-elev)",
                    border: `1px solid ${isEditing ? "var(--c-violet, #8a5cf6)" : "var(--line)"}`,
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
                        <span style={{ fontSize: "10px", background: "var(--c-violet, #8a5cf6)", color: "#fff", borderRadius: "4px", padding: "2px 7px", whiteSpace: "nowrap" }}>Editing</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--fg-dim)" }}>👤 {s.instructor || "—"}</span>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--c-amber, #f59e0b)" }}>₹{(s.price || 0).toLocaleString()}</span>
                    </div>
                    {sessionDate && (
                      <div style={{ fontSize: "11px", color: "var(--fg-faint)" }}>
                        📅 {sessionDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {" · "}{sessionDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--fg-dim)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.description}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      <button
                        onClick={() => {
                          handleSelectSessionToEdit(isEditing ? "" : s.id);
                          // Scroll to form
                          document.querySelector('.dashboard__grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        style={{
                          flex: 1,
                          padding: "7px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          border: "1px solid var(--c-violet, #8a5cf6)",
                          background: isEditing ? "var(--c-violet, #8a5cf6)" : "transparent",
                          color: isEditing ? "#fff" : "var(--c-violet, #8a5cf6)",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        {isEditing ? "✕ Cancel Edit" : "✎ Edit"}
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id, s.title)}
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
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── AI Masterclass Panel (Admins only) ── */}
      {isAdmin && (
        <div className="dashboard__panel" style={{ marginBottom: "28px" }}>
          <h2 className="dashboard__panel-title" style={{ marginBottom: "6px" }}>
            <span style={{ marginRight: "8px" }}>✨</span> AI Masterclass Generator
          </h2>
          <p style={{ fontSize: "13px", color: "var(--fg-faint)", marginBottom: "20px" }}>
            Paste your raw syllabus notes — Gemini will structure them into a beautiful interactive course outline automatically.
          </p>

          {/* Gemini API Key settings row */}
          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              🔑 Gemini API Key
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "11px", color: "var(--c-rust)", textDecoration: "none", marginLeft: "6px" }}>
                Get free key →
              </a>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="AIza..."
              value={geminiKey}
              onChange={e => handleGeminiKeyChange(e.target.value)}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            />
            {geminiKey && (
              <div style={{ fontSize: "11px", color: "var(--c-emerald)", marginTop: "5px" }}>
                ✓ Key saved in browser storage
              </div>
            )}
          </div>

          <form onSubmit={handleMasterclassSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Masterclass Title *</label>
                <input type="text" className="form-input"
                  placeholder="e.g. Claude Code Masterclass"
                  value={mcTitle} onChange={e => setMcTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Instructor</label>
                <input type="text" className="form-input"
                  value={mcInstructor} onChange={e => setMcInstructor(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Price (INR) *</label>
                <input type="number" className="form-input"
                  placeholder="e.g. 4999"
                  value={mcPrice} onChange={e => setMcPrice(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time *</label>
                <input type="datetime-local" className="form-input"
                  value={mcDateTime} onChange={e => setMcDateTime(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Raw Syllabus Text *</label>
              <textarea
                className="form-input form-textarea"
                rows={8}
                placeholder={`Paste your unstructured syllabus notes here. Example:\n\nWeek 1: Getting started with Claude Code CLI. Setting up permissions, understanding the token model, context management...\nWeek 2: Autonomous codebase navigation — multi-file refactoring, security audits...\nWeek 3: Building production agents — memory, tool use, orchestration...`}
                value={mcRawSyllabus}
                onChange={e => setMcRawSyllabus(e.target.value)}
                required
                style={{ minHeight: "180px", fontFamily: "'Inter Tight', sans-serif", fontSize: "13px", lineHeight: 1.6 }}
              />
            </div>

            {aiStatus.msg && (
              <div className={`ai-status ai-status--${aiStatus.type}`}>
                {aiStatus.type === 'loading' && <div className="ai-status__spinner" />}
                {aiStatus.type === 'success' && <span>✅</span>}
                {aiStatus.type === 'error' && <span>⚠️</span>}
                <span>{aiStatus.msg}</span>
              </div>
            )}

            <button type="submit" className="form-btn" disabled={mcLoading}
              style={{ marginTop: "16px", background: "linear-gradient(135deg, var(--c-rust), #9b4fd4)" }}>
              {mcLoading ? "⏳ Generating..." : "✨ Generate & Publish with Gemini"}
            </button>
          </form>

          {/* Inline preview of last generated syllabus */}
          {mcPreview && mcPreview.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ fontSize: "12px", color: "var(--fg-faint)", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>
                SYLLABUS PREVIEW
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
                <SplitPaneSyllabus syllabus={mcPreview} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Published Masterclasses Management ── */}
      {isAdmin && masterclasses.length > 0 && (
        <div className="dashboard__panel" style={{ marginBottom: "28px" }}>
          <h2 className="dashboard__panel-title" style={{ marginBottom: "16px" }}>
            Published Masterclasses ({masterclasses.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {masterclasses.map(mc => (
              <div key={mc.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "var(--bg-elev)",
                border: "1px solid var(--line)", borderRadius: "10px", gap: "12px", flexWrap: "wrap"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--fg)" }}>{mc.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--fg-faint)", marginTop: "3px" }}>
                    {mc.syllabus?.length || 0} topics · {mc.instructor} · ₹{(mc.price || 0).toLocaleString()}
                    {mc.dateTime && ` · ${new Date(mc.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteMasterclass(mc.id, mc.title)}
                  style={{
                    padding: "6px 14px", fontSize: "12px", fontWeight: 600,
                    border: "1px solid var(--c-rust)", background: "transparent",
                    color: "var(--c-rust)", borderRadius: "8px", cursor: "pointer"
                  }}
                >
                  🗑 Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard__grid">
        {/* Left Panel: Form (Only visible to Administrators) */}
        {isAdmin ? (
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
                  <label className="form-label">Price (INR) *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 1999"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
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
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" className="form-btn" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Saving..." : editSessionId ? "💾 Save Changes" : "🚀 Publish Masterclass"}
                </button>
                {editSessionId && (
                  <button
                    type="button"
                    onClick={() => handleSelectSessionToEdit("")}
                    style={{
                      padding: "12px 16px",
                      background: "transparent",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      color: "var(--fg-dim)",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div className="dashboard__panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "50px 30px" }}>
            <div style={{ fontSize: "56px", marginBottom: "20px" }}>🔒</div>
            <h2 className="dashboard__panel-title" style={{ justifyContent: "center", margin: 0, borderBottom: "none" }}>Creation Locked</h2>
            <p className="hero__sub" style={{ fontSize: "14px", marginTop: "14px", maxWidth: "34ch" }}>
              Only authorized administrator accounts (<b>gowtamsbh1234@gmail.com</b> or <b>Balajichippada.20@gmail.com</b>) have permission to publish or edit masterclasses.
            </p>
          </div>
        )}

        {/* Right Panel: Analytics & Registrations */}
        <div className="dashboard__panel" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 className="dashboard__panel-title">Overview & Bookings</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="phase__weeks-block" style={{ marginTop: 0, padding: "16px" }}>
              <div className="phase__weeks-label">Reserved Seats</div>
              <div className="phase__weeks">{totalSeats}</div>
            </div>
            <div className="phase__weeks-block" style={{ marginTop: 0, padding: "16px", borderLeftColor: "var(--c-amber)" }}>
              <div className="phase__weeks-label">Gross Revenue</div>
              <div className="phase__weeks" style={{ color: "var(--c-amber)" }}>₹{totalRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <h3 className="form-label" style={{ marginBottom: "12px" }}>Roster List ({registrations.length})</h3>
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
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: "20px", textAlign: "center", color: "var(--fg-faint)" }}>No bookings registered yet.</td>
                    </tr>
                  ) : (
                    registrations.map(r => (
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
      </div>
    </div>
  );
}


// ===============================================================
// MAIN APPLICATION ROOT COMPONENT
// ===============================================================

function App() {
  const [dockVisible, setDockVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false); // for nav blur
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

  // ── Lenis smooth scroll ─────────────────────────────────────
  useEffect(() => {
    const LenisClass = window.Lenis;
    if (!LenisClass) return;
    const lenis = new LenisClass({ lerp: 0.08, smoothWheel: true });
    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Main navigation tabs routing state: 'home' | 'roadmap' | 'dashboard'
  const [activeMainTab, setActiveMainTab] = useState('home');

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
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const [legalPage, setLegalPage] = useState(null);
  
  // Checkout mock sandbox screen state
  const [mockCheckoutData, setMockCheckoutData] = useState(null);

  // Staff Login modal state
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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

  // Auth observer
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await db.collection('users').doc(u.uid).get();
          const emailLower = (u.email || '').toLowerCase();
          const isBootstrapAdmin = emailLower === 'gowtamsbh1234@gmail.com' || emailLower === 'balajichippada.20@gmail.com';
          
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
                name: u.displayName || (emailLower === 'balajichippada.20@gmail.com' ? 'Balaji Chippada' : 'Gowtam Singulur')
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
          if (emailLower === 'gowtamsbh1234@gmail.com' || emailLower === 'balajichippada.20@gmail.com') {
            setUserRole('admin');
          } else {
            setUserRole('client');
          }
        }
      } else {
        setUserRole(null);
        setShowCompleteProfile(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch live masterclasses from Firestore
  useEffect(() => {
    if (!db) {
      setLoadingSessions(false);
      return;
    }
    const unsubscribe = db.collection('sessions')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setSessions(list);
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
    let unsub = db.collection('masterclasses')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setMasterclasses(list);
        setLoadingMasterclasses(false);
      }, () => {
        // Fallback: no ordering
        unsub = db.collection('masterclasses').onSnapshot(snap => {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          setMasterclasses(list);
          setLoadingMasterclasses(false);
        }, () => setLoadingMasterclasses(false));
      });
    return () => unsub();
  }, []);


  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      } else if (e.key === '/' && !searchOpen) {
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
      setBookingStep(2);
      setBookingName(user.displayName || bookingName);
      setBookingEmail(user.email || bookingEmail);
    }
  }, [user, bookingSession, bookingStep]);

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

  // Scroll action helpers for Roadmap
  const scrollToElement = (el, mobileOffset = 24, desktopOffset = 72, includePadding = false) => {
    if (!el) return;
    const navOffset = window.innerWidth <= 700 ? mobileOffset : desktopOffset;
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
        // Validation check for new fields
        if (!regName || !regPhone || !regUserType) {
          throw new Error("Please fill in all required fields (Name, Phone, and User Type).");
        }

        // Create user in Auth
        const userCredential = await auth.createUserWithEmailAndPassword(loginEmail, loginPassword);
        const newUser = userCredential.user;

        // Immediately write standard client profile fields to Firestore
        await db.collection('users').doc(newUser.uid).set({
          name: regName,
          email: loginEmail,
          phone: regPhone,
          userType: regUserType,
          role: 'client'
        });

        // Set Auth Display Name
        try {
          await newUser.updateProfile({ displayName: regName });
        } catch (err) {
          console.warn("Could not set firebase Auth displayName:", err);
        }

        setLoginEmail("");
        setLoginPassword("");
        setRegName("");
        setRegPhone("");
        setRegUserType("");
        setStaffLoginOpen(false);
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

  // Submit profile completion details for users (such as Google Sign-in users)
  const handleCompleteProfileSubmit = async (e) => {
    e.preventDefault();
    if (!auth || !user) {
      setLoginError("No authenticated user session found.");
      return;
    }
    if (!regName || !regPhone || !regUserType) {
      setLoginError("Please fill in all required fields (Name, Phone, and User Type).");
      return;
    }
    setLoginError("");
    setLoginLoading(true);

    try {
      // Update Firestore user document with missing profile fields
      await db.collection('users').doc(user.uid).set({
        name: regName,
        email: user.email,
        phone: regPhone,
        userType: regUserType,
        role: 'client'
      }, { merge: true });

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

  // Handle Google Sign-in popup
  const handleGoogleLogin = async () => {
    if (!auth) {
      setLoginError("Firebase Auth SDK was not initialized.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      setStaffLoginOpen(false);
    } catch (err) {
      setLoginError(err.message || "Failed to complete Google authentication.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      setActiveMainTab('home');
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
    });
    setMockCheckoutData(null);
    setBookingStep('success');
    if (user && !user.isAnonymous && db && session) {
      try {
        await db.collection('users').doc(user.uid).collection('bookings').add({
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
        });
        await db.collection('users').doc(user.uid).set({
          name: bookingName, phone: bookingPhone, email: user.email,
        }, { merge: true });
      } catch (err) {
        console.warn('Client-side booking write failed (webhook may have handled it):', err);
      }
    }
  };

  const handleBookingSubmit = async () => {
    if (!bookingName || !bookingEmail) {
      setBookingError('Please fill in name and email.');
      return;
    }
    if (!bookingSession) return;

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
            studentName: bookingName,
            studentEmail: bookingEmail,
            studentPhone: bookingPhone || '',
            amount: 0,
            tier: tier.name || 'Free',
            collection: masterclasses.some((m) => m.id === sessionId) ? 'masterclasses' : 'sessions',
            status: 'completed',
            userId: effectiveUser.uid,
            isFree: true,
            bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
          };
          const ref = await db.collection('registrations').add(regPayload);
          setBookingLoading(false);
          await completeBookingSuccess({
            paymentId: `free_${ref.id}`,
            orderId: `free_${Date.now()}`,
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
        setBookingError('Could not save your registration. Please try again.');
        setBookingLoading(false);
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
          phone: bookingPhone || '',
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
              phone: bookingPhone || '',
              tier: tier.name,
              userId: effectiveUser.uid,
            });
          } else {
            await completeBookingSuccess({
              paymentId: `pay_demo_${Math.random().toString(36).substring(2, 10)}`,
              orderId: orderData.orderId,
            });
          }
        } else if (typeof window.Razorpay === 'undefined') {
          throw new Error('Razorpay Checkout SDK is not loaded in browser.');
        } else {
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: 'INR',
            name: 'The Agent Engineer',
            description: `${bookingSession.title} · ${tier.name}`,
            order_id: orderData.orderId,
            prefill: { name: bookingName, email: bookingEmail, contact: bookingPhone },
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
      // If we already have an anonymous user (from guest checkout), upgrade it to Google
      // so their booking history is preserved.
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          await auth.currentUser.linkWithPopup(provider);
        } catch (linkErr) {
          // If linking fails (e.g. credential already in use), fall back to sign-in.
          if (linkErr?.code === 'auth/credential-already-in-use') {
            await auth.signInWithPopup(provider);
          } else {
            throw linkErr;
          }
        }
      } else {
        await auth.signInWithPopup(provider);
      }
      if (bookingSuccess) {
        closeBooking();
        setActiveMainTab('mybookings');
      } else {
        setBookingStep(1);
      }
    } catch (err) {
      setBookingError(err.message || 'Google sign-in failed.');
    } finally {
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
        ? `http://127.0.0.1:5001/coaching-site-gowtam-2026/us-central1/razorpayWebhook`
        : `https://us-central1-coaching-site-gowtam-2026.cloudfunctions.net/razorpayWebhook`;

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

  // ── Single source of truth for the live masterclass ──
  // Compute once at the top of render so every downstream surface (hero, banner,
  // popup, curriculum, booking, sticky bar, closing CTA) sees the SAME object.
  // mergeMcWithConfig makes site.config.js win for content; Firestore only
  // contributes runtime state (seatsBooked, zoomLink, etc).
  const nextMasterclass = mergeMcWithConfig(getNextUpcomingMasterclass(masterclasses, sessions));
  const bookingCtx = {
    setBookingSession, setBookingStep, setBookingSuccess, setSelectedTier,
    setBookingName, setBookingEmail, setBookingPhone, setBookingError, user,
  };
  const openBooking = (mc) => openBookingForSession(mc || nextMasterclass, bookingCtx);

  return (
    <React.Fragment>
      {/* Top promo banner — dismissible, persistent across the app */}
      <V2TopBanner nextMc={nextMasterclass} onReserve={openBooking} />
      <V2WelcomePopup nextMc={nextMasterclass} onReserve={openBooking} />

      {motion ? (
        <motion.nav
          className="nav"
          aria-label="Primary"
          animate={{
            backdropFilter: scrolled ? 'blur(14px)' : 'blur(0px)',
            WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'blur(0px)',
            backgroundColor: scrolled
              ? (theme === 'dark' ? 'rgba(10,9,16,0.88)' : 'rgba(244,241,236,0.88)')
              : 'transparent',
            borderBottom: scrolled
              ? (theme === 'dark' ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(28,24,20,0.10)')
              : '0.5px solid transparent',
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
        <div className="nav__brand">
          <span className="nav__brand-mark" aria-hidden="true">A</span>
          <span><b>Agent Engineer</b> · Coaching</span>
        </div>

        {/* Tabbed Navigation header in the navbar */}
        <div className="nav__tabs" role="tablist">
          <button 
            role="tab" 
            aria-selected={activeMainTab === 'home'}
            className={`nav__tab-btn ${activeMainTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('home')}
          >
            Home
          </button>
          <button 
            role="tab" 
            aria-selected={activeMainTab === 'roadmap'}
            className={`nav__tab-btn ${activeMainTab === 'roadmap' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('roadmap')}
          >
            Full Roadmap
          </button>
          {user && !user.isAnonymous && !isUserStaff && (
            <button
              role="tab"
              aria-selected={activeMainTab === 'mybookings'}
              className={`nav__tab-btn ${activeMainTab === 'mybookings' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('mybookings')}
            >
              My Masterclasses
            </button>
          )}
          {isUserStaff && (
            <button 
              role="tab" 
              aria-selected={activeMainTab === 'dashboard'}
              className={`nav__tab-btn ${activeMainTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('dashboard')}
            >
              Dashboard
            </button>
          )}
        </div>

        <div className="nav__right">
          {/* Sign In / Sign Out button inside right section */}
          {user && !user.isAnonymous ? (
            <button 
              className={`nav__auth-btn is-active`} 
              onClick={() => {
                if (isUserStaff) setActiveMainTab('dashboard');
                else setActiveMainTab('mybookings');
              }}
            >
              <span className="hero__eyebrow-dot" style={{ background: "var(--c-amber)", width: "5px", height: "5px" }} />
              {(user.email || '').substring(0, 10)}...
            </button>
          ) : (
            <button 
              className="nav__auth-btn" 
              onClick={() => {
                setLoginError("");
                setStaffLoginOpen(true);
              }}
            >
              Sign In / Register
            </button>
          )}

          {/* Book a seat persistent CTA button */}
          <button
            className="nav__book-seat-btn"
            onClick={() => openBooking(nextMasterclass)}
          >
            Book a seat
          </button>

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
        <nav className="nav" aria-label="Primary" style={{ background: 'transparent' }}>
          <div className="nav__brand">
            <span className="nav__brand-mark" aria-hidden="true">A</span>
            <span><b>Agent Engineer</b> · Coaching</span>
          </div>
          <div className="nav__tabs" role="tablist">
            <button className={`nav__tab-btn ${activeMainTab === 'home' ? 'active' : ''}`} onClick={() => setActiveMainTab('home')}>Home</button>
            <button className={`nav__tab-btn ${activeMainTab === 'roadmap' ? 'active' : ''}`} onClick={() => setActiveMainTab('roadmap')}>Full Roadmap</button>
          </div>
          <div className="nav__right">
            <button
              className="nav__book-seat-btn"
              onClick={() => {
                if (nextMasterclass) {
                  openBooking(nextMasterclass);
                } else {
                  const el = document.getElementById('masterclasses');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              {isMcFree(nextMasterclass) ? 'Reserve free seat' : 'Book a seat'}
            </button>
            <button type="button" className="theme-toggle" onClick={toggleTheme}>
              <span className="theme-toggle__track">
                <span className="theme-toggle__thumb" aria-hidden="true">
                  {theme === 'light' ? '☀' : '☾'}
                </span>
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Render Main Views based on active tab state */}
      {activeMainTab === 'home' && (
        <main id="main" className="coaching-home">
          {/* ── V2 Hero (2-column: copy + CTA left, video right) ── */}
          <V2HeroSection
            nextMc={nextMasterclass}
            onReserve={openBooking}
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
            <V2Curriculum nextMc={nextMasterclass} onReserve={openBooking} />
          )}

          {/* ── Not sure where to start? → Roadmap ── */}
          {V2_CONFIG.showWhereToStart && (
            <V2WhereToStart onRoadmap={() => { setActiveMainTab('roadmap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          )}

          {/* ── Thin testimonial band — disabled until we have real YouTube reviews ── */}
          {V2_CONFIG.showQuoteBand && <V2QuoteBand />}

          {/* ── Follow cards: YouTube · LinkedIn · GitHub · Instagram ── */}
          <V2FollowGrid />

          {/* ── AI-Structured Masterclasses (Split-Pane UI) ── */}
          {!loadingMasterclasses && masterclasses.length > 0 && (
            <div id="masterclasses" style={{ marginBottom: sessions.length > 0 ? "56px" : "0" }}>
              {masterclasses.map((mc, idx) => (
                <MasterclassCard 
                  key={mc.id}
                  mc={mc}
                  idx={idx}
                  user={user}
                  onBook={openBooking}
                />
              ))}
            </div>
          )}

          {/* ── Legacy Session Cards (shown when no masterclasses yet, or as secondary) ── */}
          {(loadingSessions || loadingMasterclasses) && masterclasses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--fg-faint)" }}>
              <div style={{ fontSize: "14px", fontFamily: "JetBrains Mono" }}>Loading active classes...</div>
            </div>
          ) : masterclasses.length === 0 && sessions.length === 0 ? (
            <div className="coaching-empty">
              <div className="coaching-empty__icon">📅</div>
              <h2 className="coaching-empty__title">Classes schedule pending</h2>
              <p className="coaching-empty__desc">Our staff is currently preparing the next set of live workshops. Check back shortly!</p>
            </div>
          ) : sessions.length > 0 && (
            <>
              {masterclasses.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", marginBottom: "20px" }}>
                    More upcoming sessions
                  </div>
                </div>
              )}
              <RevealOnScroll>
                <div className="session-grid">
                {sessions.map(s => (
                  <article key={s.id} className="session-card">
                    <h2 className="session-card__title">{s.title}</h2>
                    <p className="session-card__desc">{s.description}</p>
                    
                    <div className="session-card__meta">
                      <div className="session-card__badge">
                        <svg className="session-card__badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                        <span>{new Date(s.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
                      <span className="session-card__price">₹{(s.price || 0).toLocaleString()}</span>
                    </div>

                      <ShimmerButton
                        variant="dark"
                        onClick={() => openBooking(s)}
                      >
                        Book Seat
                      </ShimmerButton>
                  </article>
                ))}
                </div>
              </RevealOnScroll>
            </>
          )}

          {/* ── Instructor Bio Strip ── */}
          <InstructorBio />

          {/* ── Success Stories — disabled until we curate real YouTube reviews ── */}
          {V2_CONFIG.showSuccessStories && <V2SuccessStories />}

          <V2FAQSection onLegal={setLegalPage} />

          {/* ── Closing CTA Section ── */}
          <V2ClosingCTA nextMc={nextMasterclass} onReserve={openBooking} />

          {/* ── Footer Section ── */}
          <SiteFooter setActiveMainTab={setActiveMainTab} setLegalPage={setLegalPage} />

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
        />
      )}

      {activeMainTab === 'mybookings' && user && !user.isAnonymous && !isUserStaff && (
        <V2StudentDashboard user={user} db={db} onReserve={() => { setActiveMainTab('home'); openBooking(nextMasterclass); }} />
      )}

      {activeMainTab === 'dashboard' && isUserStaff && (
        <DashboardView 
          user={user} 
          role={userRole} 
          onLogout={handleLogout}
        />
      )}


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
          <div className="modal-container" style={{ border: "1px solid var(--c-amber)" }}>
            <button className="modal-close" onClick={() => setMockCheckoutData(null)}>×</button>
            <div className="coaching-home__eyebrow" style={{ color: "var(--c-amber)", border: "1px solid var(--c-amber)" }}>
              <span className="hero__eyebrow-dot" style={{ background: "var(--c-amber)" }} />
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
        <div className="modal-overlay" onClick={() => setStaffLoginOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setStaffLoginOpen(false)}>×</button>
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

            <form onSubmit={handleStaffLogin}>
              {isRegistering && (
                <div className="form-group">
                  <label className="form-label">Full Name <span style={{ color: "var(--c-pink)" }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter your full name" 
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email address <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="Enter your full email address" 
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              {isRegistering && (
                <React.Fragment>
                  <div className="form-group">
                    <label className="form-label">Phone Number <span style={{ color: "var(--c-pink)" }}>*</span></label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="Enter your phone number" 
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      required
                    />
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

              <div style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--fg-dim)" }}>
                {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
                <button 
                  type="button" 
                  style={{ background: "none", border: "none", color: "var(--c-pink)", cursor: "pointer", textDecoration: "underline", font: "inherit", fontWeight: "500" }}
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setLoginError("");
                  }}
                >
                  {isRegistering ? "Sign in" : "Register now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Forced Profile Completion Modal */}
      {showCompleteProfile && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
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
                  disabled
                  readOnly
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number <span style={{ color: "var(--c-pink)" }}>*</span></label>
                <input 
                  type="tel" 
                  className="form-input" 
                  placeholder="Enter your phone number" 
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  required
                />
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
            </form>
          </div>
        </div>
      )}

      {/* Search Command Palette Overlay */}
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onJumpPhase={scrollToPhase}
        onJumpCapstone={scrollToCapstone} />

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

      <V2MobileStickyBar nextMc={nextMasterclass} onReserve={openBooking} />
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
