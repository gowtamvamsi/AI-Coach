#!/usr/bin/env node
/*
 * ONE-TIME CLEANUP — un-marks playlist-backed roadmap modules that were wrongly
 * completed by the old bug where clicking ANY single video in a playlist marked
 * the whole module done.
 *
 * Why videoProgress is the signal
 * --------------------------------
 * The "has this device watched all the videos" flag lives in the browser's
 * localStorage (v2_vwatched_<id>) and is NOT readable from the server. The
 * server-readable equivalent is roadmapProgress.videoProgress: the OLD buggy
 * flow wrote one entry there for EVERY clicked video, so a user who only opened
 * a few lessons has fewer than the playlist's total marked completed. We treat a
 * module as wrongly-completed when completedModules contains it but the user has
 * NOT recorded all of that playlist's videos as watched.
 *
 * IMPORTANT — run this ONCE, against the current (pre-fix) data. After the
 * all-watched fix is live, completion is tracked per-device in localStorage and
 * a legitimate completion writes only ONE videoProgress entry, so this
 * server-side signal would then produce false positives. Do not re-run later.
 *
 * Usage
 * -----
 *   Dry run (default, writes nothing):
 *     node scripts/cleanup-playlist-module-completions.cjs
 *   Apply the changes:
 *     node scripts/cleanup-playlist-module-completions.cjs --apply
 *
 * Auth — needs admin credentials for project balaji-chippada-agentic-ai:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   (or run `gcloud auth application-default login` first)
 */

const admin = require('../functions/node_modules/firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'balaji-chippada-agentic-ai';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// Module -> the videoIds of its playlist (mirrors PLAYLIST_STATIC_BUILTIN +
// the module->playlist mapping in videos.js). A module is considered legitimately
// complete only when EVERY id below is recorded watched in videoProgress.
const PLAYLIST_MODULES = {
  // 1.1 — "Python For Data Science" (PL8qeqP57-QAZz8wi1x7toEWzPC_mW5NfO), 33 videos
  '1.1': [
    'iWmDSH21cTY', 'ztEnaCr8X6A', 'fvC2jcGyTWs', 'lWzrUJN_iGQ', 'M9MdMtlWjVQ',
    '02RL7UYbo-0', 'RPWSQ1W7Xss', 'FzEHpiuGuV8', 'iwHWYQLraWs', 'm5OL19oMgWE',
    'Isv-Cntut6E', 'MkDn1ygA2V0', '16IMUjkgqm8', 'MlAycaXUNTA', '_2vImJ_YJfo',
    'eDvLR4DuoI4', 'ma3SlNjF-NM', 'qEZ7nPLjt40', 'n0QbyAYLBcM', 'nd1Wh_FESeM',
    'zm07PrSK6is', 'o4EjbjquAt0', 'L5NdPKTUlWY', 'LwfGWgbBgr4', 'heAWC5UQTZw',
    'LdDBAaAIh90', '91C04FZUgKs', 'JAgXPCK-a8k', '_zNo-CWzqew', 'LKb63TcJs9g',
    'nLqkyKZZXUs', 'ziJrKWsJB0g', '1r-yodra1pg',
  ],
  // 1.2 — "Python OOP" (PL8qeqP57-QAZVtqc02k7-uRHGnLJW90d_), 4 videos
  '1.2': [
    'KsRuS0gkEac', '5VWvm3W9mOU', 'OTPKSlchkGc', 'BYdhkgGRnME',
  ],
};

function watchedCount(videoProgress, ids) {
  const vp = videoProgress || {};
  return ids.filter((id) => {
    const e = vp[id];
    return e && (e.completed === true || (typeof e.watchedRatio === 'number' && e.watchedRatio >= 0.8));
  }).length;
}

(async () => {
  const snap = await db.collectionGroup('roadmapProgress').get();
  let scanned = 0;
  const updates = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const completed = Array.isArray(data.completedModules) ? data.completedModules : [];
    if (completed.length === 0) return;
    scanned++;

    const removed = [];
    for (const mod of Object.keys(PLAYLIST_MODULES)) {
      if (!completed.includes(mod)) continue;
      const ids = PLAYLIST_MODULES[mod];
      const wc = watchedCount(data.videoProgress, ids);
      if (wc < ids.length) removed.push({ mod, wc, total: ids.length });
    }

    if (removed.length) {
      const newCompleted = completed.filter((m) => !removed.some((r) => r.mod === m));
      console.log(
        `${APPLY ? 'FIX     ' : 'WOULD FIX'} ${doc.ref.path} — remove ` +
        removed.map((r) => `${r.mod} (${r.wc}/${r.total} watched)`).join(', ')
      );
      updates.push({ ref: doc.ref, newCompleted });
    }
  });

  console.log(`\nScanned ${scanned} progress doc(s) with completions; ${updates.length} need fixing.`);

  if (!updates.length) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('Dry run — re-run with --apply to write these changes.');
    process.exit(0);
  }

  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach(({ ref, newCompleted }) => {
      batch.update(ref, {
        completedModules: newCompleted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  console.log(`Applied ${updates.length} update(s).`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
