// Injects meta tags + JSON-LD from SEO_CONFIG / SITE_CONFIG (runs synchronously in <head>).
(function () {
  const cfg = window.SEO_CONFIG;
  if (!cfg) return;

  const brand = (window.SITE_CONFIG && window.SITE_CONFIG.brand) || {};
  const stats = brand.stats || {};
  const url = cfg.siteUrl || 'https://balajichippada.com';

  // Resolve per-route metadata (falls back to site defaults for unknown paths).
  const route = (typeof cfg.getRouteMeta === 'function')
    ? cfg.getRouteMeta(location.pathname)
    : { title: cfg.title, description: cfg.description, canonical: url + '/' };

  const title = route.title || cfg.title;
  const desc = (route.description || cfg.description).replace('170K+', stats.roadmapViews || '170K+');
  const canonical = route.canonical || (url + '/');

  document.title = title;

  // Keep <link rel="canonical"> aligned with the current route.
  (function () {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  })();

  function upsertMeta(key, content, isProperty) {
    if (!content) return;
    const sel = isProperty ? `meta[property="${key}"]` : `meta[name="${key}"]`;
    let el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      if (isProperty) el.setAttribute('property', key);
      else el.setAttribute('name', key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  upsertMeta('description', desc);
  upsertMeta('keywords', cfg.keywords);
  upsertMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  upsertMeta('googlebot', 'index, follow');
  upsertMeta('abstract', cfg.aiSummary);
  upsertMeta('author', brand.name || 'Balaji Chippada');

  upsertMeta('og:type', 'website', true);
  upsertMeta('og:url', canonical, true);
  upsertMeta('og:site_name', cfg.siteName, true);
  upsertMeta('og:title', title, true);
  upsertMeta('og:description', desc, true);
  upsertMeta('og:image', cfg.ogImage, true);
  upsertMeta('og:image:alt', cfg.ogImageAlt, true);
  upsertMeta('og:locale', cfg.locale, true);

  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', title);
  upsertMeta('twitter:description', desc);
  upsertMeta('twitter:image', cfg.ogImage);
  if (cfg.twitterHandle) upsertMeta('twitter:site', cfg.twitterHandle);

  // AI crawler hints (emerging conventions — harmless for traditional SEO)
  upsertMeta('llms-txt', url + '/llms.txt');
  upsertMeta('llms-full-txt', url + '/llms-full.txt');

  // Inject JSON-LD after DOMContentLoaded so body-loaded data (videos.js →
  // window.ROADMAP_VIDEOS) is available for per-video VideoObject schema.
  // The prerender step captures the result, so no-JS crawlers still get it.
  function injectJsonLd() {
    try {
      // Skip if a prerendered/static JSON-LD block is already present (avoids
      // duplicate structured data once the prerender step inlines it).
      if (document.getElementById('seo-jsonld')) return;
      const jsonLd = cfg.buildJsonLd(route);
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'seo-jsonld';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    } catch (e) {
      console.warn('SEO JSON-LD injection failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectJsonLd);
  } else {
    injectJsonLd();
  }
})();
