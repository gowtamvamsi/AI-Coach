// =====================================================================
// seo.config.js — SEO & AI-agent discoverability (single source of truth)
// =====================================================================
// Loaded after site.config.js. seo-inject.js reads this at page load.
// Update stats here OR in site.config.js brand.stats (stats merge automatically).
// =====================================================================

window.SEO_CONFIG = {
  siteUrl: 'https://balajichippada.com',
  siteName: 'The Agent Engineer',
  locale: 'en_IN',
  language: 'en',

  title: 'Production-grade Agentic AI Course',
  description:
    'Build production-grade Agentic AI with someone who ships it. Learn to architect, evaluate, and deploy reliable AI agents — RAG, tool use, multi-agent systems, evals, guardrails and cloud deployment. Plus the free 26-week roadmap.',
  keywords: [
    'agentic AI',
    'AI engineer roadmap 2026',
    'Balaji Chippada',
    'LangGraph',
    'RAG pipeline',
    'MCP Model Context Protocol',
    'production AI agents',
    'FastAPI LLM',
    'multi-agent orchestration',
    'LLMOps',
    'Claude Code masterclass',
    'AI engineer course India',
    'free AI roadmap',
  ].join(', '),

  ogImage: 'https://balajichippada.com/uploads/og-share.jpg',
  ogImageAlt: 'Balaji Chippada — The Agent Engineer: RAG, tool use, multi-agent, evals, guardrails, observability, deployment',

  twitterHandle: '@balajichippada',

  // External canonical resources AI agents & search engines should cite
  externalUrls: {
    roadmapGitHub: 'https://ch-balaji.github.io/ai-engineer-roadmap/',
    roadmapVideo: 'https://www.youtube.com/watch?v=Eze6D8jAMjI',
    youtubeChannel: 'https://www.youtube.com/@balajichippada',
    linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
    whatsappCommunity: 'https://chat.whatsapp.com/ENnDGZ41lMYBHCApJIpzo6',
  },

  // Plain-language summary for AI agents (also mirrored in llms.txt)
  aiSummary: [
    'Balaji Chippada (The Agent Engineer) teaches software engineers to architect, evaluate and deploy production-grade AI agents.',
    'Two tracks: (1) the paid flagship course "Agentic AI at Production Level" — 16 modules, 265 self-paced lessons, no prerequisites (Python taught inside), one-time payment, 2 years of access with biweekly updates, quizzes and reviewed assignments, 9 hands-on projects plus 3 capstones, 24-hour doubt support, weekly live sessions, 2 mock interviews and resume prep, and a certificate awarded only on demonstrated completion; and (2) a free, open 26-week / 9-phase Agentic AI Engineer roadmap with embedded YouTube lessons and progress tracking. Live demo-first masterclasses (RAG, Claude Code, LangGraph, deployment) run alongside both.',
    'Audience: complete beginners starting from zero, and working engineers targeting roles like Forward Deployed Engineer who can code but have never taken an agent to production.',
    'Course modules: Python Fundamentals → Advanced Python → NLP Basics → LLM Internals & LangChain → Prompt Engineering → Foundations of Agentic Systems → RAG → MCP → Memory & Optimization → LangGraph → Evaluation → Multi-Agent Orchestration → Security & Guardrails → Deployment → Monitoring & Operations → Capstones.',
    'Full detail for AI agents: https://balajichippada.com/llms.txt and https://balajichippada.com/llms-full.txt.',
  ].join(' '),

  // ── Per-route metadata (single source of truth for routing + SEO) ──
  // tab      → which main app tab this URL maps to
  // scrollTo → element id to scroll to after the home tab renders
  routes: {
    '/': {
      tab: 'home',
    },
    '/courses': {
      tab: 'home', // legacy URL — courses content now lives on the home tab
    },
    '/roadmap': {
      tab: 'roadmap',
      title: 'Agentic AI Engineer Roadmap (2026) — 26 Weeks, 9 Phases · Balaji Chippada',
      description:
        'The complete free 26-week agentic AI engineer roadmap: Python foundations, LLM mental models, prompt engineering, RAG with evaluation, MCP & tools, memory, LangGraph multi-agent systems, guardrails, LLMOps, and AWS deployment — interactive, with embedded YouTube lessons and progress tracking.',
    },
    '/masterclasses': {
      tab: 'masterclass',
      title: 'Live Agentic AI Masterclasses — Demo-First Builds · Balaji Chippada',
      description:
        'Live, demo-first masterclasses where you ship a production-grade AI agent on the call: RAG, Claude Code, LangGraph, multi-agent systems, guardrails, and deployment. First class free, recording + certificate included, 100% refund within 7 days.',
    },
    '/about': {
      tab: 'masterclass',
      scrollTo: 'instructor',
      title: 'About Balaji Chippada — The Agent Engineer (230K+ roadmap views)',
      description:
        'Balaji Chippada is an AI engineer and educator behind the 230K+-view 2026 Agentic AI Engineer roadmap. He teaches production RAG, LangGraph, MCP, and multi-agent systems — demo-first on YouTube (35K+ subscribers) and in live masterclasses.',
    },
  },

  // Normalizes a pathname → resolved route meta (title/description/canonical/tab).
  getRouteMeta(pathname) {
    const p = (pathname || '/').replace(/\/+$/, '') || '/';
    const r = (this.routes && this.routes[p]) || this.routes['/'] || {};
    return {
      path: p,
      tab: r.tab || 'home',
      scrollTo: r.scrollTo || null,
      title: r.title || this.title,
      description: r.description || this.description,
      canonical: this.siteUrl + (p === '/' ? '/' : p),
    };
  },

  curriculumPhases: [
    { id: 1, title: 'Python Foundations', weeks: '1–3', modules: 6 },
    { id: 2, title: 'The Mental Model of an LLM', weeks: '4', modules: 5 },
    { id: 3, title: 'Prompt Engineering & API Access', weeks: '5–7', modules: 7 },
    { id: 4, title: 'RAG + Evaluation', weeks: '8–12', modules: 9 },
    { id: 5, title: 'Tools, MCP, and Single Agents', weeks: '13–16', modules: 8 },
    { id: 6, title: 'Memory & Context Engineering', weeks: '17–19', modules: 7 },
    { id: 7, title: 'Multi-Agent Orchestration', weeks: '20–22', modules: 8 },
    { id: 8, title: 'Guardrails & LLMOps', weeks: '23–24', modules: 4 },
    { id: 9, title: 'Cloud Infrastructure & Deployment', weeks: '25–26', modules: 6 },
  ],

  buildJsonLd(route) {
    const brand = (window.SITE_CONFIG && window.SITE_CONFIG.brand) || {};
    const stats = brand.stats || {};
    const faqs = (window.SITE_CONFIG && window.SITE_CONFIG.faqs) || [];
    const mc = (window.SITE_CONFIG && window.SITE_CONFIG.nextMasterclass) || {};
    const url = this.siteUrl;
    const routePath = (route && route.path) || '/';
    const views = stats.roadmapViews || '230K+';
    const subs = stats.youtubeSubs || '35K+';

    const graph = [
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        url,
        name: this.siteName,
        description: this.description,
        inLanguage: this.language,
        publisher: { '@id': `${url}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: this.siteName,
        url,
        logo: {
          '@type': 'ImageObject',
          url: this.ogImage,
        },
        sameAs: [
          brand.youtubeChannel || this.externalUrls.youtubeChannel,
          brand.linkedin || this.externalUrls.linkedin,
          brand.instagram,
          brand.github,
          this.externalUrls.roadmapGitHub,
        ].filter(Boolean),
      },
      {
        '@type': 'Person',
        '@id': `${url}/#person`,
        name: brand.name || 'Balaji Chippada',
        jobTitle: 'AI Engineer & Educator',
        description:
          `Creator of the ${views}-view 2026 Agentic AI Engineer roadmap. Teaches production RAG, LangGraph, MCP, and multi-agent systems via YouTube (${subs} subscribers) and live masterclasses.`,
        url,
        image: this.ogImage,
        sameAs: [
          brand.youtubeChannel || this.externalUrls.youtubeChannel,
          brand.linkedin || this.externalUrls.linkedin,
          brand.instagram,
          brand.github,
        ].filter(Boolean),
        worksFor: { '@id': `${url}/#organization` },
      },
      {
        '@type': 'Course',
        '@id': `${url}/#roadmap-course`,
        name: '2026 Agentic AI Engineer Roadmap — 26 Weeks, 9 Phases',
        description:
          'Free, open, production-grade curriculum: Python & async, LLM mental models, prompt engineering, RAG with evaluation, MCP & tools, memory, multi-agent LangGraph, guardrails, and AWS deployment. Includes 3 capstone projects.',
        url: `${url}/#roadmap`,
        provider: { '@id': `${url}/#person` },
        educationalLevel: 'Intermediate to Advanced',
        teaches: [
          'Python for AI engineering',
          'Retrieval-Augmented Generation (RAG)',
          'LangGraph multi-agent orchestration',
          'Model Context Protocol (MCP)',
          'LLMOps and guardrails',
          'AWS agent deployment',
        ],
        timeRequired: 'P26W',
        isAccessibleForFree: true,
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'online',
          courseWorkload: 'PT156H', // ~6 hours/week over the 26-week curriculum
        },
      },
      {
        '@type': 'VideoObject',
        '@id': `${url}/#roadmap-video`,
        name: 'Full Agentic AI Engineer Roadmap Walkthrough (2026)',
        description: `Complete ${views} walkthrough of the 26-week agentic AI engineer curriculum.`,
        thumbnailUrl: `https://i.ytimg.com/vi/Eze6D8jAMjI/maxresdefault.jpg`,
        uploadDate: '2025-01-01',
        contentUrl: this.externalUrls.roadmapVideo,
        embedUrl: 'https://www.youtube.com/embed/Eze6D8jAMjI',
        publisher: { '@id': `${url}/#person` },
      },
    ];

    if (mc.title) {
      graph.push({
        '@type': 'Event',
        '@id': `${url}/#next-masterclass`,
        name: mc.title,
        description: mc.subtitle || mc.title,
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        startDate: mc.dateTime,
        duration: mc.duration ? `PT${mc.duration}M` : undefined,
        location: {
          '@type': 'VirtualLocation',
          url,
        },
        organizer: { '@id': `${url}/#person` },
        offers: {
          '@type': 'Offer',
          price: mc.price != null ? String(mc.price) : '0',
          priceCurrency: mc.currency || 'INR',
          availability: 'https://schema.org/InStock',
          url,
        },
      });
    }

    // ── Breadcrumbs for sub-pages ──
    if (routePath !== '/') {
      const labels = { '/roadmap': 'Roadmap', '/masterclasses': 'Masterclasses', '/about': 'About' };
      graph.push({
        '@type': 'BreadcrumbList',
        '@id': `${url}${routePath}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${url}/` },
          { '@type': 'ListItem', position: 2, name: labels[routePath] || routePath, item: `${url}${routePath}` },
        ],
      });
    }

    // ── Roadmap page: phase ItemList + per-video VideoObjects ──
    if (routePath === '/roadmap') {
      graph.push({
        '@type': 'ItemList',
        '@id': `${url}/roadmap#phases`,
        name: '2026 Agentic AI Engineer Roadmap — 9 Phases',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: this.curriculumPhases.length,
        itemListElement: this.curriculumPhases.map((ph, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Phase ${ph.id}: ${ph.title} (weeks ${ph.weeks}, ${ph.modules} modules)`,
        })),
      });

      // Skip the overview walkthrough (Eze6D8jAMjI) — it already has a dedicated
      // #roadmap-video node above, so we avoid emitting a duplicate VideoObject.
      const overviewId = 'Eze6D8jAMjI';
      const seedVideos = (window.ROADMAP_VIDEOS || []).filter((v) => v.youtubeId && v.youtubeId !== overviewId);
      seedVideos.forEach((v) => {
        graph.push({
          '@type': 'VideoObject',
          '@id': `${url}/roadmap#video-${v.youtubeId}`,
          name: v.title,
          description: `${v.title} — part of the 2026 Agentic AI Engineer roadmap by Balaji Chippada.`,
          thumbnailUrl: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
          uploadDate: '2025-01-01',
          contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
          embedUrl: `https://www.youtube.com/embed/${v.youtubeId}`,
          publisher: { '@id': `${url}/#person` },
        });
      });
    }

    if (faqs.length) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${url}/#faq`,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.a,
          },
        })),
      });
    }

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    };
  },
};
