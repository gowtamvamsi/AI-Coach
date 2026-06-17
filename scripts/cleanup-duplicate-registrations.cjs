#!/usr/bin/env node
/*
 * ONE-TIME CLEANUP — removes duplicate registration docs.
 *
 * The free-signup flow used .add(), so a student who registered for the same
 * class more than once produced multiple identical roster rows (inflating
 * counts + sending repeat reminder emails). This keeps ONE registration per
 * (sessionId + studentEmail) and deletes the redundant ones.
 *
 * Keep rule: prefer the doc that already has email-sent flags (so we don't
 * re-trigger reminders), tie-break by newest createdAt. Cancelled docs are
 * never touched, and a group's only registration is never deleted.
 *
 *   Dry run:  GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node scripts/cleanup-duplicate-registrations.cjs
 *   Apply:    GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node scripts/cleanup-duplicate-registrations.cjs --apply
 */
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'balaji-chippada-agentic-ai' });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const norm = (s) => String(s || '').trim().toLowerCase();
const ms = (r) => {
  const v = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : (r.createdAt ? new Date(r.createdAt) : null);
  return v && !isNaN(v) ? v.getTime() : 0;
};
// Higher score = more important to keep (preserves already-sent email state).
const score = (r) => (r.zoomLinkSent ? 4 : 0) + (r.detailsEmailSent ? 2 : 0) + (r.bookedAt ? 1 : 0);

(async () => {
  const snap = await db.collection('registrations').get();
  const groups = {};
  snap.forEach((doc) => {
    const r = doc.data() || {};
    if (r.cancelled === true || r.status === 'cancelled') return; // never touch
    const who = norm(r.studentEmail) || norm(r.userId);
    if (!who) return; // can't safely identify; leave alone
    const key = norm(r.sessionId) + '::' + who;
    (groups[key] = groups[key] || []).push({ ref: doc.ref, id: doc.id, score: score(r), t: ms(r) });
  });

  const toDelete = [];
  let groupsWithDupes = 0;
  Object.entries(groups).forEach(([key, docs]) => {
    if (docs.length <= 1) return;
    groupsWithDupes++;
    docs.sort((a, b) => (b.score - a.score) || (b.t - a.t)); // best to keep first
    const keep = docs[0];
    const drop = docs.slice(1);
    console.log(`${key}  → keep ${keep.id} (score ${keep.score}), delete ${drop.length}: ${drop.map((d) => d.id).join(', ')}`);
    drop.forEach((d) => toDelete.push(d.ref));
  });

  console.log(`\nScanned ${snap.size} registrations; ${toDelete.length} redundant duplicate(s) across ${groupsWithDupes} group(s).`);
  if (!toDelete.length) { console.log('Nothing to do.'); process.exit(0); }
  if (!APPLY) { console.log('Dry run — re-run with --apply to delete these.'); process.exit(0); }

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  console.log(`Deleted ${toDelete.length} duplicate registration(s).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
