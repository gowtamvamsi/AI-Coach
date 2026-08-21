// Roadmap video registry (seed) + helper utilities
// Firestore `roadmapVideos` entries merge on top at runtime.

window.ROADMAP_VIDEO_HELPERS = (function () {
  function isLocalDev() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  // Built-in full playlist (YouTube RSS caps at 15). Update when playlist changes.
  const PLAYLIST_STATIC_BUILTIN = {
    'PL8qeqP57-QAZz8wi1x7toEWzPC_mW5NfO': [
      { videoId: 'iWmDSH21cTY', title: 'Why Learn Python ? Mastering Data Science: Python Unveiled! 🚀 Explore, Learn, Excel!' },
      { videoId: 'ztEnaCr8X6A', title: '#01 || Google Colab Tutorial | Step-by-Step Guide for Beginners' },
      { videoId: 'fvC2jcGyTWs', title: '#02 || Keywords & Identifiers & Comments || Python For Data Science' },
      { videoId: 'lWzrUJN_iGQ', title: '#03 | Indentation & Statements & Variables || Python For Data Science' },
      { videoId: 'M9MdMtlWjVQ', title: '#04 || Data Types vs. Data Structures Explained || Python for Data Science' },
      { videoId: '02RL7UYbo-0', title: '#05 || Numeric Data types & Strings  || Python For Data Science' },
      { videoId: 'RPWSQ1W7Xss', title: '#06 || Lists in Python || Methods and Manipulation || Python For Data Science' },
      { videoId: 'FzEHpiuGuV8', title: '#07 || Tuples in Python || Mastering Immutable data structures || Python For Data Science' },
      { videoId: 'iwHWYQLraWs', title: '#08 || Sets in Python || Methods and Manipulations || Python for Data Science' },
      { videoId: 'm5OL19oMgWE', title: '#09 || Dictionaries in Python || Methods and Manipulations || Python for Data Science' },
      { videoId: 'Isv-Cntut6E', title: '#10 || Type Casting In Python || Very Easy || Python for Data Science' },
      { videoId: 'MkDn1ygA2V0', title: '#11 || Operators in Python || Part 1 || Python for Data Science' },
      { videoId: '16IMUjkgqm8', title: '#12 || Bitwise Operators in Python || 2\'s Complement ... || Python For Data Science' },
      { videoId: 'MlAycaXUNTA', title: '#13 || If else statement tutorial Python || Python for Data Science' },
      { videoId: '_2vImJ_YJfo', title: '#14 || While Loops in Python || How to avoid infinite loops || Python for Data Science' },
      { videoId: 'eDvLR4DuoI4', title: '#15 || Python For Loop Tutorial || Real life examples || Python for data science' },
      { videoId: 'ma3SlNjF-NM', title: '#16 || Break 🆚 Continue 🆚 Pass Statement in Python || Python for Data Science' },
      { videoId: 'qEZ7nPLjt40', title: '#17 || Functions in Python || Python for Data Science' },
      { videoId: 'n0QbyAYLBcM', title: '#18 || Arguments vs Parameters in Functions || args vs kwargs || Python for Data Science' },
      { videoId: 'nd1Wh_FESeM', title: '#19 || Map reduce filter in python || Inbuilt vs User Defined Functions in Python' },
      { videoId: 'zm07PrSK6is', title: '#20 || Recursive Functions and Lambda Functions in Python || Python for Data Science' },
      { videoId: 'o4EjbjquAt0', title: '#21 || Exception Handling in Python || Try Except Finally explained in detail!' },
      { videoId: 'L5NdPKTUlWY', title: '#22 || File Handling in Python - Reading and writing to files || Python for Data Science' },
      { videoId: 'LwfGWgbBgr4', title: '#23 || Complete Numpy from Scratch - Part 1 || Python for Data Science' },
      { videoId: 'heAWC5UQTZw', title: '#24 || Complete Numpy from Scratch - Part 2 || Python for Data Science' },
      { videoId: 'LdDBAaAIh90', title: '#25 || Complete Numpy from Scratch - Part 3 || Python for Data Science' },
      { videoId: '91C04FZUgKs', title: '#26 || Complete Pandas from Scratch - Part 1 || Python for DataScience #Pandas' },
      { videoId: 'JAgXPCK-a8k', title: '#27 || Complete Pandas from Scratch - Part 2 || Delete Records, Slicing & Indexing in DataFrames' },
      { videoId: '_zNo-CWzqew', title: '#28 || Pandas from Scratch Part3 || Loc vs iLoc in DataFrames with detailed Examples' },
      { videoId: 'LKb63TcJs9g', title: '#29 || Pandas from Scratch - Part 4 || Sort Rows, Sort Columns & Rearrange Columns in DataFrames' },
      { videoId: 'nLqkyKZZXUs', title: '#30 || How to deal with Null Values in DataFrames ?|| Pandas from Scratch - Part 5' },
      { videoId: 'ziJrKWsJB0g', title: '#31 || Filtering and GroupBy in DataFrames || Pandas from Scratch - Part 6' },
      { videoId: '1r-yodra1pg', title: '#32 || Join VS Merge VS Concat in DataFrames || Pandas from Scratch - Part 7' },
    ],
    'PL8qeqP57-QAZVtqc02k7-uRHGnLJW90d_': [
      { videoId: 'KsRuS0gkEac', title: 'Python OOP for Agentic AI Engineers — Classes, Objects & Methods in 30 Minutes' },
      { videoId: '5VWvm3W9mOU', title: 'Python OOPs Part2' },
      { videoId: 'OTPKSlchkGc', title: 'Python OOP Part 3: Classmethod, Staticmethod & Self | Agentic AI Roadmap' },
      { videoId: 'BYdhkgGRnME', title: 'Stop Copy Pasting Python Classes  || Class Inheritance || Agentic AI Roadmap' },
    ],
  };

  function parseYouTubeId(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    const patterns = [
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function parseYouTubePlaylistId(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim();
    if (/^PL[a-zA-Z0-9_-]+$/.test(s)) return s;
    const m = s.match(/[?&]list=(PL[a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function youtubeEmbedUrl({ youtubeId, playlistId, startSec, videoIndex }) {
    if (playlistId && youtubeId) {
      const idx = videoIndex != null ? `&index=${videoIndex}` : '';
      return `https://www.youtube-nocookie.com/embed/${youtubeId}?list=${playlistId}&rel=0${idx}`;
    }
    if (playlistId) {
      return `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&rel=0`;
    }
    const start = startSec > 0 ? `&start=${startSec}` : '';
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0${start}`;
  }

  async function fetchText(url) {
    // Browser cannot fetch YouTube directly (CORS). Skip noisy failures on localhost.
    if (isLocalDev()) return '';
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch (_) { /* try proxy */ }
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxy);
      if (res.ok) return await res.text();
    } catch (_) {}
    return '';
  }

  function parsePlaylistInnertubePage(data) {
    const videos = [];
    let continuation = null;
    const seen = new WeakSet();
    function walk(node) {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (node.playlistVideoRenderer) {
        const v = node.playlistVideoRenderer;
        const title = v.title?.simpleText
          || (v.title?.runs || []).map((r) => r.text).join('')
          || 'Video';
        const thumbs = v.thumbnail?.thumbnails || [];
        const thumbnail = thumbs[thumbs.length - 1]?.url
          || (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` : '');
        if (v.videoId) videos.push({ videoId: v.videoId, title, thumbnail });
      }
      if (node.continuationItemRenderer && !continuation) {
        continuation = node.continuationItemRenderer.continuationEndpoint
          ?.continuationCommand?.token || null;
      }
      if (Array.isArray(node)) node.forEach(walk);
      else Object.keys(node).forEach((k) => walk(node[k]));
    }
    walk(data);
    return { videos, continuation };
  }

  async function fetchPlaylistViaInnertube(playlistId) {
    const ctx = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20250201.01.00',
          hl: 'en',
          gl: 'US',
        },
      },
    };
    const all = [];
    let body = { ...ctx, browseId: `VL${playlistId}` };
    let endpoint = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false';

    for (let page = 0; page < 20; page++) {
      let data = null;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) data = await res.json();
      } catch (_) { break; }
      if (!data) break;

      const { videos, continuation } = parsePlaylistInnertubePage(data);
      all.push(...videos);
      if (!continuation) break;
      endpoint = 'https://www.youtube.com/youtubei/v1/next?prettyPrint=false';
      body = { ...ctx, continuation };
    }
    return all;
  }

  function parsePlaylistRssXml(text) {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const entries = doc.querySelectorAll('entry');
      return Array.from(entries).map((entry, i) => {
        const ns = 'http://www.youtube.com/xml/schemas/2015';
        const videoId = entry.getElementsByTagNameNS(ns, 'videoId')[0]?.textContent
          || entry.querySelector('videoId')?.textContent
          || '';
        const rawTitle = entry.querySelector('title')?.textContent || `Video ${i + 1}`;
        const mediaNs = 'http://search.yahoo.com/mrss/';
        const thumbEl = entry.getElementsByTagNameNS(mediaNs, 'thumbnail')[0];
        const thumbnail = thumbEl?.getAttribute('url')
          || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '');
        return { videoId, title: rawTitle, thumbnail };
      }).filter((v) => v.videoId);
    } catch (_) {
      return [];
    }
  }

  function extractYtInitialData(html) {
    const markers = ['var ytInitialData = ', 'window["ytInitialData"] = '];
    for (const marker of markers) {
      const idx = html.indexOf(marker);
      if (idx < 0) continue;
      let start = idx + marker.length;
      let depth = 0;
      for (let i = start; i < html.length; i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(html.slice(start, i + 1));
            } catch (_) {
              return null;
            }
          }
        }
      }
    }
    return null;
  }

  function normalizePlaylistItems(items) {
    const seen = new Set();
    return (items || [])
      .filter((v) => v && v.videoId && !seen.has(v.videoId) && seen.add(v.videoId))
      .map((v, i) => ({
        videoId: v.videoId,
        title: v.title || `Video ${i + 1}`,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
        index: i + 1,
      }));
  }

  async function fetchPlaylistViaProxyApi(playlistId) {
    if (isLocalDev()) return [];
    const projectId = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) || 'balaji-chippada-agentic-ai';
    const bases = [
      '/api/youtube-playlist',
      `https://us-central1-${projectId}.cloudfunctions.net/getYouTubePlaylist`,
    ];
    for (const base of bases) {
      try {
        const res = await fetch(`${base}?list=${encodeURIComponent(playlistId)}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length) return data.items;
      } catch (_) { /* try next endpoint */ }
    }
    return [];
  }

  async function fetchPlaylistViaHtml(playlistId) {
    const pageUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const html = await fetchText(pageUrl);
    if (!html) return [];
    const data = extractYtInitialData(html);
    if (!data) return [];
    const { videos } = parsePlaylistInnertubePage(data);
    return videos;
  }

  async function fetchPlaylistViaRss(playlistId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const text = await fetchText(feedUrl);
    return parsePlaylistRssXml(text);
  }

  function fetchPlaylistStatic(playlistId) {
    const items = PLAYLIST_STATIC_BUILTIN[playlistId]
      || window.PLAYLIST_STATIC_ITEMS?.[playlistId];
    if (!items || !items.length) return [];
    return items.map((v) => ({
      ...v,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
    }));
  }

  async function fetchPlaylistItemsRemote(playlistId) {
    if (isLocalDev()) {
      return normalizePlaylistItems(fetchPlaylistStatic(playlistId));
    }
    const results = await Promise.all([
      fetchPlaylistViaProxyApi(playlistId),
      fetchPlaylistViaInnertube(playlistId),
      fetchPlaylistViaHtml(playlistId),
      fetchPlaylistViaRss(playlistId),
      Promise.resolve(fetchPlaylistStatic(playlistId)),
    ]);
    const best = results.reduce((a, b) => (b.length > a.length ? b : a), []);
    return normalizePlaylistItems(best);
  }

  async function fetchPlaylistItems(playlistId) {
    if (!playlistId) return [];
    const cache = fetchPlaylistItems._cache || (fetchPlaylistItems._cache = new Map());
    const staticItems = normalizePlaylistItems(fetchPlaylistStatic(playlistId));

    if (cache.has(playlistId)) {
      const hit = cache.get(playlistId);
      const resolved = typeof hit.then === 'function' ? await hit : hit;
      if (resolved.length >= staticItems.length && resolved.length > 0) return resolved;
      if (staticItems.length > 0) {
        cache.set(playlistId, staticItems);
        return staticItems;
      }
      return resolved;
    }

    if (staticItems.length > 0) {
      cache.set(playlistId, staticItems);
      fetchPlaylistItemsRemote(playlistId)
        .then((remote) => {
          const best = remote.length >= staticItems.length ? remote : staticItems;
          cache.set(playlistId, best);
        })
        .catch(() => {});
      return staticItems;
    }

    const load = fetchPlaylistItemsRemote(playlistId);
    cache.set(playlistId, load);
    try {
      const result = await load;
      cache.set(playlistId, result);
      return result;
    } catch (err) {
      cache.delete(playlistId);
      throw err;
    }
  }

  function parseTimestamp(input) {
    if (input == null || input === '') return 0;
    if (typeof input === 'number' && !isNaN(input)) return Math.max(0, Math.floor(input));
    const s = String(input).trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const parts = s.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function formatTimestamp(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `${m}:${String(ss).padStart(2, '0')}`;
  }

  function youtubeWatchUrl(youtubeId, startSec) {
    const base = `https://www.youtube.com/watch?v=${youtubeId}`;
    return startSec > 0 ? `${base}&t=${startSec}s` : base;
  }

  function flattenSeedVideos(seedList) {
    const out = [];
    (seedList || []).forEach((v) => {
      (v.mappings || []).forEach((m, i) => {
        out.push({
          id: v.id ? `${v.id}-${i}` : `seed-${i}`,
          youtubeId: v.youtubeId || null,
          playlistId: v.playlistId || null,
          title: v.title,
          kind: v.kind || 'overview',
          phaseId: m.phaseId || null,
          capstoneId: m.capstoneId || null,
          modules: m.modules || [],
          startSec: m.startSec || 0,
          endSec: m.endSec != null ? m.endSec : null,
          codeUrl: m.codeUrl || v.codeUrl || null,
          source: 'seed',
        });
      });
    });
    return out;
  }

  function mergeVideoLinks(seedFlat, firestoreDocs) {
    const key = (l) => `${l.youtubeId || ''}|${l.playlistId || ''}|${l.phaseId}|${(l.modules || []).join(',')}|${l.startSec}`;
    const map = new Map();
    seedFlat.forEach((l) => map.set(key(l), l));
    (firestoreDocs || []).forEach((doc) => {
      const l = {
        id: doc.id,
        youtubeId: doc.youtubeId || null,
        playlistId: doc.playlistId || null,
        title: doc.title,
        kind: doc.kind || 'deep-dive',
        phaseId: doc.phaseId || null,
        capstoneId: doc.capstoneId || null,
        modules: doc.modules || [],
        startSec: doc.startSec || 0,
        endSec: doc.endSec != null ? doc.endSec : null,
        codeUrl: doc.codeUrl || null,
        source: 'firestore',
      };
      map.set(key(l), l);
    });
    return Array.from(map.values());
  }

  function getPhaseVideoLinks(links, phaseId) {
    return (links || []).filter((l) => l.phaseId === phaseId);
  }

  function getModuleVideoLinks(links, moduleN) {
    return (links || []).filter((l) => (l.modules || []).includes(moduleN));
  }

  /** Videos to embed inside a module tab (dedicated lessons — not phase overviews). */
  function getModuleEmbedVideos(links, moduleN) {
    return getModuleVideoLinks(links, moduleN).filter((l) => l.kind !== 'overview');
  }

  function getPrimaryPhaseVideo(links, phaseId) {
    const phaseLinks = getPhaseVideoLinks(links, phaseId);
    return phaseLinks.find((l) => l.kind === 'overview') || null;
  }

  function calcRoadmapProgress(completedModules) {
    const done = new Set(completedModules || []);
    const phases = window.ROADMAP || [];
    let totalModules = 0;
    let totalDone = 0;
    const phaseStats = phases.map((p) => {
      const mods = (p.sections || []).map((s) => s.n);
      const completed = mods.filter((n) => done.has(n)).length;
      totalModules += mods.length;
      totalDone += completed;
      return {
        phaseId: p.id,
        title: p.title,
        completed,
        total: mods.length,
        pct: mods.length ? Math.round((completed / mods.length) * 100) : 0,
      };
    });
    const overallPct = totalModules ? Math.round((totalDone / totalModules) * 100) : 0;
    return { phaseStats, overallPct, totalDone, totalModules };
  }

  // Every distinct videoId that belongs to a module (single videos + every
  // track of any playlist mapped to it). Playlist length comes from the static
  // seed, which mirrors the live playlist.
  function getModuleVideoIds(links, moduleN) {
    const ids = new Set();
    getModuleEmbedVideos(links, moduleN).forEach((l) => {
      if (l.playlistId) {
        (getPlaylistItemsSync(l.playlistId) || []).forEach((it) => { if (it && it.videoId) ids.add(it.videoId); });
      } else if (l.youtubeId) {
        ids.add(l.youtubeId);
      }
    });
    return ids;
  }

  // A module counts as complete only when EVERY video mapped to it has been
  // watched (videoProgress[id].completed). Derives the completed-module list
  // from the full per-video watch state — so watching 3 of a 33-video playlist
  // no longer completes the module.
  function deriveCompletedModules(links, videoProgress) {
    const vp = videoProgress || {};
    // A video counts as watched if EITHER the synced Firestore flag OR the local
    // "Watched" badge (window.__isVideoWatched) says so — so module completion
    // always matches the badges the user sees.
    const isWatched = (id) =>
      (vp[id] && vp[id].completed) ||
      (typeof window !== 'undefined' && window.__isVideoWatched && window.__isVideoWatched(id));
    const out = [];
    (window.ROADMAP || []).forEach((p) => {
      (p.sections || []).forEach((s) => {
        const ids = getModuleVideoIds(links, s.n);
        if (ids.size === 0) return; // no videos mapped → not auto-completable
        let all = true;
        for (const id of ids) { if (!isWatched(id)) { all = false; break; } }
        if (all) out.push(s.n);
      });
    });
    return out;
  }

  function findNextModule(completedModules) {
    const done = new Set(completedModules || []);
    for (const p of window.ROADMAP || []) {
      for (const s of p.sections || []) {
        if (!done.has(s.n)) {
          return { phaseId: p.id, phaseTitle: p.title, moduleN: s.n, moduleTitle: s.title };
        }
      }
    }
    return null;
  }

  const PROGRESS_THRESHOLD = 0.8;

  function youtubeThumbnail(videoId) {
    // hqdefault (480×360) — mqdefault looks soft when scaled in the track list
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  /**
   * Hero / click-to-play poster. Must be 16:9 to fill the 16:9 .v2-video-frame
   * without cropping — sddefault/hqdefault are 4:3 and got top/bottom-cropped by
   * `background-size: cover` (clipped the thumbnail's title text). maxresdefault
   * is 1280×720 (16:9) and exists for every custom-thumbnail video on the channel.
   */
  function youtubePoster(videoId) {
    return videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '';
  }

  function getPlaylistItemsSync(playlistId) {
    return normalizePlaylistItems(fetchPlaylistStatic(playlistId));
  }

  return {
    parseYouTubeId,
    parseYouTubePlaylistId,
    youtubeEmbedUrl,
    youtubeThumbnail,
    youtubePoster,
    fetchPlaylistItems,
    getPlaylistItemsSync,
    parseTimestamp,
    formatTimestamp,
    youtubeWatchUrl,
    flattenSeedVideos,
    mergeVideoLinks,
    getPhaseVideoLinks,
    getModuleVideoLinks,
    getModuleEmbedVideos,
    getPrimaryPhaseVideo,
    calcRoadmapProgress,
    findNextModule,
    getModuleVideoIds,
    deriveCompletedModules,
    PROGRESS_THRESHOLD,
  };
})();

// Seed: overview video with chapter timestamps per phase
window.ROADMAP_VIDEOS = [
  {
    id: 'roadmap-overview',
    youtubeId: 'Eze6D8jAMjI',
    title: 'Full Roadmap Walkthrough (2026)',
    kind: 'overview',
    mappings: [
      { phaseId: 1, modules: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'], startSec: 607 },
      { phaseId: 2, modules: ['2.1', '2.2', '2.3', '2.4', '2.5'], startSec: 686 },
      { phaseId: 3, modules: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'], startSec: 788 },
      { phaseId: 4, modules: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9'], startSec: 878 },
      { phaseId: 5, modules: ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8'], startSec: 1013 },
      { phaseId: 6, modules: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7'], startSec: 1100 },
      { phaseId: 7, modules: ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'], startSec: 1146 },
      { phaseId: 8, modules: ['8.1', '8.2', '8.3', '8.4'], startSec: 1192 },
      { phaseId: 9, modules: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6'], startSec: 1255 },
    ],
  },
  {
    id: 'phase1-genai-vs-agents',
    youtubeId: 'u-glihrL-Ko',
    title: 'Generative AI vs AI Agents vs Agentic AI',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 1, modules: ['1.1'], startSec: 0 },
    ],
  },
  {
    id: 'phase1-core-python-playlist',
    playlistId: 'PL8qeqP57-QAZz8wi1x7toEWzPC_mW5NfO',
    title: 'Python For Data Science',
    kind: 'playlist',
    mappings: [
      { phaseId: 1, modules: ['1.2'] },
    ],
  },
  {
    id: 'phase1-oop-playlist',
    playlistId: 'PL8qeqP57-QAZVtqc02k7-uRHGnLJW90d_',
    title: 'Python OOP for Agentic AI',
    kind: 'playlist',
    mappings: [
      { phaseId: 1, modules: ['1.3'] },
    ],
  },
  {
    id: 'phase1-http-apis',
    youtubeId: 'xcRwOwL3plY',
    title: 'Working with HTTP APIs',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 1, modules: ['1.4'], startSec: 0 },
    ],
  },
  {
    id: 'phase1-async',
    youtubeId: 'aVE4ge8BTCs',
    title: 'Async Programming',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 1, modules: ['1.5'], startSec: 0 },
    ],
  },
  {
    id: 'phase3-prompt-engineering',
    youtubeId: 'w_iQBSDewxI',
    title: 'Prompt Engineering',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 3, modules: ['3.2'], startSec: 0 },
    ],
  },
  {
    id: 'phase3-context-engineering',
    youtubeId: 'fGfTj5NoM7k',
    title: 'Context Engineering',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 3, modules: ['3.3'], startSec: 0 },
    ],
  },
  {
    id: 'phase5-function-calling',
    youtubeId: 'g_A9hNZ3eok',
    title: 'Function Calling & Tool Use',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 5, modules: ['5.1'], startSec: 0 },
    ],
  },
  {
    id: 'phase5-tool-design',
    youtubeId: 'yx67tBxJwrs',
    title: 'Tool Design Principles',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 5, modules: ['5.2'], startSec: 0 },
    ],
  },
  {
    id: 'phase2-what-is-llm',
    youtubeId: 'vz0OLOatU5c',
    title: 'What an LLM actually is',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 2, modules: ['2.1'], startSec: 194 },
    ],
  },
  {
    id: 'phase2-how-llm-thinks',
    youtubeId: 'svPdKlaxJHY',
    title: 'How an LLM thinks',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 2, modules: ['2.2'], startSec: 990 },
    ],
  },
  {
    id: 'phase2-reasoning-models',
    youtubeId: 'YSCgLcoLqbY',
    title: 'Reasoning models vs base models',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 2, modules: ['2.3'], startSec: 48 },
    ],
  },
  {
    id: 'phase4-rag-pipeline',
    youtubeId: 'Lw8QSNKpu7Y',
    title: 'Build a RAG Pipeline from Scratch',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 4, modules: ['4.3'], startSec: 0 },
    ],
  },
  {
    id: 'phase2-evals-benchmarks',
    youtubeId: 'm9wvHClG8vo',
    title: 'Reading model evals & benchmarks',
    kind: 'deep-dive',
    mappings: [
      { phaseId: 2, modules: ['2.4'], startSec: 0 },
    ],
  },
];
