// =====================================================================
// site.config.js — SINGLE-FILE CONTENT CONFIG for the coaching website
// =====================================================================
// Edit this file to change ANYTHING on the website without touching code.
// After editing, hard-refresh the page (Cmd/Ctrl + Shift + R) to see updates.
//
// Loaded as a plain <script> tag before the React app, so it just exposes
// window.SITE_CONFIG. No bundler / no build step required.
//
// ─────────────────────────────────────────────────────────────────────
// QUICK GUIDE
// ─────────────────────────────────────────────────────────────────────
// 1. Update `brand` for your name, channel, socials, stats.
// 2. Update `instructor` for the popup details + curriculum section bio.
// 3. Update `nextMasterclass` for the live masterclass shown everywhere:
//    - Set `price: 0` for a FREE masterclass (whole UI adapts)
//    - Set `dateTime` to the ISO string in YOUR timezone (countdown reads this)
//    - Set `thumbnail: '/uploads/poster.png'` to swap the gradient poster
//      with a real image (popup + curriculum section both use it)
// 4. Update `faqs` to change accordion items.
// 5. Toggle `featureFlags` to show/hide sections.
// 6. Update `seo.config.js` for search + AI-agent SEO (title, description, llms.txt content).
//
// EVERY field below is documented inline.
// =====================================================================

window.SITE_CONFIG = {
  // ─────────────────────────────────────────────────────────────────
  // Brand identity & socials — used by nav, hero stats, Follow grid, footer
  // ─────────────────────────────────────────────────────────────────
  brand: {
    name: 'Balaji Chippada',
    tagline: 'The Agent Engineer',
    handle: '@balajichippada',
    youtubeChannel: 'https://www.youtube.com/@balajichippada',
    roadmapVideoId: 'q0doXVA18-A', // homepage hero embed
    roadmapVideoUrl: 'https://www.youtube.com/watch?v=Eze6D8jAMjI',
    whatsappCommunity: 'https://chat.whatsapp.com/D8YynWP15hp286CszuB5Xa',
    linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
    instagram: 'https://www.instagram.com/balajichippada',
    github: 'https://github.com/ch-balaji',
    stats: {
      youtubeSubs: '26K+',
      roadmapViews: '170K+',
      studentsTrained: '3000+',
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Instructor — shown in popup details view + homepage bio + curriculum section
  // ─────────────────────────────────────────────────────────────────
  instructor: {
    name: 'Balaji Chippada',
    title: '8 years in AI/ML · Production agentic AI · 26K+ YouTube',
    photo: 'uploads/balaji-chippada-avatar.webp', // optimized 256px avatar (full-res PNG kept for og:image). Leave empty for initials avatar
    bio: 'I build production-scale agentic applications and teach engineers what actually matters when systems leave the demo stage. The free 26-week roadmap (170K+ views) is open source with no paywall — live masterclasses are where we build together on specific phases: RAG, Claude Code, multi-agent orchestration, guardrails and deployment.',
    quote: 'I show the agent working first, then explain the mental model — LLM, workflow, agent. Numbers and artefacts beat adjectives.',
    chips: ['170K+ roadmap views', 'LangGraph', 'ReAct · MCP', 'Production RAG', 'Multi-Agent', 'LLMOps'],
    linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
    youtube: 'https://www.youtube.com/@balajichippada',
  },

  // ─────────────────────────────────────────────────────────────────
  // NEXT LIVE MASTERCLASS — the single source of truth for the live class
  // ─────────────────────────────────────────────────────────────────
  // This is what the hero, banner, popup, curriculum section, booking
  // wizard, mobile sticky and closing CTA all read from.
  //
  // To run a FREE first masterclass: set `price: 0`. The whole UI flips
  // automatically (FREE pills, "Reserve free seat" CTAs, Razorpay skipped).
  nextMasterclass: {
    id: 'mc-claude-architect-2026-05',     // must match Firestore doc id if used
    title: 'Mastering Claude Code: Building Agentic Systems',
    shortTitle: 'Claude Code Masterclass',  // used in compact spots (banner)
    subtitle: 'Demo-first build of a production-grade Claude agent — in 2 hours.',

    // ── Schedule ──
    dateTime: '2026-07-11T19:00:00+05:30', // keep in sync with the live Firestore masterclass date (else the old date flashes on load before Firestore loads)
    duration: 120,                          // minutes (shown as "120 min session")
    timezone: 'IST',

    // ── Pricing ──
    price: 0,             // 0 = FREE (entire UI adapts). Set to 499 / 999 / etc.
    originalPrice: null,  // struck "was" price. FREE class → price:0 + originalPrice:599 shows "₹599 ̶Free" everywhere. Paid discount → originalPrice:999 + price:499. null → free shows the ₹299 default anchor.
    currency: 'INR',

    // ── Seats ──
    seatsTotal: 100,
    seatsBooked: 53,      // hand-tuned; Firestore can override at runtime

    // ── Visuals ──
    thumbnail: '',        // e.g. '/uploads/claude-masterclass.png' — wide 16:9 image
                          // Empty → falls back to gradient poster everywhere.
    thumbnailAlt: 'Mastering Claude Code masterclass poster',

    // ── Tech stack chips shown in popup details ──
    stack: ['Claude Code', 'MCP', 'Anthropic SDK', 'Python', 'LangGraph'],

    // ── Long-form copy (markdown-light: line breaks + bullets work) ──
    about: `Move beyond simple prompting and master the art of AI system design.
We will dive into the architectural patterns required to build autonomous, production-ready systems using the Claude ecosystem — from basic chat to complex agentic orchestration.`,

    whyJoin: `You will leave with a clear understanding of the technical skills, protocols and design philosophies required to build reliable, scalable agentic systems in production.`,

    idealFor: `AI engineers, senior developers and solution architects looking to specialise in enterprise-grade Claude deployments.`,

    // ── Key learning outcomes — shown as checkmark list in popup details ──
    learnings: [
      'Agentic orchestration — design autonomous loops and multi-agent systems',
      'Tooling & MCP — integrate Model Context Protocol with your own data',
      'Claude Code & environment — configure & optimise for enterprise codebases',
      'Context & prompt engineering — caching, system prompts, cost controls',
      'Architectural patterns — self-correcting, multi-step workflows',
    ],

    // ── Curriculum modules — shown on homepage (linked to from "Explore curriculum") ──
    curriculum: [
      {
        module: 'Module 01',
        title: 'Foundations — the Claude mental model',
        duration: '25 min',
        points: [
          'Claude vs ChatGPT — when each one wins',
          'Setting up Claude Code locally with your existing repo',
          'Reading the docs the way the model expects you to',
        ],
      },
      {
        module: 'Module 02',
        title: 'Tool use & MCP integration',
        duration: '45 min',
        points: [
          'Designing tools the model can actually call reliably',
          'MCP server setup — connecting Claude to your data & shell',
          'Live demo: an agent that browses your repo, opens PRs',
        ],
      },
      {
        module: 'Module 03',
        title: 'Context & prompt engineering for production',
        duration: '35 min',
        points: [
          'Prompt caching for 10× cost reduction',
          'System prompts that hold across long sessions',
          'Token budget patterns we use in real teams',
        ],
      },
      {
        module: 'Module 04',
        title: 'Architectural patterns — self-correcting workflows',
        duration: '40 min',
        points: [
          'Plan → execute → critique loops',
          'Multi-agent orchestration with specialised models',
          'Graceful failure & retry primitives',
        ],
      },
      {
        module: 'Module 05',
        title: 'Live build — ship an agent in 30 minutes',
        duration: '35 min',
        points: [
          'Pick a real task, agent solves it on the call',
          'Q&A with code-level answers, recording shared after',
        ],
      },
    ],

    zoomLink: '',          // pasted in by you once Zoom event created
    recordingUrl: '',
    slidesUrl: '',
  },

  // ─────────────────────────────────────────────────────────────────
  // Welcome popup — auto-shown to first-time visitors (per masterclass)
  // ─────────────────────────────────────────────────────────────────
  welcomePopup: {
    enabled: true,
    delayMs: 1800,                  // wait before showing (give them a glimpse of the hero)
    livePillLabel: 'FREE WEBINAR',  // automatic — leave as null to derive from price
    primaryCtaSummary: 'View details & register',
    primaryCtaDetails: 'Reserve my free seat',
    dismissLabel: 'Maybe later',
  },

  // ─────────────────────────────────────────────────────────────────
  // Frequently Asked Questions — accordion cards on the homepage
  // ─────────────────────────────────────────────────────────────────
  faqs: [
    {
      q: "I'm a beginner — is this too advanced?",
      a: 'If you can write Python and use a terminal — Phase 1 of the free roadmap — you are ready. I teach LLM vs workflow vs agent from scratch, demo-first, like on my YouTube channel.',
    },
    {
      q: 'Is the first masterclass really free?',
      a: 'Yes — the very first masterclass is FREE so the community can attend and try it out. Future masterclasses are paid (₹499). Meeting link emailed a few days before the masterclass +  Meeting reminders. The recording is emailed after the session.',
    },
    {
      q: 'What if I miss the live session?',
      a: 'The session is recorded and emailed to all registered attendees within 48 hours.',
    },
    {
      q: 'Do I get a certificate?',
      a: 'Certificate of completion is issued after attending the live session (or via the recording for paid masterclasses).',
    },
    {
      q: "What's the refund policy?",
      a: '100% refund within 24 hours of purchase, no questions asked. The free masterclass has nothing to refund.',
      link: 'refund',
    },
    {
      q: 'What language is the session in?',
      a: 'English for technical content with Telugu explanations where they help — same style as my roadmap video. Q&A welcomes Hindi and Telugu.',
    },
    {
      q: 'What do I need to prepare?',
      a: 'A laptop with Python 3.10+, VS Code, and API access (Anthropic / OpenAI free tiers work). Full prep checklist sent after booking.',
    },
    {
      q: 'How is this different from your free YouTube content?',
      a: 'YouTube teaches the mental model and roadmap. Masterclasses are live build sessions — you ship a working system with me debugging in real time.',
    },
    {
      q: 'How do I join the live session?',
      a: 'Meeting link emailed a few days before the masterclass +  Meeting reminders. Session details stay available in My Account.',
    },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Rotating testimonials (currently OFF — turn on once real reviews land)
  // ─────────────────────────────────────────────────────────────────
  heroQuotes: [
    // Replace with actual YouTube comment snippets. Set featureFlags.showQuoteBand = true to render.
    { text: 'Shipped my first agent in 3 days — demo-first teaching just works.', author: 'Rahul · SDE, Bengaluru' },
    { text: 'Finally got LLM vs workflow vs agent. Balaji shows the agent running first.', author: 'Sneha · ML engineer' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Feature flags — global on/off switches for homepage sections
  // ─────────────────────────────────────────────────────────────────
  featureFlags: {
    showWelcomePopup: false,
    showTopBanner: false,
    showHowItWorks: true,
    showWhereToStart: true,
    showHeroSecondaryCta: true,    // "Explore the curriculum" button next to primary
    showCurriculumSection: true,   // on-page curriculum that "Explore curriculum" scrolls to
    showQuoteBand: false,          // ★★★★★ rotating testimonial — off until real reviews
    showSuccessStories: false,     // 3-card testimonial grid — off until real reviews
  },
};
