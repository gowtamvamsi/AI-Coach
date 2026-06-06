// Injects meta tags + JSON-LD from SEO_CONFIG / SITE_CONFIG (runs synchronously in <head>).
(function () {
  const cfg = window.SEO_CONFIG;
  if (!cfg) return;

  const brand = (window.SITE_CONFIG && window.SITE_CONFIG.brand) || {};
  const stats = brand.stats || {};
  const url = cfg.siteUrl || 'https://balajichippada.com';
  const desc = cfg.description.replace('150K+', stats.roadmapViews || '150K+');

  document.title = cfg.title;

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
  upsertMeta('og:url', url + '/', true);
  upsertMeta('og:site_name', cfg.siteName, true);
  upsertMeta('og:title', cfg.title, true);
  upsertMeta('og:description', desc, true);
  upsertMeta('og:image', cfg.ogImage, true);
  upsertMeta('og:image:alt', cfg.ogImageAlt, true);
  upsertMeta('og:locale', cfg.locale, true);

  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', cfg.title);
  upsertMeta('twitter:description', desc);
  upsertMeta('twitter:image', cfg.ogImage);
  if (cfg.twitterHandle) upsertMeta('twitter:site', cfg.twitterHandle);

  // AI crawler hints (emerging conventions — harmless for traditional SEO)
  upsertMeta('llms-txt', url + '/llms.txt');
  upsertMeta('llms-full-txt', url + '/llms-full.txt');

  try {
    const jsonLd = cfg.buildJsonLd();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'seo-jsonld';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  } catch (e) {
    console.warn('SEO JSON-LD injection failed:', e);
  }
})();
