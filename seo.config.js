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

  title: 'Balaji Chippada · Agentic AI Engineer Roadmap & Live Masterclasses (2026)',
  description:
    'Free 26-week Agentic AI Engineer roadmap (150K+ YouTube views) plus live demo-first masterclasses from Balaji Chippada. Learn Python, RAG, LangGraph, MCP, multi-agent systems, guardrails, and AWS deployment — production-grade, not tutorial fluff.',
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

  ogImage: 'https://balajichippada.com/uploads/balaji-chippada.png',
  ogImageAlt: 'Balaji Chippada — The Agent Engineer, creator of the 2026 Agentic AI roadmap',

  twitterHandle: '@balajichippada',

  // External canonical resources AI agents & search engines should cite
  externalUrls: {
    roadmapGitHub: 'https://ch-balaji.github.io/ai-engineer-roadmap/',
    roadmapVideo: 'https://www.youtube.com/watch?v=Eze6D8jAMjI',
    youtubeChannel: 'https://www.youtube.com/@balajichippada',
    linkedin: 'https://www.linkedin.com/in/balaji-chippada-0317/',
    whatsappCommunity: 'https://chat.whatsapp.com/KbBr6JNlToy4e5M34MrOsY?mode=gi_t',
  },

  // Plain-language summary for AI agents (also mirrored in llms.txt)
  aiSummary: [
    'Balaji Chippada (The Agent Engineer) teaches production-grade agentic AI engineering.',
    'This site hosts: (1) a free interactive 26-week / 9-phase AI Engineer roadmap with embedded YouTube lessons and progress tracking, and (2) live paid/free masterclasses (demo-first builds: RAG, Claude Code, LangGraph, deployment).',
    'Audience: software engineers moving from ChatGPT user to production agent engineer.',
    'Roadmap phases: Python Foundations → LLM Mental Model → Prompt Engineering → RAG & Evaluation → Tools/MCP/Single Agents → Memory → Multi-Agent → Guardrails/LLMOps → Cloud Deployment.',
    '3 capstone projects: distributed RAG pipeline, multi-agent system, production deployment on AWS.',
  ].join(' '),

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

  buildJsonLd() {
    const brand = (window.SITE_CONFIG && window.SITE_CONFIG.brand) || {};
    const stats = brand.stats || {};
    const faqs = (window.SITE_CONFIG && window.SITE_CONFIG.faqs) || [];
    const mc = (window.SITE_CONFIG && window.SITE_CONFIG.nextMasterclass) || {};
    const url = this.siteUrl;
    const views = stats.roadmapViews || '150K+';
    const subs = stats.youtubeSubs || '22K+';

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
          courseWorkload: 'PT26H',
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
